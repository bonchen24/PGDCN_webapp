# PCN — Memory note: gán người thực hiện hồ sơ

> Ngày: 2026-09-06  
> Commit: `647debe` — `feat: add PCN dossier assignment workflow`  
> Lưu ý: đây là nhật ký ghi nhớ để tra cứu nhanh, không thay thế `design.md`.

## Quy tắc nghiệp vụ đã chốt

- Chỉ **Đề nghị** tạo hồ sơ mới; mỗi Đề nghị tạo đúng một hồ sơ.
- PYC mới liên kết vào hồ sơ hiện có, không tạo hồ sơ thứ hai.
- Hồ sơ mới bắt đầu với `ownerUsername` rỗng và hiển thị “Chưa gán người thực hiện”.
- Admin/Quản lý chọn người thực hiện từ danh sách nhân viên PCN đang hoạt động, không phải viewer, và có đủ phạm vi field của hồ sơ.
- Nhân viên thuộc phòng ban có thể bấm “Nhận hồ sơ” để tự gán tên mình khi hồ sơ chưa có người thực hiện.
- Nhân viên chỉ được thao tác hồ sơ đã gắn tên mình; hồ sơ chưa gán hoặc gắn tên người khác chỉ ở chế độ xem.

## Phạm vi đã triển khai

- Policy dùng chung cho lọc người được gán, quyền chuyển chủ hồ sơ và quyền thao tác.
- API server áp dụng operator guard cho các mutation của dossier, proposal, PYC/KQTN, sample, tài liệu và kết quả.
- Guard workflow khóa mutation của nhân viên trên hồ sơ chưa gán hoặc không thuộc mình, kể cả nhánh exception.
- Tạo component dùng chung `PcnDossierAssignmentControl` cho card, work queue và dossier detail.
- Operations register giới hạn chỉnh sửa theo từng dòng hồ sơ.
- Intake không còn tự động gán người tạo làm owner.
- Bổ sung test UI, test policy và test server guard.

## Kiểm chứng

- `npm test`: 719/719 đạt.
- `npm run lint`: đạt.
- `npm run build`: đạt.
- `git diff --check`: đạt.
- Working tree sạch sau commit.

## Tệp chính

- `design.md`: nguồn chuẩn duy nhất của đặc tả.
- `utils/pcnDossierAssignment.ts`: policy lọc/gán/quyền operator.
- `utils/pcnDossierStepAccess.ts`: quyền truy cập theo owner.
- `server.ts`: kiểm tra quyền ở server boundary.
- `components/PcnDossierAssignmentControl.tsx`: UI gán/nhận hồ sơ.
- `components/PcnPipelineBoard.tsx`, `components/PcnWorkQueueView.tsx`, `components/PcnDossierDetailView.tsx`: tích hợp UI.
- `test/pcn-dossier-assignment*.test.ts`, `test/pcn-dossier-operation-guards.test.ts`: test tính năng.
