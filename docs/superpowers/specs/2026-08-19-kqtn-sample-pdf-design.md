<!--
Author: Gemini
OS support: Web/Node
Description: Thiết kế quản lý đầu mẫu KQTN, kết quả duy nhất, PDF và Bulk Upload
-->

# Thiết kế KQTN theo đầu mẫu, PDF và Bulk Upload

## 1. Mục tiêu và ranh giới

`requests` là nguồn sự thật của đầu mẫu thử nghiệm. Mỗi request tương ứng một đầu mẫu/sản phẩm có số mã hóa; cả Sổ Tổng hợp và KQTN tham chiếu cùng đầu mẫu này nhưng có mục đích khác nhau:

- Sổ Tổng hợp quản lý vòng đời PYC/mẫu: thông tin hành chính, trạng thái nhận mẫu, lịch thử, phân công, giao trả và các chỉnh sửa quản trị.
- KQTN là workbench kết quả: hiển thị đầu mẫu đã nhận từ PYC, lập/lưu kết quả thử nghiệm, quản lý version và lưu trữ PDF kết quả.
- Không tạo một nguồn mẫu thứ hai trong KQTN. Trạng thái nhận mẫu vật lý và biên bản giao nhận tiếp tục đi qua luồng PYC/Giao nhận hiện có.

## 2. Định danh và tính duy nhất

Thêm helper thuần `normalizeKqtnSampleKey(value: string): string` để chuẩn hóa số mã hóa: bỏ dấu tiếng Việt, chuyển uppercase, loại bỏ khoảng trắng và ký tự phân cách không có ý nghĩa. Chuỗi rỗng là không hợp lệ khi lưu KQTN.

`KQTNRecord` bổ sung:

- `requestId?: string` để liên kết ổn định về `TestRequest`.
- `sampleKey: string` là khóa chuẩn hóa dùng để kiểm tra duy nhất.
- `resultPdf?: KqtnPdfMetadata` là metadata/pointer file, không chứa Base64.

Store phải bảo vệ ở cả hai lớp:

1. UI kiểm tra `sampleKey` trước khi mở thao tác lưu.
2. `addKqtnRecord`/luồng save dùng cùng helper và từ chối bản ghi trùng nếu chưa truyền lựa chọn overwrite. Không được phụ thuộc chỉ vào `id`, vì ReportGenerator hiện tạo id mới cho mỗi lần lưu.

Khi overwrite kết quả, giữ nguyên `id`, cập nhật payload kết quả, tăng `version`, thêm một mục `versionHistory` có actor/thời gian/lý do và phát notification/activity log như luồng cập nhật KQTN hiện tại. Hủy hộp thoại overwrite không được gọi mutation.

## 3. Mô hình hiển thị KQTN

KQTN lấy danh sách đầu mẫu có mã hóa từ `requests`, loại bỏ request kỹ thuật/đã xóa, sau đó join với `kqtnRecords` theo `requestId` trước và `sampleKey` sau. Mỗi đầu mẫu chỉ tạo một dòng hiển thị, với trạng thái:

- `Chưa có KQTN`: mẫu đã có trong PYC nhưng chưa có bản ghi kết quả.
- `Đã có KQTN`: đã có bản ghi kết quả, hiển thị version và PDF nếu có.
- `KQTN legacy`: bản ghi KQTN không còn request tương ứng vẫn được hiển thị để không mất dữ liệu.

Các bản ghi legacy trùng `sampleKey` phải được gộp ở lớp đọc theo bản ghi có `updatedAt` mới nhất; các bản cũ được đưa vào báo cáo kiểm kê/migration, không âm thầm xóa trong UI.

## 4. PDF đơn và lưu trữ

PDF kết quả được lưu trong private Supabase Storage bucket `ddt-files`. `file_assets` lưu metadata kiểm kê với `source_collection = 'kqtnRecords'`, `source_document_id = record.id`, `source_json_path = '$.resultPdf'`.

API server:

