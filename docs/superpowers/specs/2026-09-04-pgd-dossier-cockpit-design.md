# Thiết kế PGD theo workspace bộ hồ sơ

## Bối cảnh và nguồn tham chiếu

PGD là miền Giám định của Phòng Giám định - Chứng nhận. Nguồn biểu mẫu PGD được đọc read-only từ các bộ biểu mẫu trong Desktop, tập trung vào nhóm `BM Giám định thép` và bộ TT58 trong `Giám định/Mẫu biên bản/TT58`. Nguồn cho thấy một hồ sơ thực tế được hình thành theo chuỗi: PYC/chứng từ → phân công/kế hoạch → hiện trường/diễn biến/lấy mẫu → PTN/bàn giao → KQTN/đánh giá → báo cáo/chứng thư → duyệt/ký/lưu.

Nguồn Desktop có cả nhóm biểu mẫu mang nội dung chứng nhận/CNSP và các hồ sơ lịch sử. Những nội dung này chỉ dùng để rút trích cấu trúc nghiệp vụ. Không import khách hàng, số liệu, chữ ký, file lịch sử hoặc đường dẫn Desktop/UNC vào runtime. `QC20` không phải mã catalog PGD; PGD sử dụng lĩnh vực trung tính `GĐ-THEP-KG`. Các trường phí, thanh toán và báo giá bị loại khỏi phạm vi.

## Mục tiêu

- Mỗi PYC là một bộ hồ sơ PGD duy nhất.
- Người phụ trách theo hồ sơ có thể thực hiện xuyên suốt từ tiếp nhận đến đóng gói và trình lãnh đạo.
- Các trang PGD là các trạm thao tác trên cùng hồ sơ, không phải các bảng kiểm tra folder và không tạo projection data riêng.
- Bốn bề mặt từng bị rỗng phải có bộ chọn hồ sơ, form nghiệp vụ, trạng thái bằng chứng và hành động lưu rõ ràng.
- Soạn thảo tài liệu sử dụng DOCX thật, placeholder/cell có cấu trúc và giữ snapshot khi phát hành.

## Kiến trúc điều hướng

Shell chung vẫn cung cấp Tổng quan phòng, Khách hàng, Trợ lý AI, Nhật ký hoạt động và Cài đặt hệ thống. Sidebar PGD chỉ hiển thị các bề mặt nghiệp vụ sau:

1. **Hồ sơ PYC** — danh sách, tìm kiếm/lọc và nút Tạo PYC mở modal.
2. **Chuẩn bị & phân công** — năng lực, kế hoạch và giao người phụ trách/đoàn.
3. **Hiện trường & lấy mẫu** — bằng chứng hiện trường, diễn biến, ghi chép và lấy mẫu.
4. **PTN & kết quả** — bàn giao mẫu, yêu cầu PTN, tiếp nhận và xem xét KQTN.
5. **Báo cáo, chứng thư & lưu trữ** — báo cáo, phê duyệt, ký, trả kết quả và mục lục.
6. **Soạn thảo tài liệu** — chọn PYC, chọn loại tài liệu và sinh DOCX/PDF.

Không có mục Cài đặt PGD, Cài đặt PCN, Nhân sự PGD hoặc Template DOCX riêng trong sidebar. Nhân sự/phòng ban/chức vụ/mật khẩu thuộc Cài đặt hệ thống. Template DOCX được quản lý trong modal cục bộ **Cài đặt DOCX** mở từ Soạn thảo tài liệu; modal này chỉ có file template, phiên bản, trạng thái, placeholder/cell và thao tác quản trị theo quyền.

## Mô hình workspace dùng chung

Các trạm dùng một workspace hồ sơ PGD có các thành phần cố định:

- Thanh chọn hồ sơ: tìm theo mã PYC/số đăng ký, khách hàng, sản phẩm/lô; có lọc nhóm sản phẩm và trạng thái.
- Tóm tắt hồ sơ: khách hàng snapshot, lĩnh vực, nhóm sản phẩm, phương thức, tiêu chuẩn snapshot, địa điểm, thời gian, chủ hồ sơ và trạng thái.
- Workflow stepper 5 trạm: Tiếp nhận & năng lực → Chuẩn bị & phân công → Hiện trường & lấy mẫu → PTN & xem xét kết quả → Báo cáo, phê duyệt & trả kết quả.
- Khu vực thao tác của trạm hiện tại: form có dữ liệu hiện hành, nút lưu, cảnh báo thiếu bằng chứng và quyền sửa theo lifecycle.
- Khu vực bộ hồ sơ: checklist theo requirement, trạng thái hiện hành/version, tài liệu upload và tài liệu sinh.
- Lối mở “Mở hồ sơ đầy đủ” dùng cùng card/workspace chuẩn; không copy dữ liệu sang queue.

Khi chưa chọn hồ sơ, trạm hiển thị danh sách PYC phù hợp với trạng thái và lời nhắc chọn một hồ sơ. Khi chọn hồ sơ, form của trạm xuất hiện ngay trong cùng trang. Mở từ một card phải giữ đúng PYC, không mở một modal rỗng chỉ có danh sách.

## Nội dung và field theo trạm

### Chuẩn bị & phân công

Form phải hỗ trợ:

