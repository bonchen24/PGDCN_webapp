## 2026-09-30T04:21:54Z
Bạn là Explorer chuyên trách R2.2: Rà soát và đối chiếu Hợp đồng API, Server Implementation, Profile Active & Security/RBAC giữa tài liệu đặc tả chuẩn `design.md` và mã nguồn thực tế của hệ thống PGDCN Web App.

Thư mục làm việc của bạn: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_api_contracts`
Tài liệu yêu cầu gốc: `e:\CODING\PGDCN_webapp\.agents\teamwork\ORIGINAL_REQUEST.md` (BẮT BUỘC ĐỌC ĐẦU TIÊN)
Tài liệu phạm vi của orchestrator: `e:\CODING\PGDCN_webapp\.agents\teamwork\orchestrator_2\SCOPE.md`

QUY TẮC BẮT BUỘC (AGENTS.md):
- `design.md` là Single Source of Truth duy nhất.
- Phản hồi và viết báo cáo bằng tiếng Việt.
- TUYỆT ĐỐI KHÔNG sửa mã nguồn và không tạo file code trong workspace. Bạn là read-only Explorer.
- Context routing cho `design.md`: Không đọc toàn bộ file! Chỉ đọc mục 0, mục 0A, mục 7 (Bảo mật, phân quyền, API contracts, lưu trữ/sync), và mục 10 (nếu liên quan đến sync/local store).

NHIỆM VỤ CỤ THỂ:
1. Đọc và phân tích kỹ các mục 0, 0A, 7 (và mục 10 nếu liên quan) trong `design.md`.
2. Kiểm tra và đối chiếu chi tiết với mã nguồn:
   - `server.ts`
   - Các API route handler cho PCN và PGD
   - Middleware bảo mật, xác thực (auth), phân quyền (RBAC, role matrix)
   - Cơ chế persistence, sync dữ liệu, backup và phân tách dữ liệu PCN vs PGD trên server
3. Rà soát trọng tâm:
   - Active Profiles (Mục 0 & 0A): kiểm tra cấu hình runtime, môi trường, cờ tính năng phân hệ PCN và PGD.
   - Hợp đồng API: danh sách endpoints (POST, GET, PUT, DELETE), URL paths, request body schema, response payload, mã lỗi HTTP so với mục 7.
   - Bảo mật & Phân quyền: kiểm tra ma trận phân quyền RBAC giữa vai trò (Admin, Inspector, Certification Officer, Lab Staff, Guest...), kiểm tra xem code có áp dụng đúng permission checks hay không.
   - Ranh giới phân hệ API: các route `/api/pcn/*` vs `/api/pgd/*` có được tách biệt rạch ròi không.
4. Lập bảng Ma trận đối chiếu chi tiết (Discrepancy Matrix) với các cột:
   | Mục/Dòng design.md | File/Endpoint/Hàm/Dòng mã nguồn | Đặc tả quy định | Hiện trạng mã nguồn | Đánh giá (Khớp / Lệch / Thiếu trong spec / Thiếu trong code) | Đề xuất giải pháp |
5. Viết báo cáo toàn diện vào: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_api_contracts\report_api_contracts.md` và tạo file tóm tắt `handoff.md` trong thư mục của bạn. Cập nhật `progress.md`.
6. Dùng `send_message` thông báo cho Orchestrator (Recipient: "parent", ID: orchestrator_2) kèm đường dẫn báo cáo khi hoàn thành.
