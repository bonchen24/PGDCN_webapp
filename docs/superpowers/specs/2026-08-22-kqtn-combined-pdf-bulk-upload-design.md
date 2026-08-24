<!--
Author: Gemini
OS support: Web/Node
Description: Thiết kế Bulk Upload KQTN cho PDF nguồn ghép nhiều báo cáo kết quả.
-->

# Thiết kế Bulk Upload KQTN cho PDF ghép nhiều báo cáo

## 1. Mục tiêu và phạm vi

Mở rộng Bulk Upload KQTN để nhân viên có thể chọn một PDF scan lớn chứa nhiều báo cáo kết quả liên tiếp. Hệ thống phải đề xuất các nhóm trang tương ứng với từng báo cáo, trích xuất thông tin nhận diện, cho người dùng rà soát/sửa mapping, sau đó tách thành các PDF con và lưu từng PDF vào đúng đầu mẫu KQTN.

Luồng upload nhiều PDF đơn hiện tại vẫn giữ nguyên. Tính năng mới không tạo nguồn dữ liệu mẫu thứ hai, không tạo thêm KQTN record và không thay đổi nguyên tắc mỗi `sampleKey` chỉ có một KQTN hiện hành.

Giả định nghiệp vụ: các trang của một báo cáo nằm liên tục và thường bắt đầu bằng trang bìa có số báo cáo/mã mẫu. Nếu tài liệu bị trộn trang không liên tục, người dùng phải tự chỉnh nhóm trang; hệ thống không tự động ghép lại theo suy đoán.

## 2. Ràng buộc đã biết

- PDF mẫu là scan ảnh, không có text layer đáng tin cậy; trích xuất text thuần không đủ để tìm mốc tách.
- PDF nguồn có thể lớn hơn giới hạn upload của một PDF kết quả. Kích thước nguồn và kích thước từng PDF con là hai chính sách riêng.
- API `POST /api/kqtn/:recordId/pdf` hiện đã xử lý validation, Storage và metadata cho một PDF kết quả; PDF con phải tái sử dụng API này.
- `sampleCode`/`sampleKey` vẫn là định danh chuẩn. `reportNo`, model, brand và tem niêm phong chỉ là tín hiệu để matching.

## 3. Luồng người dùng

1. Người dùng mở `Bulk Upload` và chọn một hoặc nhiều PDF.
2. Hệ thống xác định file đơn hay file ghép. File đơn đi qua inspection hiện tại; file ghép được chia thành các batch trang nhỏ để nhận diện cấu trúc.
3. Hệ thống đề xuất các segment theo trang bìa. Mỗi segment hiển thị tên file nguồn, khoảng trang, số trang, preview trang đầu, metadata AI đọc được và candidate KQTN.
4. Người dùng có thể đổi trang bắt đầu/kết thúc, thêm/xóa mốc tách, chọn lại candidate và xem preview PDF con.
5. Hệ thống chặn các segment chưa có candidate, candidate trùng trong cùng batch, candidate không còn hợp lệ hoặc segment vượt kích thước kết quả cho phép.
6. Với candidate đã có PDF, hệ thống yêu cầu xác nhận ghi đè riêng segment đó.
7. Hệ thống tạo PDF con trong trình duyệt, upload tuần tự qua API PDF đơn, cập nhật trạng thái từng segment và giữ lại các segment lỗi để retry.
8. Khi hoàn tất, modal hiển thị tổng số thành công/bỏ qua/thất bại; chỉ đóng tự động khi không còn segment cần xử lý.

Luồng rút gọn:

`PDF nguồn -> nhận diện trang bìa -> đề xuất segment -> rà soát mapping -> tách PDF con -> upload từng KQTN`

## 4. Nhận diện và tách trang

### 4.1. Nhận diện cấu trúc

Browser dùng `pdf-lib` để đọc số trang và tạo các PDF batch nhỏ từ PDF nguồn. Mỗi batch được gửi tới endpoint nhận diện cấu trúc mới, không gửi nguyên PDF nguồn lên server.

Endpoint đề xuất:

`POST /api/gemini/extract-kqtn-bulk-structure`

Request:

```ts
interface KqtnBulkStructureRequest {
  base64Data: string;
  mimeType: 'application/pdf';
  pageOffset: number;
}
```

Response:

```ts
interface KqtnBulkStructurePage {
  pageNumber: number;
  isReportCover: boolean;
  isBlank: boolean;
  reportNo?: string;
  sampleCode?: string;
  model?: string;
  brand?: string;
  sealStamp?: string;
  sampleName?: string;
}

interface KqtnBulkStructureResponse {
  pages: KqtnBulkStructurePage[];
}
```

Prompt phải yêu cầu AI kiểm tra mọi trang trong batch, xác định trang bìa bằng các dấu hiệu như tiêu đề báo cáo, số `ITD...`, bảng thông tin mẫu và không suy đoán trường không nhìn rõ. `isBlank` chỉ dùng để trim trang trắng ở đầu/cuối segment; không tự ý xóa trang trắng nằm giữa nội dung báo cáo.

Nếu endpoint lỗi, timeout hoặc trả về kết quả không hợp lệ, UI chuyển sang chế độ manual split thay vì upload nhầm. Các mốc do AI đề xuất luôn có thể sửa.

### 4.2. Tạo segment

