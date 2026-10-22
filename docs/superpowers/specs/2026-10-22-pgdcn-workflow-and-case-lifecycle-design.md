# Proposal: Workflow và vòng đời hồ sơ PCN/PGD

- **Ngày:** 2026-10-22
- **Mã:** SPEC-PGDCN-02
- **Trạng thái:** proposal chờ duyệt; chưa phải quyết định kiến trúc
- **Audit:** [Audit end-to-end](../../audits/2026-10-22-pgdcn-end-to-end-operational-audit.md)
- **SSOT tham chiếu:** design.md mục 0.2, 0A, 0A.3, 0.10 và issuance

## Vấn đề và bằng chứng

PCN có workflow template và snapshot theo dossier. app/api/pcn/intake/route.ts:154–191 tạo snapshot; lib/server/workflow-tasks.ts:49–76 khóa hồ sơ/task và kiểm tra cycle/owner. Workflow PCN được render từ snapshot theo design.md mục 0.2.

PGD có workflow-template CRUD/revision/publish/retire routes và bootstrap/store (app/api/pgd/workflow-templates/**, app/api/pgd/bootstrap/route.ts:55,111; components/PgdcnAppShell.tsx:367). Tuy nhiên request transition gọi getPgdOperationalStepGateDenial từ utils/pgdWorkflow.ts; test/pgd-workflow.test.ts mô tả năm operational station. Chưa tìm thấy request PGD lưu template snapshot/revision hoặc runtime gate đọc topology template. Đây là khoảng cách giữa bề mặt cấu hình và runtime theo bằng chứng hiện tại.

Các boundary PGD request/assignment/transition dùng transaction/row lock và cổng bằng chứng; issuance PCN có route riêng cho approval, issue, delivery và archive. Audit không chạy concurrency test với database thật.

## Mục tiêu và ngoài phạm vi

**Mục tiêu:** hồ sơ có một nguồn trạng thái rõ ràng; assignment/task gắn với actor/scope; server kiểm tra evidence; retry không tạo thao tác trùng; PCN giữ snapshot hiện tại; PGD không cho admin UI hứa khả năng runtime mà hệ thống chưa áp dụng.

**Ngoài phạm vi:** thay đổi các quy tắc chuyên môn theo loại hàng khi chưa được nghiệp vụ xác nhận; thay collection/storage chỉ để đồng nhất tên; đổi PCN state machine sang một mô hình BPMN mới.

## Phương án và đánh đổi

1. **Giữ PGD station hiện tại, chuyển workflow-template UI thành catalog/reference.** Ít thay runtime và tương thích case cũ; mất khả năng cấu hình runtime, cần đổi nhãn hoặc ẩn thao tác publish.
2. **Dùng template đã publish làm cấu hình runtime, pin revision/snapshot vào request mới — đề xuất nếu nghiệp vụ xác nhận template là chức năng active.** Case mới có thể theo luồng quản trị; cần chuyển đổi hồ sơ cũ và định nghĩa cách map station thành forms/gates.
3. **Lưu templateId + version bất biến thay vì copy snapshot.** Nhẹ hơn ở request; phụ thuộc giữ revision vĩnh viễn và đảm bảo lookup không mất dữ liệu.

Đề xuất quyết định trước giữa phương án 1 và 2. Nếu chọn 2, nên dùng snapshot bất biến hoặc version record bất biến, không đọc “latest published template” mỗi lần transition.

## Hợp đồng runtime đề xuất

- Intake nhận payload đã validate, dựng actor/customer/request snapshot từ server-owned data, khóa idempotency theo request key và tạo hồ sơ cùng những child records bắt buộc trong transaction.
- PCN dossier mới tiếp tục pin workflowTemplateId/version/snapshot như hiện tại; thay template chỉ ảnh hưởng hồ sơ mới. Return/reopen tăng cycle và giữ lịch sử; stale task không thể complete cycle mới.
- Với PGD, mỗi case dùng một phiên bản template được chọn tại intake nếu catalog là runtime; nếu catalog không active, UI phải thể hiện chính xác template không điều khiển transition. Không tự suy diễn topology từ code seed.
- State transition được server kiểm tra từ dữ liệu nguồn hiện có (assignment, field inspection, sample/lab result, report, approval, delivery). Browser gửi ý định/action và expected version, không gửi cờ “đủ điều kiện”.
- Khi transition, lock request; ghi trạng thái, event/audit và side-effect cần thiết trong transaction. External PTN/provider calls dùng idempotency/outbox pattern hoặc state riêng; không giữ DB lock trong lúc chờ mạng.
- Approval, signing, issue, delivery và archive giữ boundary hiện có. Không cho generic metadata endpoint đổi các trạng thái này.
- Lỗi dùng conflict cho stale version/cycle, forbidden cho thiếu quyền, validation error cho thiếu evidence; response không tiết lộ record khác scope.

## Tương thích và rollout

Kiểm kê schema payload hiện có trong app_documents và các caller. Hồ sơ PCN đang có snapshot giữ nguyên. Hồ sơ PGD cũ không có snapshot phải có adapter tường minh về default workflow/version, read-only preview và backfill dry-run nếu cần; không cập nhật production trong task này. Lịch sử hồ sơ và approval không bị ghi đè khi cấu hình template mới.

## Nghiệm thu

1. Tạo request PCN mới chọn đúng template published và lưu snapshot; chỉnh template sau đó không đổi request cũ.
2. Tạo request PGD với template revision đã chọn; transition dùng đúng revision và các gate đã xác định.
3. Nếu quyết định template chỉ là catalog, UI/admin không thể publish một thay đổi giả tạo cảm giác runtime đã đổi.
4. Hai completion request cùng cycle: chỉ một thành công; retry cùng idempotency key không tạo duplicate; stale cycle trả conflict.
5. Thiếu assignment/sample/result/report/approval/delivery evidence thì server từ chối đúng bước; browser không thể override.
6. Return/reopen giữ lịch sử, đánh dấu công việc phụ thuộc cần xử lý lại theo policy đã được nghiệp vụ duyệt.
7. Approval → issued → delivered → archived chỉ đi qua issuance boundary và audit theo actor.
8. Test caller role/scope theo [spec access boundary](2026-10-22-pgdcn-access-and-audit-boundaries-design.md).

## Câu hỏi mở và phụ thuộc

Nghiệp vụ PGD cần xác nhận template admin có điều khiển runtime không; danh sách template theo nhóm sản phẩm/phương thức; hồ sơ đang chạy có được nâng version không; ai được return/reopen; “hoàn tất” PGD kết thúc ở ký, trả kết quả hay archive; cycle PCN khi suspend được tính thế nào. Phụ thuộc spec access và spec samples/lab.

## Spec liên quan

[Access/audit](2026-10-22-pgdcn-access-and-audit-boundaries-design.md) · [Mẫu/PTN](2026-10-22-pgdcn-samples-and-lab-results-design.md) · [Tài liệu/AI](2026-10-22-pgdcn-documents-ai-and-storage-design.md) · [UX](2026-10-22-pgdcn-workfirst-superneat-ux-design.md)
