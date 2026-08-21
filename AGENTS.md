<!--
Author: Gemini
OS support: Web/Node
Description: Quy tắc và chỉ dẫn bắt buộc cho AI Agent tuân thủ tài liệu design.md và quy chuẩn dự án DDT Lab
-->

# AGENT INSTRUCTIONS & COMPLIANCE RULES

## 1. NGUYÊN TẮC TỐI CAO (SINGLE SOURCE OF TRUTH)
- **`design.md`** là tài liệu chuẩn duy nhất (Single Source of Truth) định nghĩa toàn bộ kiến trúc, dữ liệu, thiết kế giao diện (UI/UX Cards, Badge Tokens) và quy chuẩn mã nguồn cho dự án này.
- Khi thực hiện bất kỳ yêu cầu phát triển hoặc chỉnh sửa nào, Agent **BẮT BUỘC** phải tham chiếu và tuân thủ tuyệt đối các quy định trong `design.md`.

## 2. QUY TRÌNH PHÁT TRIỂN & CẬP NHẬT
1. **Kiểm tra Spec**: Đối chiếu yêu cầu người dùng với `design.md`.
2. **Cập nhật Document trước**: Nếu có thay đổi về luồng nghiệp vụ, schema hoặc UI, phải được người dùng xác nhận và cập nhật vào `design.md` trước.
3. **Thực thi Code**: Sửa đổi code chuẩn xác theo `design.md`.
4. **Quy chuẩn Header/Footer**:
   - Thêm Header ở dòng đầu tiên: `// Author: Gemini` / `// OS support: Web/Node` / `// Description: ...`
   - Thêm Footer ở dòng cuối cùng: `// --- End of [filename] ---`
   - Xóa toàn bộ comment cũ không cần thiết.

<!-- --- End of AGENTS.md --- -->