- `POST /api/kqtn/:recordId/pdf`: multipart field `file`; chỉ nhận PDF, kiểm tra `application/pdf`, magic bytes `%PDF-`, kích thước tối đa 25 MB; lưu object mới và trả `KqtnPdfMetadata`.
- `GET /api/kqtn/:recordId/pdf`: stream inline.
- `GET /api/kqtn/:recordId/pdf?download=1`: stream attachment với tên file gốc an toàn.
- `DELETE /api/kqtn/:recordId/pdf`: xóa object và metadata.

Khi ghi đè PDF, upload object mới với path/checksum mới trước; chỉ sau khi upload thành công mới cập nhật pointer và xóa object cũ. Nếu upload thất bại, pointer cũ vẫn nguyên vẹn. Nếu cleanup object cũ thất bại, trả cảnh báo lỗi và không đánh dấu thao tác hoàn tất.

Production cần nhận `SUPABASE_STORAGE_URL`, `SUPABASE_SERVICE_ROLE_KEY` và `SUPABASE_STORAGE_BUCKET` từ env ngoài repository; không ghi secret vào `.env` hoặc source code. Ảnh OCR/ảnh lập báo cáo vẫn bị strip như quy tắc hiện tại.

## 5. Bulk Upload

Header KQTN có nút `Bulk Upload`, mở modal theo ba bước:

1. Chọn nhiều PDF và kiểm tra client-side tên file/kích thước.
2. Với từng file, chạy AI extraction hiện có hoặc endpoint metadata chuyên biệt để lấy `sampleCode`, `model`, `brand` nếu có. Filename được dùng làm tín hiệu bổ sung, không được tự động ghi đè khi AI không chắc.
3. So khớp candidate theo `sampleKey` trước, sau đó model đã chuẩn hóa. Hiển thị file, mã AI đọc được, model, candidate đầu mẫu, điểm tin cậy và trạng thái. Người dùng có thể mở dropdown tìm kiếm để tự chọn đầu mẫu.

Chỉ dòng có mapping hợp lệ mới được upload. Nếu đầu mẫu đã có kết quả hoặc PDF, hiển thị cảnh báo và yêu cầu xác nhận overwrite cho từng dòng; các dòng bị hủy không được upload. Bulk operation lưu file qua cùng API PDF đơn để giữ một chính sách validation/cleanup.

## 6. Quyền và tương thích

- Admin/Tester được nhận/lưu/overwrite KQTN và upload/overwrite PDF.
- Viewer/Guest được xem danh sách, mở PDF và download theo quyền đọc KQTN, không được mutation.
- `reportNo` tiếp tục giữ để tương thích xuất DOCX; giao diện lấy `sampleCode` làm định danh chính.
- Backup JSON chỉ chứa metadata PDF. Backup đầy đủ Storage phải bao gồm object private và các dòng `file_assets`; restore khôi phục object trước khi xác nhận pointer.

## 7. Kiểm thử và tiêu chí chấp nhận

- Unit test normalization: khác hoa/thường, dấu, khoảng trắng và dấu phân cách vẫn ra cùng `sampleKey`; mã rỗng bị từ chối.
- Unit test save: lưu lần đầu tạo một record; lưu lần hai cùng key không overwrite nếu chưa xác nhận; overwrite giữ id và tăng version; cancel không đổi state.
- Unit test matching: ưu tiên mã hóa, dùng model để xếp candidate, file không khớp phải chờ người dùng chọn.
- API contract test: reject MIME/magic bytes/kích thước sai; upload/view/download/delete dùng đúng record; overwrite không làm mất pointer cũ khi upload lỗi.
- UI contract test: cột PDF và nút Bulk Upload có mặt; hành động PDF thay đổi theo trạng thái; modal có mapping thủ công và cảnh báo overwrite.
- Chạy `npm run typecheck`, test suite liên quan và `npm run build` trước khi bàn giao.

<!-- --- End of 2026-08-19-kqtn-sample-pdf-design.md --- -->
