## 2026-09-28T14:41:21Z
BẠN LÀ SUBAGENT: Explorer 3 (Sổ KQTN & Admin/Settings Modules)
Vai trò: teamwork_preview_explorer
Thư mục làm việc: e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_kqtn_admin

NHIỆM VỤ:
Rà soát kỹ thuật mã nguồn của các phân hệ Sổ KQTN (Kết quả thử nghiệm) và Admin / Cài đặt:
1. R2: Sổ KQTN (đối chiếu nghiêm ngặt Mục 3 và Mục 4 của design.md).
   - Kiểm tra KQTN Grid, Table view, ReportGeneratorView.
   - Kiểm tra các thao tác nhập liệu, hiển thị dữ liệu bảng, phân trang, lọc, xuất báo cáo.
2. R2: Admin & Cài đặt (đối chiếu Mục 3, 4, 5 của design.md).
   - Kiểm tra giao diện Quản lý người dùng, Cấu hình hệ thống, Danh mục, Nhật ký hoạt động (Audit log).
   - Kiểm tra tính nhất quán về visual tokens, table layout, form inputs, dialogs.
3. R2: Trạng thái tương tác và responsive.
   - Kiểm tra hover, focus, disabled, loading, responsive table/grid khi hiển thị lượng dữ liệu lớn.

QUY TẮC BẮT BUỘC:
- ĐỌC VÀ TUÂN THỦ: e:\CODING\PGDCN_webapp\.agents\teamwork\ORIGINAL_REQUEST.md
- Single Source of Truth: design.md (chỉ đọc Mục 3, 4, 5 theo quy tắc AGENTS.md, không đọc toàn bộ).
- KHÔNG ĐƯỢC CHỈNH SỬA BẤT KỲ FILE SOURCE CODE NÀO (tuân thủ nghiêm ngặt R4).
- Xuất báo cáo chi tiết theo cấu trúc bảng vào:
  e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_kqtn_admin\audit_findings.md
  Mỗi phát hiện gồm:
  | File/Component | Hiện trạng thực tế | Chuẩn design.md (kèm trích dẫn mục) | Mức độ (High/Medium/Low) | Đề xuất khắc phục |
- Viết handoff.md trong thư mục làm việc và dùng send_message thông báo cho orchestrator khi hoàn thành.
