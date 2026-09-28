// Author: Gemini
// OS support: Web/Node
// Description: Extract KQTN bulk structure / footer boundary endpoint

import { NextRequest, NextResponse } from 'next/server';
import { jsonBadRequest } from '@/lib/server/response';
import {
  collectPaddleOcr,
  getOcrErrorStatus,
  ServerOcrCandidate,
} from '@/lib/server/ocr';
import {
  CANDIDATE_MODELS,
  GEMINI_API_KEY_MISSING_MESSAGE,
  Type,
  generateContentWithRetryAndFallback,
  getPersonalGeminiClient,
  getPersonalGeminiModel,
} from '@/lib/server/gemini';
import { extractKqtnFooterKey, parseKqtnOcrMetadata } from '@/utils/kqtnOcrMetadata';
import { isUsableOcrCandidate } from '@/utils/ocrPipeline';

const KQTN_BULK_STRUCTURE_TIMEOUT_MS = 45_000;
const KQTN_STRUCTURE_TIMEOUT_CODE = 'KQTN_STRUCTURE_TIMEOUT';

function isGeminiRequestTimeout(error: any): boolean {
  const errorName = String(error?.name || '');
  const errorMessage = String(error?.message || error || '');
  return errorName === 'AbortError' || /timed?\s*out|timeout|deadline exceeded|ETIMEDOUT/i.test(errorMessage);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  const analysisMode = body?.mode === 'footer' ? 'footer' : 'structure';
  try {
    const { base64Data, pageOffset } = body || {};
    if (!base64Data) {
      return jsonBadRequest('Missing PDF batch data.');
    }

    const parsedOffset = Number(pageOffset);
    const safeOffset = Number.isFinite(parsedOffset) ? Math.max(0, Math.floor(parsedOffset)) : 0;
    const payloadBytes = Math.floor((String(base64Data).length * 3) / 4);
    console.log(`KQTN ${analysisMode} request: pageOffset=${safeOffset}, payloadBytes=${payloadBytes}`);

    const paddleBulk = await collectPaddleOcr(
      Buffer.from(String(base64Data).replace(/^data:[^;]+;base64,/i, ''), 'base64'),
      'kqtn-bulk.pdf',
      'application/pdf',
    ).catch((error: any) => {
      console.warn(`KQTN ${analysisMode} PaddleOCR unavailable; falling back to Gemini:`, error?.message || String(error));
      return { text: '', confidence: 0, pages: [] } satisfies ServerOcrCandidate;
    });

    if (isUsableOcrCandidate(paddleBulk, 0.75) && paddleBulk.pages && paddleBulk.pages.length > 0) {
      const pages = paddleBulk.pages.map((page, index) => {
        const metadata = parseKqtnOcrMetadata(page.text);
        const pageNumber = safeOffset + index + 1;
        if (analysisMode === 'footer') {
          return {
            pageNumber,
            isReportCover: false,
            isBlank: !page.text.trim(),
            footerKey: extractKqtnFooterKey(page.text),
          };
        }
        return {
          pageNumber,
          isReportCover: Boolean(metadata.sampleCode || metadata.model || metadata.brand),
          isBlank: !page.text.trim(),
          reportNo: extractKqtnFooterKey(page.text),
          sampleCode: metadata.sampleCode,
          model: metadata.model,
          brand: metadata.brand,
          sealStamp: '',
          sampleName: '',
        };
      });
      return NextResponse.json({ pages, provider: 'PADDLEOCR' });
    }

    const activeAi = await getPersonalGeminiClient(req, KQTN_BULK_STRUCTURE_TIMEOUT_MS);
    const preferredModel = await getPersonalGeminiModel(req);
    const prompt =
      analysisMode === 'footer'
        ? `
Bạn đang xem một batch PDF gồm nhiều trang liên tiếp của một hoặc nhiều báo cáo kết quả thử nghiệm Điện - Điện tử.
Lưu ý: PDF có thể là bản scan ảnh, trang có thể bị xoay 90 độ; hãy đọc nội dung sau khi xoay đúng hướng.
Chỉ kiểm tra dải footer ở mép dưới mỗi trang và trả về đúng một phần tử cho mỗi trang, theo thứ tự trang.

Quy tắc nhận diện footer:
- pageNumber là số trang cục bộ trong batch, bắt đầu từ 1.
- isBlank=true chỉ khi trang trắng hoặc gần như trắng.
- footerKey chỉ chứa mã báo cáo, số phiếu hoặc mã mẫu ổn định được in lặp lại trong footer; giữ nguyên nội dung nhìn thấy.
- Không lấy số trang, ngày tháng, tên file, chữ bản quyền hoặc nội dung thay đổi theo từng trang làm footerKey.
- Nếu footer không có mã ổn định hoặc không đọc rõ, trả footerKey là chuỗi rỗng.
- Không suy đoán, không dùng nội dung ngoài tài liệu và không đánh dấu mốc tách chỉ vì footer khác nhau một lần.

Không lấy số trang làm footerKey. Trả về JSON theo schema đã cung cấp, không thêm markdown.
`
        : `
Bạn đang xem một batch PDF gồm nhiều trang liên tiếp của một hoặc nhiều báo cáo kết quả thử nghiệm Điện - Điện tử.
Lưu ý: PDF có thể là bản scan ảnh, trang có thể bị xoay 90 độ; hãy đọc nội dung sau khi xoay đúng hướng.
Hãy kiểm tra từng trang trong batch và trả về đúng một phần tử cho mỗi trang, theo thứ tự trang.

Quy tắc nhận diện:
- pageNumber là số trang cục bộ trong batch, bắt đầu từ 1.
- isReportCover=true chỉ khi trang có dấu hiệu rõ ràng là trang bìa báo cáo: tiêu đề báo cáo/phiếu kết quả, số báo cáo, mã hóa mẫu hoặc bảng thông tin mẫu. Không suy đoán từ một trang dữ liệu đơn lẻ.
- isBlank=true chỉ khi trang trắng hoặc gần như trắng. Không đánh dấu trang phân cách nằm giữa nội dung là blank nếu trang đó có nội dung đáng kể.
- reportNo là số báo cáo/phiếu nếu nhìn rõ; không dùng số báo cáo để thay thế sampleCode.
- Số báo cáo hoặc mã mẫu lặp trong footer không đủ để đánh dấu trang bìa; chỉ dùng khi có bảng thông tin mẫu hoặc tiêu đề báo cáo trên cùng trang.
- sampleCode là số mã hóa/mã hiệu mẫu nếu nhìn rõ.
- model, brand, sealStamp, sampleName chỉ lấy giá trị nhìn thấy trên trang bìa; trường không rõ trả chuỗi rỗng.
- Không bịa dữ liệu và không dùng kiến thức ngoài tài liệu.
- Nếu trang có tiêu đề báo cáo và bảng thông tin mẫu nhưng cờ nhận diện không chắc chắn, vẫn đánh dấu isReportCover=true; không đánh dấu các trang kết quả chỉ vì footer lặp lại.

Trả về JSON theo schema đã cung cấp, không thêm markdown.
`;

    const responseSchema =
      analysisMode === 'footer'
        ? {
            type: Type.OBJECT,
            properties: {
              pages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: { type: Type.INTEGER },
                    isBlank: { type: Type.BOOLEAN },
                    footerKey: { type: Type.STRING },
                  },
                  required: ['pageNumber', 'isBlank', 'footerKey'],
                },
              },
            },
            required: ['pages'],
          }
        : {
            type: Type.OBJECT,
            properties: {
              pages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pageNumber: { type: Type.INTEGER },
                    isReportCover: { type: Type.BOOLEAN },
                    isBlank: { type: Type.BOOLEAN },
                    reportNo: { type: Type.STRING },
                    sampleCode: { type: Type.STRING },
                    model: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    sealStamp: { type: Type.STRING },
                    sampleName: { type: Type.STRING },
                  },
                  required: ['pageNumber', 'isReportCover', 'isBlank', 'reportNo', 'sampleCode', 'model', 'brand', 'sealStamp', 'sampleName'],
                },
              },
            },
            required: ['pages'],
          };

    const response = await generateContentWithRetryAndFallback(
      activeAi,
      {
        contents: {
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64Data } },
            { text: prompt },
          ],
        },
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema,
        },
      },
      preferredModel,
      {
        modelNames: [preferredModel || CANDIDATE_MODELS[0]],
        attemptsPerModel: 1,
      },
    );

    const text = response.text;
    if (!text) throw new Error('AI returned no PDF structure.');
    const cleanedText = text.split(String.fromCharCode(96)).join('').trim();
    const parsed = JSON.parse(cleanedText);

    const pages = Array.isArray(parsed.pages)
      ? parsed.pages.map((page: any, index: number) =>
          analysisMode === 'footer'
            ? {
                pageNumber: safeOffset + Math.max(1, Math.floor(Number(page?.pageNumber) || index + 1)),
                isReportCover: false,
                isBlank: Boolean(page?.isBlank),
                footerKey: String(page?.footerKey || '').trim(),
              }
            : {
                pageNumber: safeOffset + Math.max(1, Math.floor(Number(page?.pageNumber) || index + 1)),
                isReportCover: Boolean(page?.isReportCover),
                isBlank: Boolean(page?.isBlank),
                reportNo: String(page?.reportNo || '').trim(),
                sampleCode: String(page?.sampleCode || '').trim(),
                model: String(page?.model || '').trim(),
                brand: String(page?.brand || '').trim(),
                sealStamp: String(page?.sealStamp || '').trim(),
                sampleName: String(page?.sampleName || '').trim(),
              },
        )
      : [];

    return NextResponse.json({ pages, provider: 'GEMINI' });
  } catch (error: any) {
    console.error(`KQTN ${analysisMode} extraction error:`, error);
    if (isGeminiRequestTimeout(error)) {
      return NextResponse.json(
        {
          code: KQTN_STRUCTURE_TIMEOUT_CODE,
          error: 'KQTN structure extraction timed out; manual split is required.',
        },
        { status: 504 },
      );
    }
    const status = getOcrErrorStatus(error);
    return NextResponse.json(
      {
        code: status === 503 && error?.message === GEMINI_API_KEY_MISSING_MESSAGE ? 'GEMINI_API_KEY_MISSING' : undefined,
        error: error?.message || String(error),
      },
      { status },
    );
  }
}
