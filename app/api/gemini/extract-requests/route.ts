// Author: Gemini
// OS support: Web/Node
// Description: Extract requests endpoint using PaddleOCR with Gemini AI fallback

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
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
import { parseRequestOcrText } from '@/utils/ocrTextParsers';
import { isUsableOcrCandidate } from '@/utils/ocrPipeline';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonBadRequest('Yêu cầu không hợp lệ.');
    }

    const { files, refBrands, refCustomers, refProducts } = body || {};
    if (!files || files.length === 0) {
      return jsonBadRequest('Không tìm thấy file gửi lên');
    }

    const paddleCandidates: ServerOcrCandidate[] = [];
    for (const file of files as Array<{ data?: string; fileName?: string; name?: string; mimeType?: string }>) {
      try {
        if (!file?.data) continue;
        paddleCandidates.push(
          await collectPaddleOcr(
            Buffer.from(file.data, 'base64'),
            String(file.fileName || file.name || 'ocr-input.bin'),
            String(file.mimeType || 'application/octet-stream'),
          ),
        );
      } catch (error: any) {
        console.warn('PaddleOCR request extraction unavailable; falling back to Gemini:', error?.message || String(error));
      }
    }

    const paddleRequestText = paddleCandidates.map((c) => c.text).filter(Boolean).join('\n\n');
    const paddleRequestConfidence =
      paddleCandidates.length > 0
        ? paddleCandidates.reduce((sum, c) => sum + c.confidence, 0) / paddleCandidates.length
        : 0;
    const parsedPaddleRequest = parseRequestOcrText(paddleRequestText);
    const hasParsedPaddleRequest = Boolean(
      parsedPaddleRequest.customerInfo.name ||
        parsedPaddleRequest.samples.some((sample) => sample.modelName || sample.brand || sample.type),
    );

    if (isUsableOcrCandidate({ text: paddleRequestText, confidence: paddleRequestConfidence }, 0.75) && hasParsedPaddleRequest) {
      return NextResponse.json({ ...parsedPaddleRequest, provider: 'PADDLEOCR' });
    }

    const brandsList = (refBrands || []).join(', ');
    const customersList = (refCustomers || []).map((c: any) => `"${c.name}"`).join(',\n');
    const productsList =
      (refProducts || []).length > 0
        ? (refProducts || []).join(', ')
        : 'Điều hòa không khí, Tủ lạnh, Máy giặt, Máy nước nóng, Lò vi sóng, Nồi cơm điện, Tivi, Bóng đèn, Quạt điện';

    const prompt = `
        Bạn là trợ lý nhập liệu thông minh cho Kho hàng của phòng Điện - Điện tử.
        Nhiệm vụ: Trích xuất thông tin Giao/Nhận hàng từ hình ảnh (Phiếu giao hàng, Packing List, Hóa đơn, hoặc ảnh chụp tem máy/thùng máy).

        === LOGIC PHÂN LOẠI TÊN MẪU / LOẠI MÁY (type) ===
        Hãy tìm tên loại sản phẩm hoặc tên thiết bị phù hợp nhất trong danh sách sản phẩm sau: [${productsList}].
        Chú ý so sánh từ đồng nghĩa (ví dụ: "bếp từ" -> "Bếp điện từ").
        TUYỆT ĐỐI CẤM tự động gán là "Nồi cơm điện" nếu tài liệu không ghi rõ.
        Nếu sản phẩm không có sự tương đồng nào với danh sách trên, hãy trích xuất CHÍNH XÁC tên loại sản phẩm thực tế được ghi trên chứng từ (ví dụ: "Bếp hồng ngoại đơn", "Máy làm sữa hạt").
        Nếu tài liệu không ghi rõ tên sản phẩm, hãy trả về chuỗi rỗng (""), tuyệt đối không được đoán mò hay mặc định là "Nồi cơm điện" hoặc các loại máy khác.

        === DỮ LIỆU THAM KHẢO ===
        Nhãn hiệu: ${brandsList}
        Khách hàng: ${customersList}

        === YÊU CẦU XỬ LÝ ===
        1. KHÁCH HÀNG: Tìm tên đơn vị gửi/nhận, địa chỉ, sdt, mã số thuế.
           - Đặc biệt tìm tên "Người liên hệ" hoặc "Người đại diện" (contact person).
           - Đối chiếu danh sách tham khảo để lấy tên khách hàng chuẩn xác nhất.
           - Trích xuất "senderUnit" (Đơn vị gửi mẫu thử / Đơn vị yêu cầu thử nghiệm) nếu có ghi rõ trên phiếu/giấy tờ. Nếu không rõ hoặc không có, gán giống như tên Khách hàng (name).
        2. DANH SÁCH HÀNG (QUAN TRỌNG):
           - Tìm tất cả các dòng Model/Sản phẩm trong ảnh.
           - Nếu là ảnh chụp nhiều thùng hàng giống nhau, hãy đếm số lượng thùng để suy ra "quantity".
           - Nếu là văn bản (list), hãy lấy số lượng từ cột Số lượng.
           - "specifications": Trích xuất Điện áp, Gas, Công suất.
           - "standard": Trích xuất thông tin Tiêu chuẩn thử nghiệm / Tiêu chuẩn áp dụng (nếu có).
           - "testCriteria": Trích xuất thông tin Chỉ tiêu thử nghiệm / Hạng mục thử nghiệm (nếu có).
        3. TỰ ĐỘNG NHẬN DIỆN TEM NIÊM PHONG (CỰC KỲ QUAN TRỌNG):
           - Hãy quét thật kỹ tài liệu/hình ảnh xem có xuất hiện thông tin tem niêm phong có tiền tố "IEMM" (Ví dụ: "IEMM...", "IEMM....", "IEMM.26/...", "IEMM/...", "IEMM-...", "IEMM xxxx") hay không. MỌI MÃ BẮT ĐẦU BẰNG TIỀN TỐ "IEMM" DƯỚI BẤT KỲ ĐỊNH DẠNG NÀO ĐỀU LÀ SỐ TEM NIÊM PHONG.
           - TUYỆT ĐỐI CẤM TỰ SUY DIỄN, ĐOÁN HOẶC BỊA RA MÃ TEM NIÊM PHONG NẾU KHÔNG CÓ TRÊN TÀI LIỆU/HÌNH ẢNH. NẾU KHÔNG THẤY THÌ BẮT BUỘC TRẢ VỀ CHUỒI RỖNG "".
           - TUYỆT ĐỐI CẤM sử dụng các ví dụ như "IEMM.26/HQA/1291.2A-SP" làm giá trị trả về nếu tài liệu thực tế không có mã này.
           - Nếu thấy mã thực tế, hãy lấy toàn bộ mã số tem niêm phong đó. CHÚ Ý QUAN TRỌNG: NẾU mã có hậu tố mẫu thử bắt đầu bằng chữ M (Ví dụ: "-M01", "-M02") thì mới loại bỏ hậu tố đó (Ví dụ: "IEMM.26/HQA/1291.2A-SP-M01" thành "IEMM.26/HQA/1291.2A-SP"). NẾU hậu tố KHÔNG BẮT ĐẦU bằng chữ M (Ví dụ: "-01" trong "IEMM.26/EMC/0403-SP-01" hoặc "IEMM....") thì KHÔNG ĐƯỢC CẮT, phải giữ nguyên toàn bộ chuỗi.
           - Trả về chuỗi kết quả này trong trường "sealStamp" ở cấp ngoài cùng của JSON.
        4. NHẬN DIỆN PHÒNG / LOẠI THỬ NGHIỆM (testCategories):
           - Duyệt qua từng sản phẩm (sample) và phân tích các thông tin: "testCriteria", "standard", "type", ghi chú yêu cầu thử nghiệm.
           - Gán mảng các phòng thử nghiệm phù hợp vào trường "testCategories" của từng mẫu:
             * 'EMC': Tương thích điện từ (tiêu chuẩn QCVN 9, CISPR 14, TCVN 7492, IEC 61000, EMI, EMS,...).
             * 'ITD': Hiệu suất năng lượng (tiêu chuẩn TCVN 7830, TCVN 10251, TCVN 7828, CSPF, EER, sao năng lượng,...).
             * 'ITDC': An toàn điện (tiêu chuẩn TCVN 5699, IEC 60335, an toàn điện,...).
    `;

    const parts: any[] = [{ text: prompt }];
    let detectedSealStamp = '';

    for (const file of files) {
      if (file.mimeType?.includes('wordprocessingml') || file.name?.endsWith('.docx')) {
        try {
          const docxBuffer = Buffer.from(file.data, 'base64');
          const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
          const docxText = docxResult.value;
          parts.push({ text: `[Nội dung trích xuất từ file Word]:\n${docxText}` });

          const docxMatch = docxText.match(/IEMM[\.\/\-\s\w]+/i) || docxText.match(/IEMM[A-Za-z0-9._\-\/]+/i);
          if (docxMatch) {
            detectedSealStamp = docxMatch[0].replace(/-M\d+$/i, '').trim().toUpperCase();
          }
        } catch (docxErr: any) {
          console.error('Lỗi đọc file DOCX qua mammoth:', docxErr);
          parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
        }
      } else {
        parts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      }
    }

    const activeAi = await getPersonalGeminiClient(req);
    const preferredModel = await getPersonalGeminiModel(req);
    const response = await generateContentWithRetryAndFallback(
      activeAi,
      {
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customerInfo: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  senderUnit: { type: Type.STRING },
                  address: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  taxId: { type: Type.STRING },
                  contactPerson: { type: Type.STRING },
                },
              },
              sealStamp: { type: Type.STRING },
              sampleCondition: { type: Type.STRING },
              postTestHandling: { type: Type.STRING },
              resultCopyCount: { type: Type.INTEGER },
              samples: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    modelName: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    type: { type: Type.STRING },
                    quantity: { type: Type.INTEGER },
                    specifications: { type: Type.STRING },
                    standard: { type: Type.STRING },
                    testCriteria: { type: Type.STRING },
                    testCategories: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                      description: "Loại thử nghiệm/phòng thử nghiệm: ['EMC'], ['ITD'], ['EMC', 'ITD'], ['ITDC'], hoặc []",
                    },
                  },
                },
              },
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

    if (parsed.sealStamp) {
      const cleanSeal = parsed.sealStamp.trim().replace(/-M\d+$/i, '').toUpperCase();
      if (
        cleanSeal === 'IEMM.26/HQA/1291.2A-SP' ||
        cleanSeal === 'IEMM.26/EMC/0403-SP-01' ||
        cleanSeal.includes('VÍ DỤ') ||
        cleanSeal.includes('VIDU') ||
        cleanSeal.includes('EXAMPLE') ||
        cleanSeal.includes('KHÔNG THẤY') ||
        cleanSeal.includes('KHONGTHAY') ||
        cleanSeal.includes('NULL') ||
        cleanSeal.includes('UNDEFINED')
      ) {
        parsed.sealStamp = '';
      } else {
        parsed.sealStamp = cleanSeal;
      }
    } else {
      parsed.sealStamp = '';
    }

    if (detectedSealStamp && !parsed.sealStamp) {
      parsed.sealStamp = detectedSealStamp;
    }

    return NextResponse.json({ ...parsed, provider: 'GEMINI' });
  } catch (error: any) {
    console.error('Gemini Extraction Error:', error);
    let errMsg = error.message || 'Lỗi trích xuất AI';
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
