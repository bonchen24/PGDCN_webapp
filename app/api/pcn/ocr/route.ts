// Author: Gemini
// OS support: Web/Node
// Description: PCN OCR endpoint with PaddleOCR and Gemini fallback

import { NextRequest, NextResponse } from 'next/server';
import { requirePcnSession } from '@/lib/server/auth';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { pool } from '@/lib/server/postgres';
import { mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { normalizePcnSettings } from '@/utils/pcnSettings';
import { isPcnOcrFileSupported } from '@/utils/pcnOcrPolicy';
import { isUsableOcrCandidate, runPaddleFirstWithGeminiFallback } from '@/utils/ocrPipeline';
import {
  ServerOcrCandidate,
  buildPcnOcrDraftFromText,
  collectPaddleOcr,
  getOcrErrorStatus,
} from '@/lib/server/ocr';
import {
  GEMINI_API_KEY_MISSING_MESSAGE,
  Type,
  generateContentWithRetryAndFallback,
  getPersonalGeminiClient,
  getPersonalGeminiModel,
} from '@/lib/server/gemini';

export async function POST(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('OCR PCN chỉ khả dụng trong profile PCN.');
  }

  const sessionError = requirePcnSession(req);
  if (sessionError) return sessionError;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  const context = body?.context === 'result' ? 'result' : body?.context === 'proposal' ? 'proposal' : '';
  const fileName = String(body?.fileName || '').trim().slice(0, 255);
  const mimeType = String(body?.mimeType || 'application/octet-stream').toLowerCase().trim();
  const base64Data = String(body?.base64Data || '').replace(/^data:[^;]+;base64,/i, '');

  if (!context || !fileName || !base64Data || !isPcnOcrFileSupported(mimeType, fileName)) {
    return jsonBadRequest('OCR PCN cần context, tên file và file PDF/DOCX/PNG/JPG/JPEG hợp lệ.');
  }

  const fileBuffer = Buffer.from(base64Data, 'base64');
  if (fileBuffer.length === 0 || fileBuffer.length > 25 * 1024 * 1024) {
    return jsonError('File OCR PCN phải lớn hơn 0 và không quá 25 MB.', 413);
  }

  try {
    const settingsResult = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'systemConfig' AND document_id = $1
       LIMIT 1`,
      ['pcn-settings'],
    );
    const settings = normalizePcnSettings(settingsResult.rows[0] ? mapDocumentRow(settingsResult.rows[0]) : {});
    if (!settings.ocr.enabled || settings.ocr.provider === 'DISABLED') {
      return jsonError('OCR PCN đang được tắt trong Cài đặt PCN.', 409);
    }

    const sourcePage = Math.max(1, Math.floor(Number(body?.pageNumber) || 1));
    const ocrResult = await runPaddleFirstWithGeminiFallback<ServerOcrCandidate>({
      confidenceThreshold: settings.ocr.confidenceThreshold,
      paddle: () => collectPaddleOcr(fileBuffer, fileName, mimeType, body?.pageNumber ? sourcePage : undefined),
      gemini: async () => {
        const ai = await getPersonalGeminiClient(req);
        const prompt = context === 'proposal'
          ? 'Đọc tài liệu Đề nghị chứng nhận PCN. Chỉ chép lại chữ nhìn thấy, không suy đoán. Trả JSON có trường text chứa toàn bộ nội dung đọc được theo dòng.'
          : 'Đọc báo cáo KQTN của PCN. Chỉ chép lại chữ nhìn thấy, không suy đoán. Trả JSON có trường text chứa toàn bộ nội dung đọc được theo dòng.';
        const response = await generateContentWithRetryAndFallback(
          ai,
          {
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType: mimeType === 'application/octet-stream' ? 'application/pdf' : mimeType,
                    data: base64Data,
                  },
                },
                { text: prompt },
              ],
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } },
            },
          },
          await getPersonalGeminiModel(req),
        );
        const raw = String(response.text || '').replace(/```json|```/g, '').trim();
        return { text: String(JSON.parse(raw)?.text || ''), confidence: 0.78 };
      },
      isUsable: (candidate, threshold) => isUsableOcrCandidate(candidate, threshold),
    });

    const extractedText = ocrResult.value.text;
    const confidence = ocrResult.value.confidence;
    if (!extractedText.trim()) {
      return jsonError('OCR không nhận diện được nội dung rõ ràng.', 422);
    }

    return jsonOk({
      provider: ocrResult.provider,
      draft: buildPcnOcrDraftFromText(extractedText, context, fileName, sourcePage, confidence),
    });
  } catch (error: any) {
    console.error('PCN OCR error:', error?.message || String(error));
    const statusCode = getOcrErrorStatus(error);
    const missingKey = error?.message === GEMINI_API_KEY_MISSING_MESSAGE;
    return NextResponse.json(
      {
        code: missingKey ? 'GEMINI_API_KEY_MISSING' : statusCode === 503 ? 'PCN_OCR_UNAVAILABLE' : 'PCN_OCR_FAILED',
        error: missingKey
          ? GEMINI_API_KEY_MISSING_MESSAGE
          : statusCode === 503
          ? 'Dịch vụ OCR PCN hiện không sẵn sàng.'
          : String(error?.message || error),
      },
      { status: statusCode },
    );
  }
}
