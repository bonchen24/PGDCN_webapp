// Author: Gemini
// OS support: Web/Node
// Description: Gemini translation and nameplate OCR generation endpoint

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
  getGeminiClient,
  getPersonalGeminiClient,
  getPersonalGeminiModel,
} from '@/lib/server/gemini';
import { parseNameplateOcrText } from '@/utils/ocrTextParsers';
import { isUsableOcrCandidate } from '@/utils/ocrPipeline';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  const { action, viName, base64, base64s } = body || {};

  try {
    if (action === 'translate') {
      const activeAi = await getGeminiClient(req);
      const preferredModel = (req.headers.get('x-gemini-model') as string) || undefined;
      const response = await generateContentWithRetryAndFallback(
        activeAi,
        {
          contents: `Dịch tên thiết bị sau sang tiếng Anh: "${viName}". Chỉ trả về tên tiếng Anh.`,
        },
        preferredModel,
      );
      return NextResponse.json({ text: response.text });
    }

    if (action === 'ocr') {
      const imagesList: string[] =
        Array.isArray(base64s) && base64s.length > 0 ? base64s : base64 ? [base64] : [];

      if (imagesList.length === 0) {
        return jsonBadRequest('Không có hình ảnh để thực hiện OCR');
      }

      const paddleCandidates: ServerOcrCandidate[] = [];
      for (const [index, image] of imagesList.entries()) {
        try {
          const cleanB64 = image.includes(',') ? image.split(',')[1] : image;
          paddleCandidates.push(
            await collectPaddleOcr(Buffer.from(cleanB64, 'base64'), `nameplate-${index + 1}.jpg`, 'image/jpeg'),
          );
        } catch (error: any) {
          console.warn('PaddleOCR nameplate extraction unavailable; falling back to Gemini:', error?.message || String(error));
        }
      }

      const paddleNameplateText = paddleCandidates.map((c) => c.text).filter(Boolean).join('\n\n');
      const paddleNameplateConfidence =
        paddleCandidates.length > 0
          ? paddleCandidates.reduce((sum, c) => sum + c.confidence, 0) / paddleCandidates.length
          : 0;
      const parsedPaddleNameplate = parseNameplateOcrText(paddleNameplateText);

      if (
        isUsableOcrCandidate({ text: paddleNameplateText, confidence: paddleNameplateConfidence }, 0.75) &&
        Object.values(parsedPaddleNameplate).some(Boolean)
      ) {
        return NextResponse.json({ text: JSON.stringify(parsedPaddleNameplate), provider: 'PADDLEOCR' });
      }

      const promptText = `Trích xuất toàn bộ thông tin kỹ thuật từ hình ảnh tem mác/nhãn sản phẩm này của thiết bị điện.
HƯỚNG DẪN QUAN TRỌNG:
1. Nhận diện Tem Niêm Phong (sealStamp):
   - Tìm và trích xuất mã số/ký hiệu tem niêm phong có tiền tố IEMM (dạng IEMM...., IEMM/..., IEMM.xx/..., IEMM-..., IEMM xxxx) hoặc tem niêm phong mẫu, niêm chì, mã vạch tem niêm phong. Mọi mã bắt đầu bằng tiền tố IEMM dưới bất kỳ dạng nào đều là Số tem niêm phong.
   - Nếu có nhiều tem niêm phong trên các ảnh, hãy ghép chúng lại (vd: "IEMM.26/01, IEMM.26/02").
2. Xử lý Thiết Bị Nhiều Cụm (Đặc biệt là Máy điều hòa không khí gồm Khối trong nhà / Dàn lạnh / Indoor Unit và Khối ngoài trời / Dàn nóng / Outdoor Unit, hoặc Bộ nguồn và Thân máy):
   - Trích xuất mã model của từng cụm (nếu nhận diện được cụm dàn lạnh thì điền indoorModel, cụm dàn nóng thì điền outdoorModel).
   - Tổng hợp trường "model" chuẩn theo quy cách phòng thử nghiệm: ví dụ "[Model Bộ]" hoặc "[Model Dàn Lạnh] / [Model Dàn Nóng]" hoặc "[Model Tổng] (Dàn lạnh: [Model 1] / Dàn nóng: [Model 2])".
   - Tổng hợp thông số kỹ thuật (điện áp, tần số, công suất, dòng điện, công suất làm lạnh/sưởi ấm, môi chất lạnh).
3. Trích xuất riêng "manufacturer" (Nhà sản xuất) và "countryOfOrigin" (Nước sản xuất / Made in). Nếu không có thông tin thì trả về chuỗi rỗng ""; trường "origin" chỉ giữ làm alias tương thích ngược.`;

      const parts: any[] = [{ text: promptText }];
      for (const img of imagesList) {
        const cleanB64 = img.includes(',') ? img.split(',')[1] : img;
        parts.push({
          inlineData: { data: cleanB64, mimeType: 'image/jpeg' },
        });
      }

      const activeAi = await getPersonalGeminiClient(req);
      const preferredModel = await getPersonalGeminiModel(req);
      const response = await generateContentWithRetryAndFallback(
        activeAi,
        {
          contents: [{ parts }],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                brand: { type: Type.STRING, description: 'Thương hiệu / Nhãn hiệu (Brand)' },
                model: { type: Type.STRING, description: 'Kiểu loại / Mã Model tổng thể hoặc kết hợp' },
                indoorModel: { type: Type.STRING, description: 'Mã model dàn lạnh / khối trong nhà (nếu có)' },
                outdoorModel: { type: Type.STRING, description: 'Mã model dàn nóng / khối ngoài trời (nếu có)' },
                sealStamp: { type: Type.STRING, description: 'Mã số tem niêm phong / niêm chì (nếu có)' },
                voltage: { type: Type.STRING, description: 'Điện áp danh định (vd 220-240V, 220V~)' },
                frequency: { type: Type.STRING, description: 'Tần số danh định (vd 50Hz, 50-60Hz)' },
                power: { type: Type.STRING, description: 'Công suất danh định (vd 2000W, 1800W)' },
                current: { type: Type.STRING, description: 'Dòng điện danh định (vd 8.5A, 10A)' },
                clockFreq: { type: Type.STRING, description: 'Tần số xung nhịp lớn nhất (< 30MHz)' },
                coolingHeatingPower: { type: Type.STRING, description: 'Công suất làm lạnh / sưởi ấm (nếu có)' },
                manufacturer: { type: Type.STRING, description: 'Nhà sản xuất (Manufacturer)' },
                countryOfOrigin: { type: Type.STRING, description: 'Nước sản xuất / Made in / Country of origin' },
                origin: { type: Type.STRING, description: 'Nguồn gốc / Made in / Xuất xứ; alias tương thích ngược' },
                ipRating: { type: Type.STRING, description: 'Chỉ số bảo vệ kháng nước IP (vd IPX0, IP25, IPX4)' },
              },
              required: [
                'brand',
                'model',
                'voltage',
                'frequency',
                'power',
                'current',
                'clockFreq',
                'manufacturer',
                'countryOfOrigin',
                'origin',
                'ipRating',
                'sealStamp',
              ],
            },
          },
        },
        preferredModel,
      );
      return NextResponse.json({ text: response.text, provider: 'GEMINI' });
    }

    return jsonBadRequest('Invalid action');
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    const status = getOcrErrorStatus(error);
    return NextResponse.json(
      {
        code: status === 503 && error?.message === GEMINI_API_KEY_MISSING_MESSAGE ? 'GEMINI_API_KEY_MISSING' : undefined,
        error: String(error.message || error),
      },
      { status },
    );
  }
}
