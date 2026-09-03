# Bộ template DOCX PGD

Các file `.docx` trong thư mục này là biểu mẫu nguồn của Phòng Giám định. Placeholder dùng định dạng `[[key]]` và phải được giữ liền trong một Word run để bộ sinh tài liệu nhận diện ổn định.

- `manifest.json` ghi nhận file nguồn và danh sách placeholder của từng biểu mẫu.
- Metadata `placeholderKeys` được dùng để dựng form nhập liệu trong trang `Tạo tài liệu PGD`.
- Runtime thay giá trị vào chính DOCX nguồn; không tạo lại bố cục bằng bảng `Cell/Giá trị`.