Các trang bìa được sắp xếp theo số trang. Segment bắt đầu tại một trang bìa và kết thúc ngay trước trang bìa kế tiếp. Các trang trắng ở biên segment được loại bỏ. Nếu không có trang bìa đầu tiên, người dùng phải nhập mốc bắt đầu; nếu không có trang bìa kế tiếp, segment kết thúc ở trang cuối nguồn.

Helper thuần đề xuất:

```ts
interface KqtnBulkSegmentDraft {
  sourceFileName: string;
  pageStart: number;
  pageEnd: number;
  metadata: KqtnBulkStructurePage;
  detection: 'ai' | 'manual' | 'single-file';
}

function buildKqtnBulkSegments(
  pages: KqtnBulkStructurePage[],
  totalPages: number,
  sourceFileName: string,
): KqtnBulkSegmentDraft[];
```

Khi người dùng chỉnh mốc, segment phải được chuẩn hóa về khoảng trang hợp lệ, không chồng lấn và không vượt tổng số trang.

## 5. Mapping candidate

Candidate KQTN được mở rộng đủ thông tin để matching nhưng không thay đổi record:

```ts
interface KqtnBulkCandidate {
  id: string;
  sampleCode: string;
  sampleKey: string;
  reportNo?: string;
  model: string;
  brand?: string;
  sealStamp?: string;
  hasPdf: boolean;
}
```

Thứ tự matching:

1. `sampleCode` hoặc `reportNo` đọc được khớp duy nhất với `sampleKey`, `sampleCode` hoặc `reportNo` của candidate: `high`.
2. `sealStamp` khớp duy nhất: `high`.
3. `model + brand` khớp duy nhất: `medium`.
4. Model khớp duy nhất: `low` và phải hiển thị cảnh báo để người dùng rà soát.
5. Không khớp hoặc có nhiều candidate: `none`, bắt buộc chọn thủ công.

`reportNo` không được tự động ghi thành `sampleCode`; nó chỉ cung cấp thêm tín hiệu để tìm candidate. Không được tự động upload mapping có độ tin cậy `low`, `none` hoặc mapping có nhiều ứng viên.

## 6. Upload, ghi đè và lỗi

- Segment được tạo thành `File` PDF riêng bằng `pdf-lib`.
- Mỗi segment gọi `uploadKqtnPdf(candidateId, segmentFile)`; không tạo API upload hàng loạt ở giai đoạn này.
- Kích thước tối đa hiện hành 25 MB áp dụng cho từng segment sau khi tách.
- Upload tuần tự để giới hạn memory và tránh tạo nhiều bản PDF con lớn cùng lúc.
- Segment thành công chuyển `uploaded`; lỗi chuyển `failed` và giữ nguyên mapping để retry.
- Segment bị người dùng từ chối ghi đè chuyển `skipped`, không làm thất bại toàn batch.
- Nếu candidate đã có PDF, confirmation hiển thị mã mẫu, tên file cũ nếu có và khoảng trang nguồn của file mới.
- Một batch hoàn tất ghi một activity log tổng hợp có tên file nguồn, số segment và thống kê; không phát notification riêng cho từng segment nếu cùng một thao tác người dùng.

Không lưu PDF nguồn trong JSONB, không lưu Base64 nguồn, không tạo bản ghi `kqtnRecords` trung gian. `resultPdf` của từng record vẫn là metadata pointer tới PDF con trong private Storage.

## 7. UI và trạng thái

Modal hiện tại được nâng thành vùng review có bảng/card segment. Các trạng thái tối thiểu:

- `detecting`: đang phân tích cấu trúc.
- `needs-review`: đã có segment nhưng thiếu mapping hoặc confidence thấp.
- `ready`: mapping hợp lệ, chưa upload.
- `uploading`: đang tạo/upload PDF con.
- `uploaded`: thành công.
- `skipped`: người dùng bỏ qua ghi đè.
- `failed`: lỗi, cho phép retry.

Nút chính đổi theo trạng thái: `Phân tích PDF`, `Tách và kiểm tra`, `Upload các dòng hợp lệ`, `Retry dòng lỗi`. Không được gọi upload khi còn segment `needs-review` nếu người dùng chưa chủ động bỏ qua segment đó.

## 8. Quyền và tương thích

- Chỉ Admin/Tester được upload hoặc ghi đè PDF, theo quyền hiện tại.
- Viewer/Guest vẫn chỉ xem/download.
- Upload PDF đơn, cột File PDF, version KQTN và backup/restore giữ nguyên hành vi.
- Nếu AI không khả dụng, manual split/mapping vẫn phải xử lý được file.

## 9. Kiểm thử và tiêu chí chấp nhận

- Tạo segment đúng từ các trang bìa M02-M07, bỏ trang trắng biên và không chồng lấn khoảng trang.
- Sửa mốc segment không tạo khoảng trang âm, vượt giới hạn hoặc overlap.
- Matching ưu tiên mã hóa/report number, sau đó tem, model+brand, model; ambiguity luôn cần manual.
- PDF nguồn lớn được chia thành các PDF con; chỉ PDF con được kiểm tra giới hạn 25 MB.
- Upload thành công một segment không làm mất mapping hoặc trạng thái của segment khác.
- Retry chỉ upload segment lỗi, không upload lại segment đã thành công.
- Duplicate target và overwrite đều được chặn/xác nhận đúng.
- Endpoint structure trả lỗi được fallback về manual, không tự upload.
- Chạy focused tests, `npm run typecheck` và `npm run build` trước khi bàn giao.

<!-- --- End of 2026-08-22-kqtn-combined-pdf-bulk-upload-design.md --- -->
