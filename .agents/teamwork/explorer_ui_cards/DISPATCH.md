## 2026-09-30T04:21:54Z
Bạn là Explorer chuyên trách R1: Rà soát và đối chiếu quy chuẩn UI/UX & Card Components giữa tài liệu đặc tả chuẩn `design.md` và mã nguồn thực tế của hệ thống PGDCN Web App.

Thư mục làm việc của bạn: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_ui_cards`
Tài liệu yêu cầu gốc: `e:\CODING\PGDCN_webapp\.agents\teamwork\ORIGINAL_REQUEST.md` (BẮT BUỘC ĐỌC ĐẦU TIÊN)
Tài liệu phạm vi của orchestrator: `e:\CODING\PGDCN_webapp\.agents\teamwork\orchestrator_2\SCOPE.md`

QUY TẮC BẮT BUỘC (AGENTS.md):
- `design.md` là Single Source of Truth duy nhất.
- Phản hồi và viết báo cáo bằng tiếng Việt.
- TUYỆT ĐỐI KHÔNG sửa mã nguồn và không tạo file code trong workspace. Bạn là read-only Explorer.
- Context routing cho `design.md`: Không đọc toàn bộ file! Chỉ đọc mục 2 (Design tokens, Badge tokens, Typography), mục 3 (Card Components, đặc biệt 3.1.1 Card Hồ Sơ & Đề Nghị TVCI Lab), mục 5 (Layout & View modes).

NHIỆM VỤ CỤ THỂ:
1. Đọc và phân tích kỹ các mục 2, 3 (đặc biệt 3.1.1), 5 trong `design.md`.
2. Kiểm tra và đối chiếu chi tiết với mã nguồn:
   - `components/PcnDossierGroupCard.tsx`
   - `components/PcnWorkspace.tsx`
   - `components/PgdWorkspace.tsx` (đặc biệt `RequestCard` và các component card con)
   - Bất kỳ Card component nào khác liên quan (`components/SampleCard.tsx`, `components/ScheduleCard.tsx` nếu có)
3. Rà soát trọng tâm:
   - Card Hồ sơ & Đề nghị TVCI Lab: cấu trúc thẻ, visual hierarchy, header, metadata, action buttons.
   - Toolbar lọc dạng pill: danh sách pill, active state styling, count badges.
   - Trạng thái màu sắc và badge tokens: đối chiếu class Tailwind thực tế với tokens mục 2.2 / 3.1.1.
   - Icon action: các icon thao tác (xem, sửa, nộp mẫu, KQTN, in...).
   - Tiến độ (`X/Y XONG`): cơ chế tính toán, hiển thị text / thanh tiến trình.
   - Layout lưới 2 cột và chế độ xem Thẻ/Bảng (Card View vs Table View) giữa đặc tả và code.
4. Lập bảng Ma trận đối chiếu chi tiết (Discrepancy Matrix) với các cột:
   | Mục/Dòng design.md | File/Component/Dòng mã nguồn | Đặc tả quy định | Hiện trạng mã nguồn | Đánh giá (Khớp / Lệch / Thiếu trong spec / Thiếu trong code) | Đề xuất giải pháp |
5. Viết báo cáo toàn diện vào: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_ui_cards\report_ui_cards.md` và tạo file tóm tắt `handoff.md` trong thư mục của bạn. Cập nhật `progress.md`.
6. Dùng `send_message` thông báo cho Orchestrator (Recipient: "parent", ID: orchestrator_2) kèm đường dẫn báo cáo khi hoàn thành.
