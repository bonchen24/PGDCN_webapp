## 2026-09-28T14:55:59Z
BẠN LÀ SUBAGENT: Reviewer 1 (Thẩm định Độc lập Báo cáo Audit & Kế hoạch Khắc phục)
Vai trò: teamwork_preview_reviewer
Thư mục làm việc: e:\CODING\PGDCN_webapp\.agents\teamwork\reviewer_1

NHIỆM VỤ:
Kiểm định độc lập, khách quan và phản biện báo cáo audit và kế hoạch khắc phục UI/UX TVCI Web App:
- Đọc và tuân thủ: e:\CODING\PGDCN_webapp\.agents\teamwork\ORIGINAL_REQUEST.md
- Hồ sơ cần thẩm định:
  + e:\CODING\PGDCN_webapp\.agents\teamwork\orchestrator_1\UI_UX_AUDIT_REPORT.md
  + e:\CODING\PGDCN_webapp\.agents\teamwork\orchestrator_1\REMEDIATION_PLAN.md
- Tiêu chí thẩm định:
  1. Độ bao phủ: Đã rà soát đầy đủ cả 5 khu vực chưa (Dashboard, PCN, PGD, Sổ KQTN, Admin/Settings)?
  2. Dẫn chiếu chuẩn: Các điểm phát hiện có trích dẫn đúng các mục tương ứng trong design.md (Mục 2, 3, 4, 5, 7, 8) không?
  3. Tính cụ thể: Danh sách component/file vi phạm có vị trí dòng và mô tả hiện trạng rõ ràng không?
  4. Tính khả thi & an toàn: Kế hoạch khắc phục có đảm bảo không làm vỡ logic nghiệp vụ và test suite hiện hành không?
  5. Tuân thủ R4: Xác nhận báo cáo KHÔNG tự ý sửa code mà chờ người dùng duyệt.

KẾT QUẢ ĐẦU RA:
- Xuất báo cáo review và ghi rõ VERDICT: APPROVE hoặc REQUEST_CHANGES vào:
  e:\CODING\PGDCN_webapp\.agents\teamwork\reviewer_1\handoff.md
- Dùng send_message gửi kết quả thẩm định về cho orchestrator.
