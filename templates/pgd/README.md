# Bộ template DOCX PGD

Các file `.docx` trong thư mục này là bộ asset biểu mẫu đã chuẩn hóa của Phòng Giám định. Runtime v1 mở đầy đủ các nhóm PGD đã khảo sát: thép/kim loại (`GĐ-THEP-KG`, `GĐ-THEP-TT58`), máy móc/dây chuyền (`GĐ-MAY-01`), than (`GĐ-THAN-01`), giám định ngoài (`GĐ-NGOAI-01`) và hàng hóa/đối tượng khác (`GĐ-HH-01`). Placeholder dùng định dạng `[[key]]` và phải được giữ liền trong một Word run để bộ sinh tài liệu nhận diện ổn định.

- `manifest.json` ghi nhận file nguồn và danh sách placeholder của từng biểu mẫu.
- Metadata `placeholderKeys` được dùng để dựng form nhập liệu trong module `Soạn thảo tài liệu`.
- Mỗi DOCX là một biểu mẫu PGD có bố cục nghiệp vụ thật: tiêu đề kiểm soát, mục thông tin, bảng nghiệp vụ và vùng xác nhận/chữ ký. Runtime thay giá trị vào đúng placeholder trong DOCX; không tạo lại bố cục bằng bảng `Cell/Giá trị`.
- Bản mẫu được chuẩn hóa từ các nhóm biểu mẫu bìa hồ sơ, phân công, kế hoạch, hiện trường, lấy mẫu, PTN, đánh giá, quyết định và chứng thư. Các mẫu không chứa dữ liệu khách hàng, số liệu, chữ ký, ảnh hoặc hồ sơ lịch sử.
- Cell đặc thù được phân phạm vi theo catalog: hai profile thép/kim loại, máy móc/dây chuyền, than, giám định ngoài và hàng hóa khác. Form nhập liệu trong app chỉ hiển thị cell của đúng nhóm; trường máy, đồng bộ dây chuyền, nguồn than, chỉ tiêu than và dữ liệu hàng hóa khác không bị trộn vào hồ sơ thép.
