# Bộ template DOCX PGD

Các file `.docx` trong thư mục này là biểu mẫu nguồn của Phòng Giám định. Placeholder dùng định dạng `[[key]]` và phải được giữ liền trong một Word run để bộ sinh tài liệu nhận diện ổn định.

- `manifest.json` ghi nhận file nguồn và danh sách placeholder của từng biểu mẫu.
- Metadata `placeholderKeys` được dùng để dựng form nhập liệu trong module `Soạn thảo tài liệu`.
- Mỗi DOCX là một biểu mẫu PGD có bố cục nghiệp vụ thật: tiêu đề kiểm soát, mục thông tin, bảng nghiệp vụ và vùng xác nhận/chữ ký. Runtime thay giá trị vào đúng placeholder trong DOCX; không tạo lại bố cục bằng bảng `Cell/Giá trị`.
- Bản mẫu được chuẩn hóa từ các nhóm biểu mẫu bìa hồ sơ, phân công, kế hoạch, hiện trường, lấy mẫu, PTN, đánh giá, quyết định và chứng thư. Các mẫu không chứa dữ liệu khách hàng, số liệu, chữ ký, ảnh hoặc hồ sơ lịch sử.
- Cell đặc thù được phân phạm vi theo catalog: `GĐ-THEP-KG` cho thép/kim loại, `GĐ-MAY-01` cho máy móc/dây chuyền và `GĐ-THAN-01` cho than. Form nhập liệu trong app chỉ hiển thị cell của đúng nhóm; các trường máy, đồng bộ dây chuyền, nguồn than và chỉ tiêu than được map vào các placeholder tương ứng.
