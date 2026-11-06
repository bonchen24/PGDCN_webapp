# Thiết kế workflow hồ sơ PGDCN phiên bản 2

## Mục tiêu và nguồn

Triển khai quy trình hồ sơ mới theo bảy bước từ tiếp nhận đến lưu trữ, giữ boundary PCN/PGD, rút gọn intake và cung cấp quyền thao tác theo năng lực đã xác nhận trên từng hồ sơ.

Ba tệp nguồn người dùng nêu (`DANH SÁCH PGĐCN.xlsx`, `Duthao_motaphanmem_quanlyhoso.docx`, `06.11.26 chỉnh phòng CNGĐ.docx`) không có trong workspace Windows tại thời điểm audit. Thiết kế này dựa trên toàn bộ nội dung trích dẫn trong yêu cầu; cần đối chiếu bản gốc khi người dùng cung cấp lại, đặc biệt roster nhân sự và các quan hệ domain/catalog chưa được xác nhận.

## Ranh giới dữ liệu và tương thích

- PCN tiếp tục sở hữu `CertificationProposal`, `CertificationDossier` và các collection PCN; PGD tiếp tục sở hữu `PgdInspectionRequest` cùng các collection PGD. Chọn loại hình chỉ định tuyến tới đúng intake/boundary, không gộp collection.
- Mẫu mới mang `workflowSchemaVersion: 2` và snapshot bất biến gồm bảy stage, requirement policy và cấu hình domain/catalog tại thời điểm tạo hồ sơ. Sửa template chỉ ảnh hưởng hồ sơ tạo sau.
- Hồ sơ hiện hành và legacy không có schema version tiếp tục dùng mapping, lifecycle, snapshot và chính sách tài liệu cũ. Không backfill hoặc đổi topology tự động.
- Dữ liệu mới lưu trong JSONB/collection hiện có; đợt đánh giá dùng entity PGD riêng và các tham chiếu `assessmentRoundId`. Không dùng một revision tài liệu để giả lập nhiều đợt. Trong từng đợt, lịch sử phiên file vẫn bất biến và chỉ có một phiên hiện hành cho mỗi requirement.

## Bảy bước workflow v2

| Bước | Chủ thể và quyền | Hành vi chính | Điều kiện chuyển bước |
|---|---|---|---|
| B1. Tiếp nhận hồ sơ | Thành viên có quyền tạo trong domain | Tạo hồ sơ, chọn nhóm/catalog/phương thức, nhập số và ngày đăng ký; tệp đầu vào tùy chọn, có thể bổ sung sau qua hồ sơ | Tạo/lưu hợp lệ với 0 tệp; không có validation ẩn client/server cho upload. Requirement chỉ chặn tại gate workflow đã cấu hình |
| B2. Xem xét đầu vào | Trưởng/Phó phòng hoặc người được cấp capability quản lý | Chấp nhận, trả đúng người upload kèm lý do, từ chối hoặc tạm dừng; cho bổ sung khi đánh giá | Chỉ mở B3 khi đầu vào được chấp nhận; waiver có lý do và audit |
| B3. Phân công và kế hoạch | Trưởng/Phó phòng | Gán trưởng đoàn, nhiều chuyên gia, chuyên gia thẩm xét và văn thư/lưu trữ; lập lịch nhiều ngày; lưu phiếu phân công/kế hoạch | Trưởng đoàn chấp nhận lịch hoặc trả lịch kèm lý do |
| B4. Đánh giá và thử nghiệm | Trưởng đoàn/chuyên gia được giao | Tạo nhiều đợt đánh giá, hiện trường, lấy mẫu, yêu cầu thử, kết quả và đánh giá kết quả; giữ mọi vòng fail/pass riêng; xử lý bổ sung tại đây | Hoàn tất mọi round đang mở và hồ sơ đầu ra theo policy của template |
| B5. Thẩm xét | Chuyên gia thẩm xét được giao | Xem manifest tập trung của B1–B4, tải kết quả thẩm xét và ghi ý kiến; evidence chỉ đọc | Có thể chấp nhận sang B6 hoặc trả B4, giữ nguyên bằng chứng cũ |
| B6. Phê duyệt | Trưởng/Phó phòng có capability duyệt | Duyệt dự thảo GCN/QĐ đã lập; lưu snapshot bộ hồ sơ đã duyệt | Có thể duyệt sang B7 hoặc trả B4; không ký/phát hành tại bước này |
| B7. Ký, phát hành, bàn giao, lưu trữ | Văn phòng/văn thư và người lưu trữ được B3 phân công | Tải PDF ký đóng dấu cuối, nhập ngày cấp/ngày hết hạn, ghi nhận bàn giao; người lưu trữ hoàn tất hồ sơ | Chỉ người có capability phù hợp được ký/phát hành, bàn giao hoặc lưu trữ; ranh giới issuance được audit/idempotent |

