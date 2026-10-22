# Proposal: Tài liệu, AI và Storage an toàn

- **Ngày:** 2026-10-22
- **Mã:** SPEC-PGDCN-04
- **Trạng thái:** proposal chờ duyệt; chưa phải quyết định kiến trúc
- **Audit:** [Audit end-to-end](../../audits/2026-10-22-pgdcn-end-to-end-operational-audit.md)
- **SSOT tham chiếu:** design.md mục 0A, 7.2, 5A.22, document provenance và AI advisory

## Vấn đề và bằng chứng

PCN/PGD có route sinh DOCX/PDF và quản lý template/file asset; các test kiểm tra context, output và API contract. Chưa đối chiếu file sinh ra với toàn bộ mẫu chính thức, font và cách in thực tế.

Upload PCN gọi req.formData() rồi file.arrayBuffer() tại app/api/pcn/files/route.ts:23–65. Storage có default size setting, nhưng điều đó chưa chứng minh request body được giới hạn trước khi parse/buffer. app/api/extract-radimation/route.ts:296–305 cũng parse multipart, buffer ZIP và dùng AdmZip; handler không có guard/limit rõ tại đoạn này. app/api/kqtn/[recordId]/pdf có auth không đồng nhất giữa POST/GET/DELETE, nhưng là route có thể thuộc legacy profile.

Dedicated AI routes có hướng scope/read-only/advisory; generic /api/gemini handlers không có guard nhất quán. npm audit ghi nhận parser advisories trên một số package; exploitability tùy đường sử dụng và advisory precondition. Không tìm thấy bộ golden evaluation cho độ chính xác AI.

## Mục tiêu và ngoài phạm vi

**Mục tiêu:** file có provenance/version/checksum; download gắn với quyền record; giới hạn upload trước khi nạp bytes; parse DOCX/PDF/ZIP/XLSX an toàn; output AI có nguồn chứng cứ và luôn cần người duyệt; minh bạch dữ liệu gửi provider.

**Ngoài phạm vi:** tự đặt ngưỡng upload cuối cùng, tự khử PII bằng regex chưa được kiểm nghiệm, thay provider hoặc chuyển sang microservice khi chưa có yêu cầu vận hành, cam kết AI không hallucinate.

## Phương án và đánh đổi

1. **Giới hạn parser trong Next server.** Đơn giản, ít thành phần; cần hỗ trợ streaming/body caps ở runtime và chịu chung failure domain.
2. **Upload ingress có cap, parser service nội bộ cô lập — đề xuất khi ZIP/XLSX lớn hoặc tần suất cao.** Hạn chế tác động DoS; thêm hạ tầng và queue/retention.
3. **Giữ xử lý hiện tại, chỉ nâng dependency.** Ít thay đổi ngay; không giải quyết buffer cap, auth mismatch hoặc parser resource budget.

Đề xuất bắt đầu bằng route auth, byte cap và dependency update. Chỉ chuyển parser sang worker nếu đo staging cho thấy mức RAM/CPU/tần suất cần isolation. Ngưỡng file, expanded bytes, số entry và timeout phải được chọn theo mẫu nghiệp vụ và giới hạn triển khai, không mặc định 20MB hay một compression ratio tùy ý.

## Hợp đồng file/AI đề xuất

- Upload kiểm tra auth/profile trước; enforce tổng body bytes và per-file bytes tại ingress trước khi parse multipart. Kiểm tra extension, MIME và signature theo loại nội dung; MIME không thay thế parser validation.
- ZIP đặt cap cho entry count, expanded total bytes, per-entry bytes, nesting và thời gian CPU; từ chối path traversal/symlink và không extract ra filesystem tùy ý. Cleanup file tạm và object chưa commit.
- Store file trong private bucket; metadata giữ domain, sourceCollection, sourceDocumentId, version, SHA-256, actor và timestamps. Thay file tạo version mới thay vì ghi đè nguồn audit.
- Download resolve asset đến record/domain và check current access theo [spec access boundary](2026-10-22-pgdcn-access-and-audit-boundaries-design.md).
- DOCX/PDF generation dùng canonical server-side context và templateVersion; preflight cho biết field thiếu; hash context hoặc equivalent revision check để ngăn generate từ context stale. User xác nhận file generated vào checklist theo boundary nghiệp vụ.
- AI service nhận context do server lấy đúng dossier/domain/scope; prompt-injection từ file được coi là untrusted text. Model chỉ trả advisory + evidence references/page/field; không tự ghi state, approve, issue hoặc thay dữ liệu.
- Mọi request AI có provider/model, purpose, input class, actor, timestamp, usage/quota và outcome metadata; không ghi raw file/prompt vào log mặc định. Quy định PII redaction/allowlist cần owner duyệt và test synthetic trước.
- Lỗi upload trả 413 cho body cap, 415 cho loại không hỗ trợ, 422 cho parse/evidence validation; không lộ storage path hoặc stack trace.

## Nghiệm thu

1. Anonymous/wrong-profile upload và private download bị từ chối trước Storage access.
2. File vượt body/file cap bị từ chối trước arrayBuffer; xác nhận không có DB/Storage orphan.
3. ZIP vượt expanded bytes, entry count, nesting hoặc chứa path traversal bị chặn với dữ liệu synthetic.
4. Checksum/version/provenance giữ nguyên khi thay phiên bản hoặc rollback lỗi DB.
5. Generated DOCX/PDF dùng đúng template revision/canonical context; test context stale, missing fields và file openability.
6. AI route yêu cầu scope; dữ liệu ngoài scope không vào prompt; response chỉ advisory, có evidence pointer, không có business mutation.
7. Golden eval dùng fixture giả lập có expected extraction/false-positive/abstention; đo recall/precision theo field quan trọng và yêu cầu người xác nhận.
8. Security tests gắn đúng version/advisory cho AdmZip, xlsx, image-size, xmldom và Next; dependency upgrade không thay đổi contract đầu ra.

## Câu hỏi mở và phụ thuộc

Chốt giới hạn file theo từng biểu mẫu; loại MIME đầu vào được chấp nhận; retention/versioning và xóa pháp lý; provider AI và dữ liệu nào được gửi; có cấu hình tắt AI theo dossier không; yêu cầu chữ ký/dấu/font/numbering của PDF; môi trường có hỗ trợ streaming hay worker không. Phụ thuộc access boundary, workflow và sample/result contract.

## Spec liên quan

[Access/audit](2026-10-22-pgdcn-access-and-audit-boundaries-design.md) · [Workflow](2026-10-22-pgdcn-workflow-and-case-lifecycle-design.md) · [Mẫu/PTN](2026-10-22-pgdcn-samples-and-lab-results-design.md) · [UX](2026-10-22-pgdcn-workfirst-superneat-ux-design.md)
