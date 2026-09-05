# Kế hoạch triển khai đối chiếu và tích hợp biểu mẫu PCN/PGD

## Phạm vi đã duyệt

Đối chiếu template trong `templates/pcn` và `templates/pgd` với các thư mục biểu mẫu PCN/PGD trên Desktop; giữ nguyên hồ sơ gốc; thay các template sai form bằng bản nguồn phù hợp; bổ sung placeholder còn thiếu; cập nhật registry/runtime khi có mapping dữ liệu; tạo bộ kiểm tra riêng trên Desktop.

## Nguyên tắc thực hiện

- Không ghi đè hoặc di chuyển file gốc trên Desktop.
- Không đưa hồ sơ đã điền dữ liệu khách hàng vào runtime.
- Không thay đổi nghiệp vụ ngoài template, placeholder, catalog và đường sinh tài liệu liên quan.
- Mọi sửa DOCX phải bảo toàn bố cục bảng, logo IEMM và media nguồn nếu file nguồn có các thành phần đó.
- Dùng `design.md` làm nguồn chuẩn; nếu phát hiện thay đổi schema/luồng nghiệp vụ cần thiết, cập nhật phạm vi tương ứng trước khi triển khai.

## Bước 1 - Kiểm kê codebase và đường runtime

1. Đọc manifest hiện có:
   - `templates/pcn/manifest.json`
   - `templates/pgd/manifest.json`
2. Đọc catalog/definition và các đường sinh tài liệu:
   - `utils/pcnOperationalTemplateCatalog.ts`
   - `utils/pcnOperationalTemplateGeneration.ts`
   - `utils/pgdDocumentTemplates.ts`
   - `utils/pgdTemplatePack.ts`
   - `utils/pgdDocumentGeneration.ts`
   - các route chọn template/sinh DOCX trong `server.ts`
3. Lập danh sách chính xác các biểu mẫu đang được UI/API/runtime sử dụng, phân biệt `ACTIVE_USED` với mẫu chỉ được đóng gói.
4. Kiểm tra test hiện có về template, placeholder, media, trang và lề trước khi sửa.

## Bước 2 - Kiểm kê nguồn Desktop có chọn lọc

Đọc tên file, phần mở rộng, mã biểu mẫu và metadata từ các thư mục:

- PCN:
  - `C:\Users\HungX\Desktop\PCN\Hồ sơ chứng nhận QCVN4 2026\Biểu mẫu biên bản thực hiện`
  - `C:\Users\HungX\Desktop\PCN\Hồ sơ chứng nhận QCVN9 2026\Biểu mẫu`
  - `C:\Users\HungX\Desktop\PCN\Hồ sơ chứng nhận QCVN4 2026\Công văn`
  - `C:\Users\HungX\Desktop\PCN\Hồ sơ chứng nhận QCVN9 2026\Biểu mẫu công văn`
  - các thư mục `Mẫu BB trả, nhận mẫu`, `Phiếu yêu cầu` khi có file biểu mẫu thực sự.
- PGD:
  - `C:\Users\HungX\Desktop\PGD\BM Giám định thép`
  - `C:\Users\HungX\Desktop\PGD\BM Hồ sơ thép ko gỉ`
  - `C:\Users\HungX\Desktop\PGD\Giám định\Hợp chuẩn thép\Biểu mẫu`
  - `C:\Users\HungX\Desktop\PGD\Giám định\Mẫu biên bản` khi có file.

Phân loại theo mã canonical và nội dung thực tế: `ACTIVE_USED`, `PACKAGED_NOT_USED`, `DESKTOP_EXTRA`, `FILLED_EXAMPLE`, `DUPLICATE_OR_OLDER`, `NEEDS_REVIEW`.

## Bước 3 - Đối chiếu cấu trúc DOCX

Tạo công cụ kiểm kê/reconcile tại `scripts/reconcile_office_templates.py` hoặc mở rộng script kiểm tra hiện có để:

- đọc placeholder trong tất cả phần XML của DOCX;
- nhận diện placeholder bị thiếu so với manifest/definition;
- kiểm tra bảng, cell chứa nhãn và placeholder;
- kiểm kê media/logo và hash media;
- đọc trang/lề/font và các thuộc tính hình học bảng;
- ghi nhận nguồn Desktop, file canonical đã chọn, lý do chọn và trạng thái;
- không sửa nguồn Desktop trong bước kiểm kê.

Đối với `.doc` chỉ có bản tham chiếu, chuyển bản sao tạm thời sang DOCX để đọc/đánh giá; không thay đổi file gốc.

## Bước 4 - Chọn và chuẩn hóa nguồn canonical

1. Chọn bản trống/có cấu trúc đầy đủ nhất cho từng mã biểu mẫu.
2. Ưu tiên thay vào template hiện có khi form Desktop đúng nghiệp vụ và codebase đã có generation path.
3. Với mẫu Desktop có mã mới nhưng chưa có runtime mapping, đưa vào báo cáo `DESKTOP_EXTRA`/`PACKAGED_NOT_USED`; chỉ tích hợp sau khi xác định được trường dữ liệu và đường gọi.
4. Bổ sung placeholder tại nhãn phù hợp, ưu tiên cùng cell/bảng:
   - `[[productName]]`, `[[productForm]]`, `[[grade]]`, `[[model]]`, `[[dimensions]]`;
   - `[[productStandard]]`, `[[origin]]`, `[[manufacturer]]`;
   - các trường mã hồ sơ, lô, số lượng, tiêu chuẩn, phương pháp, kết quả theo từng form.
