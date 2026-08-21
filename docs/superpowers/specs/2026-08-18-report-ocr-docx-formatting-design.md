<!--
Author: Gemini
OS support: Web/Node
Description: Thiết kế chuẩn hóa OCR, ngày báo cáo, mapping DOCX và kích thước graph
-->

# Chuẩn hóa OCR, DOCX và định dạng báo cáo

## Mục tiêu

Sửa luồng Lập báo cáo để dữ liệu OCR tem mác, ngày tiếng Anh, tem niêm phong và graph được truyền chính xác vào form và DOCX.

## Phạm vi

- Định dạng phần ngày tiếng Anh thành `Month DD, YYYY`, ví dụ `August 18, 2026`.
- Đồng bộ các trường OCR `manufacturer`, `countryOfOrigin`, `power`, `voltage`, `current`, `frequency`, `clockFreq`.
- Chuẩn hóa giá trị thiếu thành `N/A` tại form sau OCR và payload DOCX.
- Sửa alias DOCX legacy để placeholder `{codingNumber}` dưới nhãn “Tem niêm phong” nhận giá trị `sealStamp`.
- Đặt chiều rộng graph EMC/Radimation là `624px` tương đương `165mm` ở 96 DPI, tính chiều cao theo ratio gốc.

## Thiết kế dữ liệu và luồng

1. Tạo helper thuần cho định dạng ngày và chuẩn hóa giá trị OCR để có thể kiểm thử độc lập ở Node.
2. `EmcBepDien1VungNauForm` nhận kết quả OCR, điền năm trường kỹ thuật vào `EmcData`; giá trị rỗng từ OCR trở thành `N/A`. Callback từ `ReportGeneratorView` cập nhật nhà sản xuất và nước sản xuất vào `reportMeta`.
3. Lớp tạo DOCX chuẩn hóa lại các trường kỹ thuật, nhà sản xuất và nước sản xuất trước khi render. Payload có cả `sealStamp` chuẩn và alias `codingNumber` bằng giá trị tem để tương thích template hiện hành.
4. Image module dùng helper sizing chung cho graph, giữ chiều cao theo `originalHeight * (624 / originalWidth)`.

## Xử lý lỗi và tương thích

- Ngày không hợp lệ không được tự đoán; giữ nguyên/trả rỗng.
- OCR không trả về trường nào thì không ghi chuỗi `undefined`, `null` hoặc chuỗi rỗng vào DOCX; dùng `N/A`.
- Giữ nguyên tên field hiện tại trong `EmcData` và các template DOCX; không đổi schema nghiệp vụ ngoài việc bổ sung dữ liệu report metadata đã có sẵn.
- Template mới có thể dùng `{sealStamp}`; template cũ dùng `{codingNumber}` vẫn nhận đúng tem nhờ alias.

## Kiểm thử

- Unit test cho ngày `2026-08-18` và đầu vào `18/08/2026`.
- Unit test cho chuẩn hóa OCR đủ trường và thiếu từng trường.
- Regression test chứng minh DOCX metadata dùng tem niêm phong thay vì số mã hóa.
- Unit test graph sizing với nhiều tỷ lệ ảnh, đảm bảo width `624` và ratio không đổi.
- Chạy toàn bộ test hiện có và typecheck/build trước khi bàn giao.

<!-- --- End of 2026-08-18-report-ocr-docx-formatting-design.md --- -->
