// Author: Gemini
// OS support: Web/Node
// Description: Extract test results endpoint using PaddleOCR with Gemini AI fallback

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
import { parseTestResultsOcrText } from '@/utils/ocrTextParsers';
import { isUsableOcrCandidate } from '@/utils/ocrPipeline';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonBadRequest('Yêu cầu không hợp lệ.');
    }

    const { base64Data, mimeType } = body || {};
    if (!base64Data) {
      return jsonBadRequest('Thiếu dữ liệu file');
    }

    const fileMimeType = String(mimeType || 'application/pdf');
    const paddleResult = await collectPaddleOcr(
      Buffer.from(String(base64Data).replace(/^data:[^;]+;base64,/i, ''), 'base64'),
      fileMimeType.includes('pdf') ? 'kqtn-result.pdf' : 'kqtn-result-image',
      fileMimeType,
    ).catch((error: any) => {
      console.warn('PaddleOCR result extraction unavailable; falling back to Gemini:', error?.message || String(error));
      return { text: '', confidence: 0 } satisfies ServerOcrCandidate;
    });

    const parsedPaddleResults = parseTestResultsOcrText(paddleResult.text);
    if (isUsableOcrCandidate(paddleResult, 0.75) && Object.keys(parsedPaddleResults).length > 0) {
      return NextResponse.json({ ...parsedPaddleResults, provider: 'PADDLEOCR' });
    }

    const prompt = `
        Phân tích báo cáo thử nghiệm của phòng Điện - Điện tử. Hãy trích xuất các thông tin sau:
        - "serialNumber": Số Serial của máy thử nghiệm.
        - "measuredCapacity": Công suất lạnh định mức (W) đo được. Nếu đơn vị BTU/h hãy đổi sang W (BTU/3.412).
        - "measuredPower": Công suất điện tiêu thụ (W) đo được.
        - "cspf": Chỉ số hiệu suất năng lượng CSPF.
        - "energyLevel": Cấp sao năng lượng đạt được (từ 1 đến 5).
        Trả về kết quả dưới định dạng JSON khớp chính xác các trường trên.
    `;

    const activeAi = await getPersonalGeminiClient(req);
    const preferredModel = await getPersonalGeminiModel(req);
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
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              serialNumber: { type: Type.STRING },
              measuredCapacity: { type: Type.NUMBER },
              measuredPower: { type: Type.NUMBER },
              cspf: { type: Type.NUMBER },
              energyLevel: { type: Type.NUMBER },
            },
          },
        },
      },
      preferredModel,
    );

    const text = response.text;
    if (!text) throw new Error('AI không trả về kết quả');

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedText);
    return NextResponse.json({ ...parsed, provider: 'GEMINI' });
  } catch (error: any) {
    console.error('Gemini Result Extraction Error:', error);
    let errMsg = error.message || 'Lỗi trích xuất kết quả';
    if (typeof errMsg === 'string' && (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE'))) {
      errMsg = 'Máy chủ AI hiện đang quá tải. Hệ thống đã tự động thử lại nhưng chưa thành công. Vui lòng thử lại sau giây lát.';
    }
    const status = getOcrErrorStatus(error);
    return NextResponse.json(
      {
        code: status === 503 && error?.message === GEMINI_API_KEY_MISSING_MESSAGE ? 'GEMINI_API_KEY_MISSING' : undefined,
        error: errMsg,
      },
      { status },
    );
  }
}