5. Giữ logo IEMM/media có trong nguồn; không tự chèn logo vào nguồn không có logo.
6. Áp dụng chuẩn trang đã thống nhất: A4, trên/dưới 20 mm, trái 30 mm, phải 15 mm, Times New Roman màu đen; không làm vỡ chiều rộng bảng.

## Quy tắc bắt buộc cho bảng biểu

- Mỗi bảng phải nằm trọn trong vùng nội dung rộng tối đa 165 mm; không được vượt qua lề trái 30 mm hoặc lề phải 15 mm.
- Bảng phải canh đúng với vùng nội dung của văn bản, không dùng thụt lề bảng hoặc chiều rộng lớn hơn vùng in.
- Phân bổ cột theo nội dung: cột số thứ tự/mã dùng độ rộng vừa đủ; cột nhãn được ưu tiên đủ rộng; cột mô tả/kết quả nhận phần rộng còn lại.
- Giảm padding trong cell ở mức hợp lý để tăng diện tích chữ, nhưng vẫn giữ khoảng đệm dễ đọc và đường viền rõ.
- Giữ các cụm nhãn ngắn trên một dòng khi có thể; không dùng `nowrap` cho nội dung dài đến mức gây tràn lề hoặc che khuất dữ liệu.
- Với bảng nhiều cột, dùng độ rộng cố định được kiểm soát ở cấp bảng/cell, không để Word tự dãn bảng vượt vùng nội dung.
- Kiểm tra các bảng có placeholder dài như `[[productStandard]]`, `[[inspectionScope]]`, `[[technicalParameters]]`, `[[grade]]` và `[[model]]` bằng bản render thực tế; nếu cần, điều chỉnh độ rộng cột lân cận thay vì làm thay đổi toàn bộ bố cục.
- Kiểm tra cả trang đầu và các trang tiếp theo để phát hiện bảng bị lệch lề, tràn cột, tách dòng bất hợp lý hoặc hàng bị đẩy sang trang ngoài dự kiến.

## Bước 5 - Cập nhật codebase

1. Cập nhật DOCX và manifest canonical trong:
   - `templates/pcn/`
   - `templates/pgd/`
2. Cập nhật các catalog/definition placeholder khi form đã có mapping:
   - `utils/pcnOperationalTemplateCatalog.ts`
   - `utils/pgdDocumentTemplates.ts`
   - các helper import/inspection nếu cần.
3. Chỉ thêm kind/entry mới khi có đủ:
   - template canonical;
   - placeholder contract;
   - dữ liệu đầu vào trong context/form;
   - route hoặc generation path có thể gọi.
4. Giữ backward compatibility với ID, code, fileName và placeholder đã công bố.
5. Nếu thay đổi domain/schema/flow vượt template, dừng để cập nhật phần tương ứng của `design.md` trước khi sửa tiếp.

## Bước 6 - Xuất bộ kiểm tra Desktop

Tạo thư mục:

`C:\Users\HungX\Desktop\PCN_PGD_Template_Review_2026-09-05`

với:

- `PCN\`: bản template PCN canonical/revised;
- `PGD\`: bản template PGD canonical/revised;
- `reports\template-crosswalk.json`;
- `reports\README.md`;
- có thể thêm `reports\rendered\` cho ảnh/PDF kiểm tra nếu công cụ render hỗ trợ.

Tệp báo cáo phải ghi rõ file nguồn, mã biểu mẫu, file codebase tương ứng, trạng thái, placeholder, media/logo, lý do thay thế và các file chỉ tham chiếu.

## Bước 7 - Kiểm thử và QA trực quan

1. Chạy kiểm tra manifest/source placeholder.
2. Kiểm tra `[[grade]]` trong các biểu mẫu có trường Mác/model/cấp sản phẩm; kiểm tra các placeholder mới không bị tách qua run/cell.
3. Kiểm tra media/logo IEMM bằng hash và render.
4. Kiểm tra A4, lề 20/20/30/15 mm và hình học bảng.
5. Chạy các test liên quan, tối thiểu:
   - `npm run typecheck` nếu thay đổi TypeScript;
   - test template DOCX và report-template audit;
   - `git diff --check`.
6. Render một số mẫu đại diện PCN/PGD bằng `render_docx.py`, xem ảnh trang đầu và các trang có bảng dài để phát hiện lệch lề/tràn cột.
7. Đọc lại báo cáo Desktop, bảo đảm không có file lịch sử bị sửa.

## Tiêu chí hoàn thành

- Có crosswalk đầy đủ giữa codebase và các nguồn biểu mẫu đã chọn.
- Template đang dùng không còn lỗi placeholder/form đã xác định.
- Các form mới đủ mapping được tích hợp vào codebase; form chưa đủ mapping được phân loại rõ, không bị đưa nhầm vào runtime.
- Logo IEMM/media và bố cục bảng được bảo toàn theo nguồn canonical.
- Bộ kiểm tra trên Desktop tồn tại, mở được và có báo cáo giải thích các quyết định.
- Có kết quả test/render và danh sách giới hạn còn lại nếu có.