Mọi chuyển bước và trả bước được server kiểm tra theo snapshot, actor, scope, capability, trạng thái dữ liệu và idempotency key. B5/B6 trả về B4 bằng event mới, không xóa hoặc sửa trực tiếp bằng chứng B1–B4. Required/optional/conditional và gate được lấy từ template cùng điều kiện được xác nhận; leadership waiver bắt buộc có lý do, actor và thời điểm.

## Intake và catalog

- Intake hiển thị lựa chọn Chứng nhận/Giám định trước, rồi nhóm sản phẩm, phương thức 1/5/7, QCVN/TCVN, số đăng ký và ngày đăng ký. Mã kỹ thuật nội bộ do server cấp độc lập với số đăng ký do phòng nhập.
- Nhóm sản phẩm (`ELECTRICAL_ELECTRONIC`, `METAL_MATERIALS`, `CONSTRUCTION_MATERIALS`, `MANAGEMENT_SYSTEM`, `OTHER`) độc lập với domain và mã Lĩnh vực PCN.
- Catalog có khóa domain + product group + standard + method + template. Quan hệ đã có căn cứ giữ đúng scope hiện hành: PCN chỉ QC4/QC9; QC20/QCVN 20 thuộc PGD. QCVN 07:2019 và QCVN 25:2025, nhóm hoặc phương thức chưa được xác nhận được lưu ở trạng thái `PENDING_CONFIRMATION`, không dùng để mở template/domain sai.
- QCVN/TCVN khác cho phép nhập tên chi tiết và giữ trạng thái chờ xác nhận khi chưa có mapping đã duyệt. Phương thức, template, trạng thái upload/confirmed và điều kiện bắt buộc được thể hiện rõ trong UI.
- Bỏ các ô model/brand/manufacturer/specification bắt buộc khỏi modal PCN; giữ field compatibility cho hồ sơ cũ và cho nghiệp vụ bổ sung/trích xuất sau. Sửa đồng thời client validation, server validation và kiểu dữ liệu để trường ẩn không chặn lưu.

## Năng lực, tài liệu và audit

- Không import roster từ Excel khi chưa có bản gốc và đối chiếu username. Không ghi đè account, mật khẩu, chức danh hoặc quyền hiện hành bằng text trong bảng.
- Capability theo hồ sơ được lưu trong bản phân công: trưởng đoàn, evaluator, reviewer, văn phòng và archivist có thể kiêm nhiệm; cùng một username được gán nhiều capability. Picker chỉ hiện tài khoản active, thuộc scope PGD và có vai trò/năng lực cấu hình phù hợp. Server kiểm tra lại trước mọi mutation.
- Dùng lại private Storage, checksum, provenance, phiên bản tài liệu, download boundary và audit hiện hành. Mỗi assessment round có tài liệu/tham chiếu riêng; package thẩm xét bao gồm round và kết quả lịch sử cần giữ.
- Audit append-only ghi create/edit, phân công, lịch chấp nhận/trả, bổ sung/waiver, review/approval/return, ký, ngày cấp/hết hạn, bàn giao và lưu trữ. Notification chỉ gửi cho actor/assignee đích phù hợp.
- Không dùng KPI làm gate nghiệp vụ. Không tạo migration phá hủy, không chạy `prisma db push`, không đổi credentials hoặc ghi production data.

## Tiêu chí nghiệm thu

1. PCN tạo/sửa hồ sơ không cần model/brand/manufacturer/specification; server không chặn vì field ẩn. Nhóm sản phẩm và domain/catalog vẫn được xác thực.
2. QC20 chỉ xuất hiện ở PGD; QCVN 07/25 và mapping chưa rõ hiện là chờ xác nhận. Tìm kiếm combobox bỏ dấu tiếng Việt và trạng thái lỗi gắn cạnh trường.
3. Hồ sơ v2 hiển thị đúng bảy bước; hồ sơ legacy giữ mapping cũ. B5 và B6 trả về B4 có lý do, actor và history.
4. Có thể gán nhiều chuyên gia, capability kiêm nhiệm và lịch nhiều ngày; chỉ trưởng đoàn chấp nhận/trả lịch.
5. Hai assessment round có round ID khác nhau, mỗi round giữ field minutes, mẫu, yêu cầu thử, kết quả fail/pass và file riêng; revision một file không thay thế round khác.
6. B5 xem đủ B1–B4 ở chế độ chỉ đọc; B6 duyệt riêng; B7 mới ghi PDF ký cuối, ngày cấp/hết hạn, bàn giao và lưu trữ.
7. Server RBAC từ chối người inactive/ngoài scope/không capability; upload/download private, checksum, audit và idempotency hiện hành tiếp tục hoạt động.
8. Unit/integration, typecheck, flow return, multiple rounds/experts, RBAC, upload/download, create/edit, UI desktop/mobile và production build đạt trước khi xét release.
