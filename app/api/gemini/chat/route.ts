// Author: Gemini
// OS support: Web/Node
// Description: Gemini AI Lab chat endpoint

import { NextRequest, NextResponse } from 'next/server';
import { jsonBadRequest, jsonError, jsonOk } from '@/lib/server/response';
import {
  createChatWithRetryAndFallback,
  getGeminiClient,
} from '@/lib/server/gemini';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  const { message, history, appContext } = body || {};
  if (!message) {
    return jsonBadRequest('Thiếu câu hỏi người dùng');
  }

  const systemInstruction = `
Bạn là Trợ lý AI chuyên nghiệp, nhiệt tình của phòng Điện - Điện tử.
Nhiệm vụ của bạn là hỗ trợ các Kỹ thuật viên (KTV), Quản lý, và Khách hàng trong việc tra cứu thông tin phiếu yêu cầu, tình trạng mẫu thử và giải đáp các thắc mắc về kỹ thuật hay tiêu chuẩn điện.

=== DỮ LIỆU THỜI GIAN THỰC CỦA PHÒNG LAB ===
Dưới đây là thông tin hiện tại từ hệ thống phòng Lab để bạn tham khảo giải quyết câu hỏi:
${appContext || 'Chưa có thông tin hoặc hệ thống đang trống.'}

=== QUY TẮC TRẢ LỜI ===
1. Hãy giao tiếp bằng tiếng Việt chuẩn mực, thân thiện, rõ ràng, có cấu trúc tốt.
2. Dùng dữ liệu thời gian thực được cung cấp để trả lời các yêu cầu tra cứu của người dùng về Số phiếu, Model sản phẩm, hoặc Tem niêm phong. Khi tìm thấy thông tin, hãy cung cấp rõ ràng: 
   - Số phiếu, Model, Tên mẫu, Khách hàng.
   - Trạng thái xử lý và Lịch thử nghiệm.
   - Kỹ thuật viên phụ trách.
   - Mã hóa mẫu thử.
3. Nếu không tìm thấy thông tin phù hợp, hãy thông báo rõ ràng là không tìm thấy và đề nghị người dùng kiểm tra lại mã hoặc thông tin tra cứu.
4. Trả lời bằng Markdown rõ ràng, dùng tiêu đề (h3), in đậm để phân chia thông tin và tạo sự chuyên nghiệp. Tránh trả lời quá dài dòng nhưng phải đủ chi tiết.
`;

  try {
    const formattedHistory = (history || []).map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const activeAi = await getGeminiClient(req);
    const preferredModel = (req.headers.get('x-gemini-model') as string) || undefined;

    const response = await createChatWithRetryAndFallback(
      activeAi,
      {
        config: {
          systemInstruction,
          temperature: 0.7,
        },
        history: formattedHistory,
      },
      message,
      preferredModel,
    );

    const text = response.text || '';
    return jsonOk({ response: text });
  } catch (error: any) {
    console.error('Chat error:', error);
    return jsonError(error?.message || 'Chat error', 500);
  }
}
