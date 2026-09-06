# PCN Dossier Assignment Design

## Goal

Đảm bảo mọi bộ hồ sơ PCN được tạo từ Đề nghị bắt đầu ở trạng thái chưa gán người thực hiện; Admin/Quản lý có thể phân công nhân viên phù hợp, nhân viên có thể tự nhận hồ sơ trống, và staff chỉ được thao tác hồ sơ đã gắn tên mình.

## Scope and invariants

- `CertificationProposal` là nguồn tạo hồ sơ duy nhất trong luồng này. Mỗi Đề nghị tạo đúng một `CertificationDossier`; PYC mới chỉ liên kết vào dossier hiện có.
- Hồ sơ mới giữ trạng thái lifecycle hiện hành (`INTAKE_REVIEW`) nhưng `ownerUsername` không được tự động lấy từ actor tạo Đề nghị.
- `ownerUsername` là khóa kỹ thuật của một chủ hồ sơ duy nhất. Giá trị hợp lệ phải trỏ tới tài khoản PCN đang hoạt động, không phải viewer, có scope `PCN` và có giao với toàn bộ `dossier.fieldCodes`.
- Admin hoặc Quản lý PCN được gán/chuyển chủ hồ sơ. Staff chỉ được claim khi dossier chưa có owner và target chính là username của mình. Staff không được bỏ owner hoặc chuyển owner.
- Admin/Quản lý giữ quyền quản trị và xử lý hồ sơ. Staff không phải owner chỉ được đọc; staff không owner không được sửa metadata nghiệp vụ, status, checklist/tài liệu, mẫu/PYC hoặc KQTN.
- Dữ liệu cũ có owner hợp lệ được giữ nguyên; không có migration tự động xóa hoặc chuyển owner lịch sử.

## User experience

- Card hồ sơ hiển thị `Chưa gán người thực hiện` khi `ownerUsername` trống.
- Admin/Quản lý bấm trạng thái hoặc nút phân công để mở danh sách nhân viên PCN đủ điều kiện của hồ sơ, chọn một người và lưu.
- Staff thấy `Nhận hồ sơ` chỉ khi hồ sơ trống. Sau khi hồ sơ gán người khác, card/chi tiết hiển thị owner và các vùng mutation ở trạng thái chỉ xem.
- Chi tiết dossier dùng cùng policy với card; không cho UI mở control ghi chỉ vì endpoint tổng quát còn có thể gọi được.

## Server and policy

- Reuse `CertificationDossier.ownerUsername`; không thêm trạng thái dẫn xuất hoặc collection assignment mới.
- Mở rộng policy dùng chung trong `utils/pcnDossierAssignment.ts` để kiểm tra danh sách target và quyền actor.
- Sửa `POST /api/pcn/intake` để lưu dossier mới với owner trống.
- Sửa mutation owner trong `POST /api/pcn/dossiers/:dossierId`: manager được assign/reassign trong scope; staff chỉ claim dossier trống cho chính mình.
- Áp dụng cùng guard owner-or-manager cho tất cả dossier mutation hiện hành (metadata/status, tài liệu, mẫu/PYC, KQTN và file liên quan), trong đó dossier trống không còn đồng nghĩa staff được ghi tự do.
- Mọi assignment/claim thành công ghi activity/audit như mutation owner hiện hành; retry phải giữ idempotency.

## Verification

- Unit tests cho target filtering, manager assignment, self-claim, staff denial khi dossier trống và staff denial khi dossier thuộc người khác.
- Contract/server tests cho intake owner trống và các endpoint mutation chính.
- UI source tests cho badge `Chưa gán người thực hiện`, nút `Nhận hồ sơ`, danh sách assignable users và trạng thái read-only.
- Chạy toàn bộ test PCN, typecheck và build trước khi kết luận hoàn thành.
