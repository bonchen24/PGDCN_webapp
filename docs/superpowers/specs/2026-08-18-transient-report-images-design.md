<!--
Author: Gemini
OS support: Web/Node
Description: Thiết kế không lưu ảnh OCR và ảnh tạm của quy trình lập báo cáo vào PostgreSQL
-->

# Ảnh OCR và ảnh lập báo cáo chỉ tồn tại tạm thời

## Mục tiêu

Ngăn ảnh được tải lên hoặc dán trong luồng OCR và Lập báo cáo bị ghi vào `kqtnRecords`/`app_documents`. Ảnh vẫn dùng được trong phiên để crop, OCR và xuất DOCX.

## Thiết kế

- `RequestModal` và các luồng OCR tiếp tục dùng file/data URL trong state/request tạm, không thêm persistence.
- `ReportGeneratorView` vẫn giữ ảnh trong state để xem, crop, OCR và gửi `/api/generate-docx`.
- Trước `addKqtnRecord`, tạo payload persistence đã loại bỏ `productPhoto1`, `productPhoto2`, `nameplatePhoto1`, `nameplatePhoto2`, `nameplatePhotos` và `emcData.images`.
- Không thay đổi các trường số liệu KQTN, metadata báo cáo hoặc bảng kết quả.
- Các ảnh legacy đã tồn tại trong DB/Storage không bị xóa bởi runtime. Sau khi có backup và xác nhận riêng, đợt cleanup ngày 2026-08-18 đã xóa 114 object Storage, 114 dòng `file_assets` và các trường ảnh trong 14 payload KQTN.

## Tiêu chí nghiệm thu

1. Unit test chứng minh payload lưu KQTN không còn các trường ảnh tạm nhưng giữ nguyên số liệu và metadata.
2. Test contract chứng minh `ReportGeneratorView` gọi helper trước `addKqtnRecord`.
3. Full test, lint và build pass.
4. Không phát sinh thêm `file_assets` khi người dùng lưu báo cáo mới.

<!-- --- End of 2026-08-18-transient-report-images-design.md --- -->
