# Proposal: Mẫu, PYC và kết quả PTN

- **Ngày:** 2026-10-22
- **Mã:** SPEC-PGDCN-03
- **Trạng thái:** proposal chờ duyệt; chưa phải quyết định kiến trúc
- **Audit:** [Audit end-to-end](../../audits/2026-10-22-pgdcn-end-to-end-operational-audit.md)
- **SSOT tham chiếu:** design.md mục 0A, sample/lab flow PCN, PGD, KQTN và issuance

## Vấn đề và bằng chứng

PCN đã có các entity sample lot/item/route, sample request bundle, lab request, ReturnedTestResult và route reconcile/status. Test PCN kiểm tra sample ledger và dossier links. PGD có PgdSample/PgdLabRequest/PgdLabResult cùng routes cho split, lab request, result và review. Có test boundary/intake cho PGD.

Vì vậy bằng chứng hiện tại không ủng hộ kết luận “chưa có reconciliation” cho toàn hệ thống. Phần chưa kiểm chứng là contract thực với từng PTN, mapping mã bản địa ↔ mã PGDCN, network retry, duplicate callback, sửa kết quả chính thức và trải nghiệm reconciliation khi mismatch. Route /api/kqtn/[recordId]/pdf là legacy surface, không được nhầm với ReturnedTestResult PCN active.

## Mục tiêu và ngoài phạm vi

**Mục tiêu:** giữ lineage dossier → sample lot/item → route → PYC/lab request → returned result/file; hiển thị rõ trạng thái từng mẫu; xử lý retry, kết quả lặp, đến trễ và conflict mà không ghi đè lịch sử.

**Ngoài phạm vi:** giả định DDT/LABFTEE là hệ thống nguồn nào nếu chưa được xác nhận; thay mã PTN hiện hữu; import mẫu/kết quả production; tự chấp nhận kết quả do AI trích xuất.

## Phương án và đánh đổi

1. **Giữ từng route/boundary PCN và PGD riêng, chia sẻ projection/validation thuần.** Bảo vệ domain ownership; có thể lặp một phần code.
2. **Tạo domain service chung cho sample lineage/reconciliation, với adapter riêng từng domain/PTN — đề xuất để đánh giá.** Giảm khác biệt xử lý duplicate nhưng cần hợp đồng chung đã được nghiệp vụ chấp thuận.
3. **Đưa mọi hệ thống PTN vào event broker/outbox.** Retry/ordering rõ hơn; thay đổi hạ tầng lớn, chỉ hợp lý khi đã có tích hợp ổn định và vận hành event.

Không chọn phương án 2 như quyết định ngay: trước tiên cần inventory API/adapter và xác minh hệ thống ngoài. Có thể giữ boundary riêng trong khi chuẩn hóa contract test.

## Hợp đồng đề xuất

- Mọi event hoặc result mang domain, source system, source request ID, sample IDs, provider-native IDs, idempotency/message ID, timestamp nguồn và actor/system identity.
- Mã PCN/PGD là định danh nội bộ; mã PYC/mã mẫu tại PTN được lưu thành crosswalk, không ghi đè mã gốc.
- Retry cùng message/idempotency key là no-op có audit; cùng mã nhưng nội dung khác tạo conflict cần người xử lý, không âm thầm update.
- Result là versioned evidence. Sửa chính thức tạo phiên bản/supersedes link và giữ file/checksum/lịch sử cũ theo retention policy.
- Một bundle có thể gửi một phần thất bại; UI hiển thị từng dòng success/failed/retryable và không gửi lại những dòng đã xác nhận thành công.
- Reconcile phải so sánh request identity, dossier/sample/item/route, provider, trạng thái, result version và file provenance. Kết quả thiếu liên kết không tự ghép theo gần đúng tên/mã.
- AI/OCR chỉ tạo proposal fields cùng source page/confidence; người có quyền xác nhận vào result chính thức.

## Dữ liệu lỗi và khả năng phục hồi

Phân biệt lỗi network retryable, lỗi validation permanent, duplicate identical, duplicate conflicting, unknown source ID, result đến sau khi hồ sơ đã đóng và file không khớp checksum. Retry không giữ transaction/lock trong suốt network request. Có màn hình queue conflict để người được quyền chọn link đúng, yêu cầu gửi lại hoặc từ chối kèm lý do.

Không thêm schema mới cho đến khi xác định phần nào chưa được biểu diễn bởi PcnSampleRoute/PcnSampleRequestBundle/ReturnedTestResult hoặc PgdSample/PgdLabRequest/PgdLabResult.

## Nghiệm thu

1. Test idempotent dispatch/retry; không sinh bundle/event/result trùng.
2. Test response đến trễ, sai dossier/sample, duplicate same payload và duplicate conflicting payload.
3. Test partial failure giữ trạng thái thành công và cho retry riêng các dòng lỗi.
4. Test result version/supersede giữ file, checksum, actor và audit cũ.
5. Test PCN ↔ mã PTN crosswalk không ghi đè internal ID; PGD domain không ghi qua PCN collection.
6. Test viewer, wrong scope và user chưa assigned theo [spec access boundary](2026-10-22-pgdcn-access-and-audit-boundaries-design.md).
7. Test AI/OCR không tự ghi official result.
8. Chạy staging contract với dữ liệu giả lập sau khi owner xác nhận endpoint/auth/retry contract của từng PTN.

## Câu hỏi mở và phụ thuộc

PTN nào là nguồn chuẩn cho status/result; event push hay polling/file import; ai cấp message ID; có chữ ký số hay verification token không; kết quả sửa đổi xử lý supersede thế nào; thời hạn lưu file/kết quả; ai quyết định conflict. Phụ thuộc access boundary và workflow transition gates.

## Spec liên quan

[Workflow/lifecycle](2026-10-22-pgdcn-workflow-and-case-lifecycle-design.md) · [Access/audit](2026-10-22-pgdcn-access-and-audit-boundaries-design.md) · [Tài liệu/AI/Storage](2026-10-22-pgdcn-documents-ai-and-storage-design.md) · [UX](2026-10-22-pgdcn-workfirst-superneat-ux-design.md)
