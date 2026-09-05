# Đặc tả đối chiếu và tích hợp biểu mẫu PCN/PGD

## Mục tiêu

Đối chiếu các biểu mẫu PCN và PGD đang có trong codebase với các nguồn biểu mẫu trên Desktop; xác định biểu mẫu đang được dùng, biểu mẫu còn thiếu, biểu mẫu sai form hoặc sai placeholder; sau đó cập nhật bộ template canonical trong codebase và xuất một bộ bản kiểm tra riêng trên Desktop.

## Phạm vi

- Codebase: `E:\CODING\PCN_webapp`.
- Template runtime: `templates\pcn`, `templates\pgd`.
- Registry và generation: manifest, catalog/definition, placeholder extraction, API/runtime lookup và các test liên quan.
- Nguồn Desktop được kiểm tra có chọn lọc trong các thư mục biểu mẫu PCN/PGD đã xác định.
- Không sửa, di chuyển hoặc ghi đè hồ sơ lịch sử, hồ sơ khách hàng đã điền, PDF kết quả, file khóa Office hoặc bản sao không xác định là template.

## Nguyên tắc nguồn chuẩn

1. Ưu tiên file DOCX trống hoặc file biểu mẫu có cấu trúc rõ ràng.
2. File `.doc` chỉ là nguồn tham chiếu khi không có bản DOCX tương ứng; không dùng hồ sơ đã điền dữ liệu làm template runtime.
3. Khi có nhiều bản trùng mã, chọn bản có bố cục nghiệp vụ đầy đủ nhất và ghi nhận các bản còn lại trong báo cáo đối chiếu.
4. Giữ nguyên bảng, chiều rộng cột, logo/media và bố cục của nguồn được chọn nếu không có lỗi bắt buộc phải sửa.
5. Placeholder dùng chuẩn `[[key]]`, không trộn dữ liệu khách hàng thực tế vào bản template.

## Phân loại đối chiếu

Mỗi file nguồn được gán một trạng thái:

- `ACTIVE_USED`: codebase đang có và có đường runtime sử dụng.
- `PACKAGED_NOT_USED`: đã đóng gói nhưng chưa có luồng runtime gọi trực tiếp.
- `DESKTOP_EXTRA`: có trên Desktop, chưa có trong codebase.
- `FILLED_EXAMPLE`: hồ sơ đã điền dữ liệu, chỉ dùng tham chiếu.
- `DUPLICATE_OR_OLDER`: bản trùng hoặc phiên bản cũ.
- `NEEDS_REVIEW`: chưa đủ căn cứ chọn làm nguồn chuẩn.

Đối chiếu theo mã biểu mẫu canonical, bao gồm các nhóm `PGD-BM-*`, `BM-GĐ-*`, `BM-QT-*`, `BM-QĐ-*` và mẫu PCN nội bộ tương ứng.

## Quy tắc placeholder và bố cục

- Rà soát placeholder thực tế trong XML của từng DOCX, không chỉ dựa vào manifest.
- Bổ sung placeholder thiếu ngay tại vị trí nhãn tương ứng, ưu tiên trong cùng cell/bảng để không phá vỡ bố cục.
- Các trường sản phẩm phải bao phủ tối thiểu khi form có nhãn tương ứng: `[[productName]]`, `[[productForm]]`, `[[grade]]`, `[[model]]`, `[[dimensions]]`, `[[productStandard]]`, `[[origin]]`, `[[manufacturer]]`.
- Với nhóm có mẫu lô/sản phẩm, bảo toàn các trường mã lô, số lượng, tiêu chuẩn, phương pháp và kết quả liên quan.
- Không thêm placeholder tùy tiện vào phần chữ ký hoặc nội dung pháp lý nếu chưa có ánh xạ dữ liệu.
- Bảo toàn logo IEMM và toàn bộ media nguồn; nếu nguồn không có logo thì không tự chèn logo ngoài phạm vi nguồn đã chọn.
- Bảo đảm chuẩn trình bày đã thống nhất: A4, lề trên/dưới 20 mm, trái 30 mm, phải 15 mm, Times New Roman, màu đen, bảng không vượt vùng nội dung.

## Tích hợp codebase

- Cập nhật manifest và file DOCX canonical của PCN/PGD.
- Cập nhật catalog/definition và placeholder metadata khi biểu mẫu mới đã có đủ mapping.
- Chỉ bổ sung kind/luồng sinh tài liệu mới khi có dữ liệu đầu vào và runtime path tương ứng; biểu mẫu Desktop chưa có nghiệp vụ sinh tài liệu được ghi nhận là `DESKTOP_EXTRA` hoặc `PACKAGED_NOT_USED`, không tự động xuất hiện như mẫu hoạt động.
- Không làm mất các placeholder hiện có trong codebase; kiểm tra backward compatibility với các API chọn template và generation path.

## Sản phẩm đầu ra

Tạo thư mục:

`C:\Users\HungX\Desktop\PCN_PGD_Template_Review_2026-09-05`

với cấu trúc:

- `PCN\`: các template PCN đã chọn/chuẩn hóa.
- `PGD\`: các template PGD đã chọn/chuẩn hóa.
- `reports\template-crosswalk.json`: bảng đối chiếu nguồn - codebase - trạng thái - placeholder - media.
- `reports\README.md`: hướng dẫn kiểm tra, danh sách file đã thay thế/thêm mới và các file bị loại khỏi runtime.

Các file gốc trên Desktop được giữ nguyên.

## Kiểm thử và nghiệm thu

1. Mọi template trong manifest phải tồn tại và đọc được.
2. Placeholder trong manifest phải tồn tại thực tế trong DOCX, bao gồm `[[grade]]` ở các form có trường Mác/model/cấp sản phẩm.
3. Không có placeholder bị mất, lỗi delimiter hoặc placeholder bị tách sai trong bảng.
4. Media/logo nguồn được giữ nguyên theo trạng thái đối chiếu.
5. Kích thước trang, lề và hình học bảng đạt chuẩn đã nêu.
6. Chạy các test template/generation liên quan và render các mẫu đại diện để kiểm tra trực quan.
7. Báo cáo cuối phải phân biệt rõ: đã tích hợp runtime, chỉ đóng gói, chỉ tham chiếu và chưa xử lý.

## Ngoài phạm vi

- Không tự động chuyển toàn bộ hàng nghìn hồ sơ lịch sử trên Desktop thành template.
- Không thay thế dữ liệu khách hàng, chữ ký hoặc kết quả thử nghiệm trong hồ sơ thực tế.
- Không thay đổi nghiệp vụ domain ngoài phạm vi template, placeholder và đường sinh tài liệu cần thiết.
