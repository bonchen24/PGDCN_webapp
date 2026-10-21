## 2026-09-30T04:21:54Z
Bạn là Explorer chuyên trách R2.1: Rà soát và đối chiếu Data Models, Schema, Lifecycle & Business Rules giữa tài liệu đặc tả chuẩn `design.md` và mã nguồn thực tế của hệ thống PGDCN Web App.

Thư mục làm việc của bạn: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_data_lifecycle`
Tài liệu yêu cầu gốc: `e:\CODING\PGDCN_webapp\.agents\teamwork\ORIGINAL_REQUEST.md` (BẮT BUỘC ĐỌC ĐẦU TIÊN)
Tài liệu phạm vi của orchestrator: `e:\CODING\PGDCN_webapp\.agents\teamwork\orchestrator_2\SCOPE.md`

QUY TẮC BẮT BUỘC (AGENTS.md):
- `design.md` là Single Source of Truth duy nhất.
- Phản hồi và viết báo cáo bằng tiếng Việt.
- TUYỆT ĐỐI KHÔNG sửa mã nguồn và không tạo file code trong workspace. Bạn là read-only Explorer.
- Context routing cho `design.md`: Không đọc toàn bộ file! Chỉ đọc mục 0 (PGDCN Active Profile), mục 0A (PGD Active Profile), mục 6 (Data Models & Schema).

NHIỆM VỤ CỤ THỂ:
1. Đọc và phân tích kỹ các mục 0, 0A, 6 trong `design.md`.
2. Kiểm tra và đối chiếu chi tiết với mã nguồn:
   - `types.ts`
   - `utils/pgdDomain.ts`
   - `utils/pgdDossier.ts`
   - `utils/pcnWorkflowTopology.ts`
   - `utils/pcnDossierPolicy.ts`
3. Rà soát trọng tâm:
   - Data models & Schema: cấu trúc interface/type, các trường bắt buộc, kiểu dữ liệu, các quan hệ (Dossier, Sample, TestRequest, InspectionRequest, Schedule, Log, KQTN...).
   - Lifecycle & State transitions: các trạng thái của hồ sơ PCN vs hồ sơ PGD, luồng chuyển đổi trạng thái hợp lệ.
   - Business Rules:
     * QC4, QC9 cho phân hệ PCN (Chứng nhận).
     * QC20, STEEL_METAL, MACHINERY_LINE, COAL cho phân hệ PGD (Giám định).
     * Ranh giới tách biệt giữa PCN và PGD: xác minh tính độc lập, không lẫn lộn dữ liệu hoặc logic giữa 2 phân hệ.
4. Lập bảng Ma trận đối chiếu chi tiết (Discrepancy Matrix) với các cột:
   | Mục/Dòng design.md | File/Interface/Hàm/Dòng mã nguồn | Đặc tả quy định | Hiện trạng mã nguồn | Đánh giá (Khớp / Lệch / Thiếu trong spec / Thiếu trong code) | Đề xuất giải pháp |
5. Viết báo cáo toàn diện vào: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_data_lifecycle\report_data_lifecycle.md` và tạo file tóm tắt `handoff.md` trong thư mục của bạn. Cập nhật `progress.md`.
6. Dùng `send_message` thông báo cho Orchestrator (Recipient: "parent", ID: orchestrator_2) kèm đường dẫn báo cáo khi hoàn thành.