- xem xét phạm vi/năng lực và thiếu hồ sơ;
- người phụ trách hồ sơ, trưởng nhóm, giám định viên, người soát xét kỹ thuật;
- ngày/giờ, địa điểm, phương thức/tiêu chuẩn;
- kế hoạch đánh giá với lịch, nội dung, đoàn và dòng sản phẩm;
- cam kết độc lập/không xung đột lợi ích, hướng dẫn bổ sung và lưu vết phê duyệt phân công.

### Hiện trường & lấy mẫu

Form phải hỗ trợ:

- nhận dạng lô, mô tả sản phẩm, mác, kích thước, khối lượng/số lượng;
- xuất xứ/nhà sản xuất, bao gói, bảo quản, nhãn và chứng từ tham chiếu;
- kết quả kiểm tra, số điểm không phù hợp/khuyến nghị, kết luận và đại diện khách hàng;
- diễn biến theo mốc giờ và ghi chép theo buổi sáng/chiều;
- bảng dòng mẫu gồm mô tả, cỡ lô, số lượng, kích thước, mã mẫu, chỉ tiêu và phương pháp;
- tách rõ phần `LAB` và `RETAINED`, niêm phong, người nhận, thời hạn lưu và trạng thái mẫu.

Với `GĐ-THEP-KG` và `TT58`, form có các field riêng cho phương thức đánh giá (`METHOD_7`/Phương thức 7), tiêu chuẩn công bố và căn cứ lấy mẫu. Không hiển thị các field thép như bắt buộc cho nhóm máy/dây chuyền hoặc than.

### PTN & kết quả

Form phải hỗ trợ:

- sổ mẫu theo từng PYC, mã mẫu, đích mẫu và trạng thái bàn giao;
- phiếu giao nhận mẫu với bên giao/nhận, PTN, thời điểm, số lượng, niêm phong;
- PYC PTN với bảng dòng mẫu, chỉ tiêu và phương pháp thử;
- tiếp nhận KQTN, số/ngày báo cáo, file kết quả khi có và liên kết đúng yêu cầu PTN;
- xem xét KQTN: đầy đủ/thiếu, phù hợp/không phù hợp, chỉ tiêu thiếu, kiến nghị và người kiểm tra;
- cảnh báo rõ PYC PTN chưa có kết quả, mẫu không khớp hoặc chưa hoàn tất đánh giá.

Không hiển thị các trường phí thử nghiệm, khách hàng trả trước, còn lại, báo giá hoặc thanh toán.

### Báo cáo, chứng thư & lưu trữ

Form phải hỗ trợ:

- bảng kết quả theo loại hình giám định và nhóm sản phẩm;
- báo cáo/kết luận dựa trên KQTN đã xem xét;
- quyết định/phê duyệt kỹ thuật, phê duyệt lãnh đạo và ký;
- chứng thư giám định với chứng từ, tiêu chuẩn, phương thức, dòng sản phẩm, xuất xứ, khối lượng/số lượng và tham chiếu KQTN;
- khóa snapshot template/tiêu chuẩn/cell values khi chuyển duyệt hoặc ký;
- bìa/mục lục theo checklist hiện hành, trả kết quả và lưu trữ.

## Soạn thảo tài liệu và cell

Soạn thảo tài liệu có bộ chọn PYC và loại template. Field scalar hiển thị theo section nghiệp vụ; cell `TABLE` hiển thị editor theo hàng/cột, cho phép thêm/xóa dòng, không yêu cầu nhập JSON. Các section tối thiểu là `identity`, `customer`, `product`, `criteria`, `sampling`, `documents`, `results`, `approval`, `signatures`.

Nút **Cài đặt DOCX** mở modal tại chỗ. Modal không điều hướng, không nằm trong Cài đặt hệ thống, không đọc Desktop/UNC và không cho sửa nội dung hồ sơ. Template đã dùng để phát hành phải tạo phiên bản mới, không sửa lineage cũ.

## Ranh giới dữ liệu và quyền

- Mọi record/tài liệu mới mang `domain=pgd` và đi qua boundary `/api/pgd/*`.
- Mỗi trạm đọc/ghi `PgdInspectionRequest` và collection PGD liên kết; không tạo collection cho riêng projection trạm.
- Server kiểm tra scope PGD, lifecycle, assignment và quyền chủ hồ sơ/quản lý; UI chỉ phản ánh quyền.
- PCN và PGD dùng chung tài khoản/khách hàng nhưng không đọc collection hoặc template của nhau.
- `QC20` không xuất hiện trong catalog, bộ lọc hay form PGD. Thép không gỉ PGD dùng `GĐ-THEP-KG`.
- Không có runtime watcher/import/scan folder; chỉ dùng definition/asset đã duyệt trong repo hoặc Storage PGD.

## Tiêu chí nghiệm thu

- Bốn trạm Hiện trường, PTN, Báo cáo và Soạn thảo đều có chọn PYC, form và trạng thái dữ liệu thực.
- Một PYC đi được từ tạo hồ sơ đến hiện trường, tách/bàn giao mẫu, KQTN, báo cáo, duyệt, ký và trả kết quả.
- Bảng mẫu, bảng PTN, bảng kết quả và bảng chứng thư hỗ trợ dòng lặp.
- Có cảnh báo thiếu KQTN và chặn cổng lifecycle đúng bằng chứng server.
- Modal Cài đặt DOCX hoạt động độc lập với Cài đặt hệ thống.
- Không có đường dẫn Desktop/UNC trong runtime code và không có QC20 trong catalog PGD.
- Existing typecheck/test/build không bị phá vỡ; test mới bao phủ navigation, stage forms, cell table và boundary PGD/PCN.
