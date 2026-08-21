<!--
Author: Gemini
OS support: Web/Node
Description: Spec giảm tỷ lệ hiển thị giao diện web toàn cục xuống 90%
-->

# Spec: Global UI Scale 90%

## Bối cảnh

Ứng dụng hiện hiển thị giao diện web ở tỷ lệ mặc định 100%. Người dùng yêu cầu thu nhỏ toàn bộ giao diện xuống 90% để tăng không gian làm việc. Phạm vi chỉ gồm UI chạy trong trình duyệt; nội dung in, xuất báo cáo và tài liệu DOCX/PDF phải giữ nguyên kích thước riêng của chúng.

## Quyết định thiết kế

Áp dụng `zoom: 0.9` cho vùng mount React `#root` trong stylesheet toàn cục. Giữ chiều rộng và chiều cao tối thiểu của vùng này ở `100%` để vùng layout không vượt viewport khi `html, body` khóa overflow. Không sửa từng Tailwind class hoặc token typography riêng lẻ.

## Phạm vi và hành vi

- Thu nhỏ đồng nhất sidebar, header, card, bảng, form, modal và các vùng tương tác trong web app.
- Thay đổi runtime chỉ nằm ở CSS/UI; không sửa dữ liệu, API, logic nghiệp vụ, điều hướng hoặc tích hợp hệ thống.
- Giữ nguyên DOM, dữ liệu, điều hướng, breakpoint, nội dung in và logic xuất file.
- Không áp dụng CSS scale cho các cửa sổ in được tạo bằng HTML riêng hoặc pipeline tạo DOCX/PDF.
- `body` tiếp tục quản lý viewport và overflow; vùng `#root` chịu trách nhiệm duy nhất về tỷ lệ hiển thị ứng dụng.

## Tiêu chí nghiệm thu

1. UI chính quan sát được ở tỷ lệ 90% so với trước thay đổi.
2. Giao diện vẫn phủ đủ chiều rộng và chiều cao viewport, không phát sinh khoảng trống hoặc scroll ngang không cần thiết.
3. Modal, bảng có scroll, input/textarea/select và sidebar vẫn thao tác được.
4. Nội dung in/xuất báo cáo không thay đổi kích thước.
5. Build và kiểm tra TypeScript hoàn thành không lỗi.

## Kiểm thử

- Kiểm tra tĩnh stylesheet để xác nhận chỉ có một cấu hình scale global tại `#root` và vùng chứa không vượt viewport.
- Chạy `npm run lint`.
- Chạy `npm run build`.
- Nếu có thể mở trình duyệt local, kiểm tra nhanh viewport desktop và mobile cho layout, modal và vùng scroll.

<!-- --- End of 2026-08-17-global-ui-scale-design.md --- -->
