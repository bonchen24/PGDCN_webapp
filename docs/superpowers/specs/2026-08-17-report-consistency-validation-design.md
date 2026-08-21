<!--
Author: Gemini
OS support: Web/Node
Description: Đặc tả kiểm tra nhất quán dữ liệu và thời gian trong form báo cáo thử nghiệm
-->

# Đặc tả: Kiểm tra nhất quán form báo cáo thử nghiệm

## Mục tiêu

Phát hiện sớm lỗi đối soát trong `ReportGeneratorView` trước khi lưu bản ghi KQTN hoặc xuất DOCX, đặc biệt với chuỗi ngày hồ sơ, Model, nhãn hiệu, tem niêm phong và thông số kỹ thuật của mẫu.

## Phạm vi

- Áp dụng cho ba form preview hiện có: `DefaultStandardForm`, `EmcBepDien1VungNauForm` và `DayCapDienForm` thông qua lớp điều phối `ReportGeneratorView`.
- Không thay đổi cách kỹ thuật viên đánh giá điều khoản `Đạt/Không đạt/N/A` hoặc bảng `Pass/Fail`; validation mới kiểm tra tính nhất quán của hồ sơ và dữ liệu nhận dạng.
- Không gọi thêm API; toàn bộ kiểm tra chạy thuần ở client từ PYC đã chọn, dữ liệu form và dữ liệu OCR hiện có.

## Quy tắc kiểm tra

### 1. Chuỗi thời gian

Chuẩn hóa được các dạng `YYYY-MM-DD`, ISO datetime và `DD/MM/YYYY`. `Ngày thử nghiệm` chấp nhận một ngày hoặc dải ngày ngăn cách bằng dấu en dash/em dash hoặc dấu gạch có khoảng trắng.

Thứ tự hợp lệ:

```text
requestDate <= sampleReceiptDate <= testStart <= testEnd <= reportDate
```

Ngày đang bỏ trống không tạo lỗi; ngày sai định dạng, dải ngày có đầu cuối đảo ngược hoặc các mốc đã nhập vi phạm thứ tự tạo lỗi `DATE_INVALID`/`DATE_ORDER`.

### 2. Đối soát metadata

PYC đã chọn là nguồn chuẩn. Các trường được đối chiếu khi cả hai phía có dữ liệu:

- `requestCode` với số PYC.
- `model` với `modelName`.
- `brand` với nhãn hiệu.
- `codingNumber` với mã mã hóa.
- `sealStamp` với tem niêm phong.

Chuẩn hóa so sánh bằng cách bỏ khoảng trắng, dấu câu, khác biệt hoa thường và dấu tiếng Việt. Riêng tem niêm phong được tách thành các token bắt đầu bằng `IEMM`, bỏ ký tự phân cách và so sánh không phụ thuộc thứ tự.

### 3. OCR và thông số kỹ thuật

Nếu OCR có Model, nhãn hiệu hoặc tem niêm phong, các trường này được đối chiếu với dữ liệu form. Nếu PYC có chuỗi `specifications`, các giá trị kỹ thuật OCR hoặc form EMC có sẵn (`voltage`, `frequency`, `power`, `current`) phải xuất hiện sau chuẩn hóa trong chuỗi thông số PYC. Mismatch là lỗi; OCR hoặc thông số chưa có giá trị chỉ là cảnh báo.

### 4. Hiển thị và chặn thao tác

- Lỗi hiển thị trong bảng tổng hợp tại vùng thông tin báo cáo, đồng thời đánh dấu trường liên quan.
- Cảnh báo thiếu dữ liệu không chặn thao tác.
- Khi còn lỗi, `Lưu Báo Cáo` và `Xuất File DOCX` không được thực thi.
- Khi không có lỗi, nút thao tác hoạt động như hiện tại.

## Lưu trữ

Khi lưu `KQTNRecord`, giữ lại `testResultsData`, `emcData`, `dayCapDienData` cùng metadata đã kiểm tra để màn hình KQTN và lịch sử phiên bản có thể truy nguyên dữ liệu nguồn.

## Kiểm thử

- Unit test cho parser ngày đơn/dải ngày và thứ tự thời gian.
- Unit test cho chuẩn hóa Model/nhãn hiệu/tem niêm phong.
- Unit test cho mismatch metadata, OCR và thông số kỹ thuật.
- Regression test đảm bảo ReportGenerator chặn hai thao tác lưu/xuất khi validation có lỗi.

## Ràng buộc

- Không sửa `.env`.
- Không thêm dependency.
- File TS/TSX/Markdown mới hoặc chỉnh sửa phải giữ header/footer theo `AGENTS.md`.

<!-- --- End of 2026-08-17-report-consistency-validation-design.md --- -->
