// Author: Gemini
// OS support: Web/Node
// Description: Extract KQTN metadata (sampleCode, model, brand) endpoint

import { NextRequest, NextResponse } from 'next/server';
import { jsonBadRequest } from '@/lib/server/response';
import {
  collectPaddleOcr,
  getOcrErrorStatus,
  ServerOcrCandidate,
} from '@/lib/server/ocr';
import {
  GEMINI_API_KEY_MISSING_MESSAGE,
  Type,
  generateContentWithRetryAndFallback,
  getPersonalGeminiClient,
  getPersonalGeminiModel,
} from '@/lib/server/gemini';
import { parseKqtnOcrMetadata } from '@/utils/kqtnOcrMetadata';
import { isUsableOcrCandidate } from '@/utils/ocrPipeline';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonBadRequest('Missing PDF data.');
    }

    const { base64Data, mimeType } = body || {};
    if (!base64Data) {
      return jsonBadRequest('Missing PDF data.');
    }

    const metadataBase64 = String(base64Data).replace(/^data:[^;]+;base64,/i, '');
    const paddleMetadata = await collectPaddleOcr(
      Buffer.from(metadataBase64, 'base64'),
      String(mimeType || '').includes('pdf') ? 'kqtn-metadata.pdf' : 'kqtn-metadata-image',
      String(mimeType || 'application/pdf'),
      1,
    ).catch((error: any) => {
      console.warn('PaddleOCR KQTN metadata unavailable; falling back to Gemini:', error?.message || String(error));
      return { text: '', confidence: 0 } satisfies ServerOcrCandidate;
    });

    const parsedPaddleMetadata = parseKqtnOcrMetadata(paddleMetadata.text);
    if (isUsableOcrCandidate(paddleMetadata, 0.75) && Object.values(parsedPaddleMetadata).some(Boolean)) {
      return NextResponse.json({ ...parsedPaddleMetadata, provider: 'PADDLEOCR' });
    }

    const activeAi = await getPersonalGeminiClient(req);
    const preferredModel = await getPersonalGeminiModel(req);
    const prompt = `
Bạn đang xem trang bìa (trang 1) của một báo cáo/phiếu kết quả thử nghiệm thuộc phòng Điện - Điện tử, có thể là bản scan chất lượng thấp, có dấu mộc, chữ viết tay hoặc bảng biểu chồng lên nhau.

Hãy đọc kỹ toàn bộ trang và trích xuất chính xác ba trường sau:
- "sampleCode": Số mã hóa/mã hiệu của mẫu thử (thường xuất hiện gần nhãn "Số mã hóa", "Mã mẫu", "Mã hiệu", "Encode No.", "Sample code", có thể là chuỗi số-chữ có dấu gạch ngang hoặc chấm). Ưu tiên giá trị được đóng dấu hoặc in đậm/khung nếu có nhiều số xuất hiện.
- "model": Model/ký hiệu sản phẩm (nhãn "Model", "Kiểu loại", "Type").
- "brand": Tên hãng/nhãn hiệu sản xuất (nhãn "Hãng sản xuất", "Nhãn hiệu", "Manufacturer", "Brand").

Quy tắc bắt buộc:
1. Chỉ lấy giá trị thực sự nhìn thấy trên trang; tuyệt đối không suy đoán, không tự bịa, không lấy từ kiến thức ngoài tài liệu.
2. Giữ nguyên định dạng gốc của mã (chữ hoa/thường, dấu gạch ngang, khoảng trắng) như in trên phiếu, không tự chuẩn hóa.
3. Nếu một trường không xuất hiện trên trang hoặc không đọc rõ, trả về chuỗi rỗng "" cho trường đó thay vì đoán.
4. Nếu có nhiều mã số nghi ngờ là sampleCode, chọn mã gắn với nhãn ghi rõ ràng nhất; không chọn số phiếu/số báo cáo (report No.) làm sampleCode trừ khi không có mã nào khác.

Trả về đúng định dạng JSON khớp schema đã cung cấp.
`;

    const response = await generateContentWithRetryAndFallback(
      activeAi,
      {
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType || 'application/pdf', data: base64Data } },
            { text: prompt },
          ],
        },
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sampleCode: { type: Type.STRING },
              model: { type: Type.STRING },
              brand: { type: Type.STRING },
            },
          },
        },
      },
      preferredModel,
    );

    const text = response.text;
    if (!text) throw new Error('AI returned no metadata.');
    const cleanedText = text.split(String.fromCharCode(96)).join('').trim();
    return NextResponse.json({ ...JSON.parse(cleanedText), provider: 'GEMINI' });
  } catch (error: any) {
    console.error('KQTN metadata extraction error:', error);
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
