# PCN/PGD — Workflow hồ sơ và quản lý Hồ sơ mẫu

Ngày: 2026-09-07

## Kết quả

- Chi tiết hồ sơ PCN dùng workflow-first: header + bản đồ Archify là trạng thái ban đầu; chọn node active/completed mới mở panel tài liệu và công việc liên quan.
- Node bị khóa/cancelled được làm mờ bằng visual state, không hiển thị chữ “khóa/mở”. Panel responsive: desktop ở bên phải, mobile ở bên dưới.
- Panel node hỗ trợ xem/thay phiên bản/sửa form/xóa current, upload, sinh biểu mẫu và tự gắn, waiver có lý do, mở đúng module nghiệp vụ và Continue qua server gate.
- Document mutation trên node hoàn tất tạo rework cycle tối thiểu, downstream stale và rollback status tổng; lịch sử version/audit được giữ lại.
- Workspace **Hồ sơ mẫu** dùng chung cho PCN/PGD, gồm normalized editor model, canvas palette + lane/cột, inspector requirement theo đúng miền, version/revision/publish/retire và preview Archify read-only.
- Card danh mục hiển thị trực tiếp phạm vi áp dụng bằng badge chữ (QC4/QC9 hoặc nhóm sản phẩm/phương pháp PGD). Editor hiển thị cảnh báo thay đổi chưa lưu và hỏi xác nhận trước khi rời mẫu đang sửa; bấm lại đúng tab hiện tại không làm mất editor.

## Boundary và dữ liệu

- PCN và PGD giữ collection, requirement và quyền riêng; không tham chiếu chéo domain.
- Template `PUBLISHED` bất biến; thay đổi tạo revision mới. Hồ sơ cũ giữ workflow snapshot, revision mới chỉ áp dụng cho hồ sơ tạo sau khi phát hành.
- Preview chỉ nhận normalized template và không serialize file private, checksum, object path hoặc dữ liệu dossier runtime.

## Kiểm chứng

- `npm test`: 840/840 pass.
- Template-management UI contract: 5/5 pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass; còn cảnh báo line-ending LF/CRLF của Git.

## Nguồn chuẩn

`design.md` là nguồn chuẩn duy nhất. Memory và Obsidian chỉ ghi lại quyết định, boundary và kết quả kiểm chứng; không thay thế đặc tả và không chứa secret/raw hồ sơ.
