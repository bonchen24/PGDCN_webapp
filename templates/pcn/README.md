# Bộ biểu mẫu PCN

Đây là bộ mẫu DOCX trống cho các hồ sơ phát sinh mới của Phòng Chứng nhận.

- `manifest.json` là catalog runtime duy nhất: định danh mẫu, loại tài liệu, lĩnh vực áp dụng, trạng thái và placeholder bắt buộc.
- Mỗi file giữ bố cục Word, tiêu đề IEMM/TVCI/PCN, bảng, vùng ký và trường nhập liệu phù hợp với nghiệp vụ PCN.
- `PCN_Bao_cao_KQTN.docx` chỉ dùng để tham chiếu cấu trúc. PCN không sinh KQTN; người dùng upload bản scan do phòng thử nghiệm cấp, chạy OCR và xác nhận kết quả.
- Bộ mẫu không chứa tên khách hàng, số hồ sơ, chữ ký, ảnh hoặc dữ liệu lịch sử thật.
- Ứng dụng chỉ đọc các asset đã đóng gói trong repo hoặc private Storage PCN. Nguồn tài liệu nghiên cứu được dùng một lần trong giai đoạn authoring, không phải dependency runtime và không có đường dẫn nguồn trong catalog.

Placeholder dùng delimiter `[[key]]`. Danh sách khóa bắt buộc của từng mẫu nằm trong `manifest.json` và được form nhập liệu PCN dùng để tạo control tương ứng.
