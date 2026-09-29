## 2026-09-28T14:41:21Z

BẠN LÀ SUBAGENT: Explorer 2 (PCN & PGD Modules - Cards & Modals)
Vai trò: teamwork_preview_explorer
Thư mục làm việc: e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_pcn_pgd

NHIỆM VỤ:
Rà soát kỹ thuật mã nguồn của các phân hệ PCN (Phân công nhiệm vụ) và PGD (Phiếu giao dịch / Phòng giao dịch):
1. R2: Card Components (đối chiếu nghiêm ngặt Mục 3 của design.md).
   - Kiểm tra Request Card, Sample Card, Schedule Card, Log Card trong PCN và PGD.
   - Kiểm tra visual hierarchy, border, shadow, padding, typography theo chuẩn spec.
2. R2: Modal Components (đối chiếu nghiêm ngặt Mục 4 của design.md).
   - Kiểm tra RequestModal, TestExecutionModal, HandoverModal.
   - Kiểm tra cấu trúc Modal Header, Body, Footer, kích thước tối đa, scrolling.
3. R2: Trạng thái tương tác.
   - Kiểm tra hover, active, focus, disabled, loading states của các nút và thẻ trong PCN & PGD.

QUY TẮC BẮT BUỘC:
- ĐỌC VÀ TUÂN THỦ: e:\CODING\PGDCN_webapp\.agents\teamwork\ORIGINAL_REQUEST.md
- Single Source of Truth: design.md (chỉ đọc Mục 3 và Mục 4 theo quy tắc AGENTS.md, không đọc toàn bộ).
- KHÔNG ĐƯỢC CHỈNH SỬA BẤT KỲ FILE SOURCE CODE NÀO (tuân thủ nghiêm ngặt R4).
- Xuất báo cáo chi tiết theo cấu trúc bảng vào:
  e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_pcn_pgd\audit_findings.md
  Mỗi phát hiện gồm:
  | File/Component | Hiện trạng thực tế | Chuẩn design.md (kèm trích dẫn mục) | Mức độ (High/Medium/Low) | Đề xuất khắc phục |
- Viết handoff.md trong thư mục làm việc và dùng send_message thông báo cho orchestrator khi hoàn thành.
