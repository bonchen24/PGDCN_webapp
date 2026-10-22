# Proposal: Ranh giới truy cập và nhật ký audit PGDCN

- **Ngày:** 2026-10-22
- **Mã:** SPEC-PGDCN-01
- **Trạng thái:** proposal chờ người dùng duyệt; chưa phải quyết định kiến trúc
- **Audit:** [Audit end-to-end](../../audits/2026-10-22-pgdcn-end-to-end-operational-audit.md)
- **SSOT tham chiếu:** design.md mục 0, 7.1–7.3 và mục audit log

## Vấn đề và bằng chứng

Các route App Router dùng những kiểu guard khác nhau. lib/server/auth.ts:175–194 làm session/active check cho helper PCN. utils/pcnRbac.ts có policy scope/viewer/collection (75–83, 110–123, 182–210), nhưng app/api/db/[collection] GET và [id]/PUT/DELETE cùng batch/delete-batch dùng getSessionUser thay vì policy đó. lib/server/collections.ts:5–37 cho phép collection hệ thống và nghiệp vụ. Test PCN RBAC boundary hiện có đọc server.legacy.ts, không chứng minh các handler Next này.

Một vài private-file handler cũng dựa trên session mà chưa thấy domain/record scope check. KQTN PDF, activity summary và generic Gemini cần profile/role review riêng. PGD có dedicated guard trong lib/server/pgd.ts, đây là đối chứng cần giữ.

## Mục tiêu và ngoài phạm vi

**Mục tiêu:** một quyết định quyền ở server cho mọi route; chặn quyền đọc/ghi chéo PCN/PGD; viewers không mutate; collection hệ thống được bảo vệ riêng; audit log không bị sửa/xóa qua generic API; file được resolve theo scope và record sở hữu.

**Ngoài phạm vi:** thay role taxonomy nghiệp vụ, thiết kế multi-tenant mới, thay đổi schema trước khi inventory và migration plan được duyệt, hoặc dùng UI-only hiding như cơ chế bảo mật.

## Phương án và đánh đổi

1. **Đóng generic API và chuyển caller sang dedicated routes.** Boundary rõ và dễ test theo nghiệp vụ; tốn công chuyển toàn bộ caller, có thể ảnh hưởng màn hình quản trị.
2. **Policy theo collection/action làm lớp tương thích tạm thời — đề xuất cho bước giảm rủi ro đầu.** Có thể fail closed và giữ caller hợp lệ trong lúc inventory; policy phải hiểu domain/scope và dễ phình nếu thay role bằng một bảng tổng quát.
3. **Middleware/proxy toàn cục.** Chặn authentication sơ bộ tập trung; không đủ để phân quyền theo collection, record owner, action hoặc business state. Chỉ nên là lớp phụ, không thay guard ở handler.

Đề xuất: đặt policy dùng chung trong server layer, áp dụng ngay cho route generic, đồng thời chuyển dần các mutation nghiệp vụ sang dedicated handlers. Không cấp quyền chỉ vì route nằm dưới /api/pcn; phải xét session, scope, action và record context.

## Hợp đồng đề xuất

- Mỗi handler xác thực identity ở server và dùng một authorization result có domain, operation, resource và actor. Missing/invalid session trả 401; sai scope/role trả 403; không làm lộ việc record miền khác có tồn tại hay không.
- PCN và PGD là scope riêng theo design.md mục 0A/7.1. User chỉ có PCN không được đọc/mutate PGD, và ngược lại. Quyền dùng chung chỉ áp dụng cho projection/shared data được policy chỉ rõ.
- Viewer là read-only. Người phụ trách chỉ mutate record được gán hoặc action được policy cho phép; quản lý/Admin chỉ có các quyền quản trị đã thống nhất trong design.md và business role map. Không tự đưa role labels mới vào code.
- Generic collection API phải dùng allowlist theo method; systemUsers/systemConfig không được ghi qua endpoint generic; activityLogs chỉ append bằng server boundary và không xóa/sửa tùy ý. GET cũng phải có scope vì response hiện có thể trả collection rộng.
- File download phải resolve file asset → source record → domain/collection rồi kiểm tra quyền hiện tại. Không dựa riêng vào biết asset ID hoặc cookie session; URL public lâu hạn không được làm đường vòng.
- Audit event lưu actor snapshot, action, target/domain, timestamp, result và correlation ID; không lưu password, token hoặc nội dung file. Audit write phải đi cùng transaction khi nghiệp vụ cần atomicity.
- Không bắt buộc ghi mọi request 403 thành audit business event; abuse telemetry và audit nghiệp vụ có retention/access policy riêng.

## Dữ liệu, lỗi và rollout

Trước khi thay caller, lập inventory từng client của /api/db/[collection] và phân loại read/write/batch/delete cùng collection. Mỗi collection có policy rõ hoặc bị từ chối mặc định. Dùng test/staging database cô lập để kiểm tra; không thay dữ liệu thật.

Có thể triển khai theo hai bước tương thích: thêm policy và log quyết định không chứa payload nhạy cảm; chuyển client sang dedicated routes; sau khi usage về 0 thì gỡ generic methods không còn hợp lệ. Backfill scope/role cũ chỉ thực hiện sau khi có migration plan riêng.

## Nghiệm thu

1. Anonymous bị từ chối ở mọi API nhạy cảm; session hợp lệ nhưng thiếu scope cũng bị từ chối.
2. PCN-only không đọc hoặc mutate bất kỳ record/file PGD nào; kiểm tra cả ID biết trước, batch và download.
3. Viewer không mutate; role thấp không sửa systemUsers/systemConfig hoặc audit.
4. Audit append-only được kiểm tra ở GET/PUT/DELETE/batch, kể cả generic endpoint cũ.
5. File asset không thể tải chỉ bằng ID; kiểm tra record thuộc user khác/miền khác/đã bị thu hồi.
6. Test khẳng định từng caller UI còn dùng endpoint cũ đã chuyển hoặc được policy cho phép.
7. Kiểm tra race/idempotency để audit event không nhân đôi khi client retry cùng mutation key.

## Thứ tự phụ thuộc và câu hỏi mở

Đây là ưu tiên trước spec workflow, file hardening và UX, vì các phần đó phụ thuộc server boundary. Cần chốt: ai được xem danh sách người dùng để phân công; scope nào được đọc activity projection; quyền manager giữa PCN/PGD; các route legacy nào còn phục vụ; generic GET có thể thu hẹp ngay hay phải chuyển caller trước.

## Spec liên quan

[Workflow và vòng đời](2026-10-22-pgdcn-workflow-and-case-lifecycle-design.md) · [Tài liệu/AI/Storage](2026-10-22-pgdcn-documents-ai-and-storage-design.md) · [Mẫu/PTN](2026-10-22-pgdcn-samples-and-lab-results-design.md) · [UX work-first](2026-10-22-pgdcn-workfirst-superneat-ux-design.md)
