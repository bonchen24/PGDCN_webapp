<!--
Author: Gemini
OS support: Web/Node
Description: Sách hướng dẫn sử dụng Hệ thống quản lý thử nghiệm Phòng Điện - Điện tử (DDT Lab Upgrade)
-->

# HƯỚNG DẪN SỬ DỤNG HỆ THỐNG QUẢN LÝ THỬ NGHIỆM PHÒNG ĐIỆN - ĐIỆN TỬ
## (DDT Lab Upgrade - Hệ Thống Điều Phối & Lên Lịch Tự Động)

Hệ thống quản lý thử nghiệm Phòng Điện - Điện tử là một giải pháp full-stack toàn diện được thiết kế để chuẩn hóa, tự động hóa toàn bộ quy trình từ tiếp nhận yêu cầu, quản lý kho mẫu, mã hóa thông tin, lên lịch thử nghiệm thông minh (An toàn điện & EMC) cho tới duyệt kết quả và trả mẫu cho khách hàng.

---

## 📌 MỤC LỤC
1. [TỔNG QUAN HỆ THỐNG](#1-tổng-quan-hệ-thống)
2. [HƯỚNG DẪN ĐĂNG NHẬP & KHÔI PHỤC MẬT KHẨU](#2-hướng-dẫn-đăng-nhập--khôi-phục-mật-khẩu)
3. [PHÂN LOẠI NGƯỜI DÙNG & PHÂN QUYỀN TRUY CẬP](#3-phân-loại-người-dùng--phân-quyền-truy-cập)
   - [Vai trò Quản trị viên (Admin)](#vai-trò-quản-trị-viên-admin)
   - [Vai trò Thử nghiệm viên (Tester / Người dùng thông thường)](#vai-trò-thử-nghiệm-viên-tester--người-dùng-thông-thường)
   - [Vai trò Khách hàng / Viewer (Guest)](#vai-trò-khách-hàng--viewer-guest)
4. [HƯỚNG DẪN SỬ DỤNG CHI TIẾT CÁC CHỨC NĂNG CHÍNH](#4-hướng-dẫn-sử-dụng-chi-tiết-các-chức-năng-chính)
   - [Bảng nhắc việc & Đánh giá KPI Nhân sự (Dashboard)](#bảng-nhắc-việc--đánh-giá-kpi-nhân-sự-dashboard)
   - [Quản lý và Tiếp nhận Phiếu yêu cầu (PYC)](#quản-lý-và-tiếp-nhận-phiếu-yêu-cầu-pyc)
   - [Sổ tổng hợp & Bảng dữ liệu hoạt động](#sổ-tổng-hợp--bảng-dữ-liệu-hoạt-động)
   - [Hệ thống điều phối lịch tự động & thủ công](#hệ-thống-điều-phối-lịch-tự-động--thủ-công)
   - [Tự động Lập Báo Cáo Thử Nghiệm & Xuất Word (.docx)](#tự-động-lập-báo-cáo-thử-nghiệm--xuất-word-docx)
   - [Quản lý Kho mẫu Vật lý](#quản-lý-kho-mẫu-vật-lý)
   - [Nhập kết quả & Phê duyệt kết quả thử nghiệm](#nhập-kết-quả--phê-duyệt-kết-quả-thử-nghiệm)
   - [In ấn Phiếu yêu cầu & Quản lý Biên bản giao nhận mẫu](#in-ấn-phiếu-yêu-cầu--quản-lý-biên-bản-giao-nhận-mẫu)
   - [Tương tác Trợ lý ảo AI ChatBot](#tương-tác-trợ-lý-ảo-ai-chatbot)
   - [Đồng bộ hóa & Lưu trữ đám mây](#đồng-bộ-hóa--lưu-trữ-đám-mây)
5. [CÀI ĐẶT & CẤU HÌNH HỆ THỐNG (DÀNH CHO ADMIN)](#5-cài-đặt--cấu-hình-hệ-thống-dành-cho-admin)
6. [CÂU HỎI THƯỜNG GẶP (FAQ)](#6-câu-hỏi-thường-gặp-faq)

---

## 1. TỔNG QUAN HỆ THỐNG

Hệ thống được phát triển nhằm tối ưu hóa năng suất hoạt động của Phòng Điện - Điện tử với các ưu điểm vượt trội:
*   **Tự động hóa lập lịch**: Thuật toán tự động tính toán thời hạn nội bộ (Internal Deadline), tối ưu hóa lịch thử nghiệm theo phân loại máy, công suất và công suất buồng EMC (Chamber 1 & Chamber 2).
*   **Bảng nhắc việc & KPI**: Quản lý khối lượng công việc chưa hoàn thành của từng nhân sự dưới dạng bảng Kanban trực quan, đồng thời đánh giá hiệu suất KPI thời gian thực.
*   **Bảo mật thông tin**: Mã hóa thông tin mẫu thử (ITDC, ITD, EMC) để đảm bảo tính khách quan trong thử nghiệm.
*   **Tương tác thông minh**: Hỗ trợ trợ lý ảo Gemini AI giải đáp nhanh các câu hỏi nghiệp vụ và tư vấn tối ưu lịch trình.
*   **Đồng bộ đám mây**: Dữ liệu đồng bộ thời gian thực trên hệ thống điện toán đám mây an toàn, đảm bảo khả năng truy cập mọi lúc, mọi nơi.

<img src="https://picsum.photos/seed/laboratory_dashboard/800/450" alt="Tổng quan giao diện bảng điều khiển" referrerPolicy="no-referrer" style="width:100%; border-radius:12px; margin: 16px 0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />

---

## 2. HƯỚNG DẪN ĐĂNG NHẬP & KHÔI PHỤC MẬT KHẨU

### Đăng nhập hệ thống:
1. Truy cập vào ứng dụng qua đường dẫn được cấp.
2. Nhập **Tên đăng nhập** (Tài khoản nội bộ hoặc email) và **Mật khẩu**.
3. Tích chọn **Lưu mật khẩu** nếu sử dụng thiết bị cá nhân để bỏ qua bước đăng nhập lần sau.
4. Nhấn nút **ĐĂNG NHẬP HỆ THỐNG**.

<img src="https://picsum.photos/seed/laboratory_login/800/450" alt="Giao diện Đăng nhập Hệ thống" referrerPolicy="no-referrer" style="width:100%; border-radius:12px; margin: 16px 0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />

### Quên mật khẩu & Khôi phục tự động:
1. Nếu quên mật khẩu, nhấn nút **Quên mật khẩu?** tại màn hình đăng nhập.
2. Nhập chính xác 3 thông tin để xác minh danh tính:
   *   **Tên đăng nhập**
   *   **Họ và tên đăng ký** (Ví dụ: *Lương Xuân Hùng*)
   *   **Số điện thoại hoặc Email** đã liên kết.
3. Nhấn **Xác nhận & Gửi yêu cầu**.
4. Hệ thống sẽ tự động đối sánh thông tin trong cơ sở dữ liệu:
   *   Nếu trùng khớp hoàn toàn, mật khẩu sẽ tự động được reset về mật khẩu mặc định là `Abc123456`.
   *   Đồng thời, một yêu cầu ghi nhận sẽ gửi trực tiếp tới hệ thống của Quản trị viên để theo dõi bảo mật.

---

## 3. PHÂN LOẠI NGƯỜI DÙNG & PHÂN QUYỀN TRUY CẬP

Hệ thống thiết lập hàng rào phân quyền chặt chẽ thông qua 3 nhóm người dùng chính nhằm tối ưu hóa quy trình nghiệp vụ chuyên biệt:

```
+--------------------------------------------------------+
|                      ADMINISTRATOR                     |
|  (Toàn quyền cấu hình, phê duyệt & quản lý danh mục)   |
+---------------------------+----------------------------+
                            |
         +------------------+------------------+
         |                                     |
+--------v-----------+               +---------v----------+
|  REGULAR USER      |               |     GUEST ROLE     |
|  (Tester/Nhân viên)|               |   (Viewer/Khách)   |
|  - Thử nghiệm      |               |  - Tra cứu mẫu     |
|  - Cập nhật kho    |               |  - Xem lịch chung  |
|  - Cập nhật KQTN   |               |  - Tải biên bản    |
+--------------------+               +--------------------+
```

### Vai trò Quản trị viên (Admin)
Nhóm người dùng nắm giữ quyền hạn cao nhất, chịu trách nhiệm vận hành và duy trì hệ thống ổn định.

*   **Đặc quyền chính**:
    *   Thêm mới, sửa đổi, hoặc xóa bỏ các Phiếu yêu cầu thử nghiệm (PYC).
    *   Cấu hình tham số hệ thống: Ngày làm việc cuối tuần (Thứ 7, Chủ Nhật), định mức tải trọng tối đa, chỉ định Thử nghiệm viên mặc định cho các phân vùng thử nghiệm (An toàn điện, EMC Chamber 1, EMC Chamber 2).
    *   Quản lý danh mục cơ sở dữ liệu nền bao gồm: Khách hàng (Customers), Thương hiệu (Brands), và thông số mặc định của Sản phẩm (Products).
    *   Duyệt hoặc bác bỏ kết quả thử nghiệm từ Tester gửi lên; cập nhật trạng thái phiếu sang `Hoàn thành` hoặc `Cần bổ sung`.
    *   Đồng bộ dữ liệu thời gian thực lên hệ thống cơ sở dữ liệu đám mây.

### Vai trò Thử nghiệm viên (Tester / Người dùng thông thường)
Đội ngũ kỹ thuật viên trực tiếp thực thi các công việc chuyên môn tại phòng thí nghiệm.

*   **Chức năng cho phép**:
    *   Theo dõi Bảng nhắc việc cá nhân và danh sách/lịch thử nghiệm trong tuần/tháng trên 2 phân hệ **Lịch An toàn điện (ATD)** và **Lịch Tương thích điện từ (EMC)**.
    *   Quản lý kho mẫu vật lý: Đổi trạng thái mẫu thử từ `Chờ nhận mẫu` sang `Mẫu trong kho` khi nhận bàn giao thực tế, và `Đã trả khách` sau khi hoàn thành.
    *   Cập nhật kết quả thử nghiệm tổng hợp (nhập kết quả hoặc tải báo cáo PDF để AI hỗ trợ bóc tách), cập nhật trạng thái thử nghiệm và gửi Admin phê duyệt KQTN.
    *   Sử dụng trợ lý ảo **AIChatBot** để tra cứu nhanh thông tin tiêu chuẩn thử nghiệm (TCVN/IEC) hoặc hỏi ý kiến đề xuất thời gian tối ưu cho các mẫu thiết bị đặc thù.

### Vai trò Khách hàng / Viewer (Guest)
Nhóm đối tác liên kết hoặc khách hàng gửi mẫu thử nghiệm cần giám sát tiến độ công việc một cách minh bạch.

*   **Chức năng cho phép**:
    *   Truy cập giao diện chính với chế độ **Chỉ xem (Read-only)** để theo dõi danh sách phiếu yêu cầu của chính đơn vị mình gửi thử nghiệm.
    *   Tra cứu nhanh mã số hóa của thiết bị (mã ITD/EMC) và tình trạng thực tế của mẫu thử (đang lưu kho, đang thử nghiệm, hay đã có kết quả).
    *   Sử dụng công cụ **In phiếu yêu cầu** và **Biên bản giao nhận mẫu** trực tuyến dưới dạng file Word (.docx) đã được điền sẵn thông tin.
    *   **Giới hạn cực kỳ nghiêm ngặt**: Không được phép sửa đổi bất kỳ trường thông tin nào của phiếu yêu cầu, không được phê duyệt kết quả, không truy cập được vào trang cấu hình hệ thống hoặc quản trị danh mục.

---

## 4. HƯỚNG DẪN SỬ DỤNG CHI TIẾT CÁC CHỨC NĂNG CHÍNH

### Bảng nhắc việc & Đánh giá KPI Nhân sự (Dashboard)

Màn hình **Tổng quan** (`DashboardView`) đóng vai trò trung tâm theo dõi khối lượng công việc tồn đọng và đánh giá hiệu suất của nhân sự phòng lab:

*   **Bảng nhắc việc theo Kỹ thuật viên (Tester Board)**: Hiển thị toàn bộ các nhiệm vụ chưa hoàn thành được phân chia thành từng cột theo từng Kỹ thuật viên (Tester) phụ trách. Giúp quản lý và nhân sự nắm bắt ngay lập tức danh sách các mẫu thiết bị đang chờ xử lý.
*   **Thống kê & Đánh giá KPI Nhân sự**: Thống kê số lượng công việc đã hoàn thành và đang thực hiện theo các chu kỳ linh hoạt (*Hôm nay, Tuần này, Tháng này, Tất cả*). Hệ thống tự động phân hạng và gắn nhãn KPI (*Sẵn sàng, Đang làm, Đạt KPI, Tốt, Xuất sắc*).
*   **Tùy chỉnh Nhân sự & Chế độ Toàn màn hình**: 
    *   Admin có thể chọn **Tùy chỉnh nhân sự** để ẩn/hiện từng kỹ thuật viên trên bảng theo ca trực hoặc bộ phận.
    *   Nút **Toàn màn hình (Fullscreen)** cho phép mở rộng giao diện Bảng nhắc việc để trình chiếu trên các màn hình giám sát tiến độ trong phòng thí nghiệm.

---

### Quản lý và Tiếp nhận Phiếu yêu cầu (PYC)

Phiếu yêu cầu (PYC) là thực thể trung tâm của phần mềm. Mọi mẫu thử khi đi vào phòng điện - điện tử đều phải được khởi tạo phiếu tại đây.

*   **Tạo mới Phiếu yêu cầu (Chỉ Admin)**:
    1. Click chọn tab **Phiếu yêu cầu** trên menu chính.
    2. Nhấn nút **Thêm Phiếu yêu cầu** (biểu tượng dấu cộng `+`).
    3. Điền đầy đủ thông tin vào Form:
       *   *Thông tin khách hàng*: Chọn từ danh sách gợi ý tự động (auto-suggest) hoặc nhập thủ công.
       *   *Thông tin thiết bị*: Tên thiết bị, Thương hiệu, Model, Thông số kỹ thuật, Số lượng, Loại hình thử nghiệm (ATD, EMC hoặc cả hai).
       *   *Mức độ ưu tiên*: Bình thường, Cao, VIP, Hỏa tốc (Urgent).
    4. Nhấn **Lưu** để hệ thống ghi nhận và tự động sinh mã PYC chuẩn hóa.

*   **Cấu trúc & Quy tắc đánh Mã Phiếu Yêu Cầu (`requestCode`)**:
    *   **Định dạng tự động theo chuỗi thời gian**: Hệ thống tự động sinh mã phiếu có cấu trúc `PYC-YYMMDD-TT` (Ví dụ: `PYC-260802-01` đại diện cho Phiếu Yêu Cầu số 01 khởi tạo ngày 02/08/2026).
    *   **Mã số lô tổng trong năm**: Đồng thời tính toán mã lô tổng dạng `<SốLô>-<Năm>` (Ví dụ: `1001-26`) cho đợt tiếp nhận thiết bị nhằm phục vụ thống kê số lượng phiếu tiếp nhận trong năm.
    *   **Vai trò pháp lý**: Mã PYC là chìa khóa định danh xuyên suốt cho hồ sơ thử nghiệm, kết nối dữ liệu giữa đăng ký tiếp nhận, phân bổ lịch, kiểm soát kho mẫu, nhập kết quả và xuất báo cáo thử nghiệm chính thức.

*   **Quy chuẩn Đánh Mã & Mã Hóa Mẫu Thử (Sample Coding & Seal Stamps)**:
    *   **Tem niêm phong (`sealStamp`)**: Mã tem thực tế dán trực tiếp lên mẫu vật lý khi tiếp nhận (Ví dụ: `IEMM.26/EMC/0408-SP-01-M01` hoặc `IEMM.26/HQA/1346.14A-SP-M01`). Tem niêm phong dùng để xác minh tình trạng nguyên vẹn vật lý của mẫu trong suốt quá trình bàn giao, lưu kho và thử nghiệm.
    *   **Cấu trúc Mã hóa lô mẫu theo chuyên môn kỹ thuật**:
        *   **Mã An toàn điện (Số lô ITD)**: Định dạng `ITD <SốLô-YY>-M<ThứTựMẫu>` (Ví dụ: `ITD 1152-26-M01` là mẫu số 01 thuộc lô An toàn điện 1152 năm 2026).
        *   **Mã Tương thích điện từ (Số lô EMC)**: Định dạng `EMC <SốLô-YY>-M<ThứTựMẫu>` (Ví dụ: `EMC 306-26-M01` là mẫu số 01 thuộc lô EMC 306 năm 2026).
        *   **Mã An toàn điện kết hợp (Số lô ITDC)**: Định dạng `ITDC <SốLô-YY>-M<ThứTựMẫu>` sử dụng cho các thiết bị đăng ký cả hai hạng mục thử nghiệm.
    *   **Bảo mật thông tin mẫu**: Mã hóa mẫu giúp ẩn thông tin nhạy cảm của khách hàng trong quá trình kỹ thuật viên (Tester) thao tác trên máy móc, đảm bảo tính trung thực và khách quan tuyệt đối cho kết quả thử nghiệm.

---

### Sổ tổng hợp & Bảng dữ liệu hoạt động

Màn hình **Sổ tổng hợp** (`SummaryLogView.tsx`) cung cấp cái nhìn toàn diện về toàn bộ dữ liệu phiếu yêu cầu, mẫu thử và nhật ký hoạt động thời gian thực của phòng thí nghiệm.

*   **Bảng dữ liệu số tổng hợp (Realtime Cloud DB)**:
    *   **Hiển thị đa cột phong phú**: Quản lý đầy đủ các trường thông tin quan trọng bao gồm: *Ngày yêu cầu, Mã phiếu, Khách hàng, Model, Nhãn hiệu, Số lượng, Tem niêm phong, Phân loại, Loại sản phẩm, **Chỉ tiêu thử nghiệm**, Số lô ITD, Số lô EMC, Số lô ITDC, Trạng thái phiếu, Trạng thái mẫu, Số lần Fail, Người thử nghiệm, Ngày nhận mẫu, Ngày thử nghiệm,...*
    *   **Tìm kiếm thông minh**: Thanh tìm kiếm đa năng cho phép tra cứu tức thì theo *Model, Mã phiếu, Nhãn hiệu, Tem niêm phong, **Chỉ tiêu thử nghiệm**, Mã hóa (ITD/EMC/ITDC), Người thử nghiệm...*
    *   **Cấu hình cột linh hoạt**: Nút **Cấu hình cột** cho phép bật/tắt hiển thị từng cột dữ liệu và tùy chỉnh chiều rộng cột theo nhu cầu quan sát.
    *   **Bộ lọc & Sắp xếp**: Hỗ trợ lọc theo loại phiếu, phân loại, trạng thái mẫu, trạng thái phiếu và sắp xếp linh hoạt theo ngày mới nhất/cũ nhất.
    *   **Nhật ký hoạt động (Audit Trail)**: Dòng thời gian chi tiết ghi nhận từng mốc thời gian tạo phiếu, cập nhật kho, chuyển trạng thái và kết quả thử nghiệm.

---

### Hệ thống điều phối lịch tự động & thủ công

Phần mềm tích hợp bộ máy lên lịch thông minh (Scheduling Engine) giúp điều phối tài nguyên máy móc và con người đạt hiệu suất tối ưu.

<img src="https://picsum.photos/seed/laboratory_schedule/800/450" alt="Giao diện Lên lịch Thử nghiệm" referrerPolicy="no-referrer" style="width:100%; border-radius:12px; margin: 16px 0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />

*   **Lên lịch tự động (Auto-Schedule)**:
    1. Khi PYC ở trạng thái `Đã chấp nhận`, nhấn nút **Tự động xếp lịch** trên bảng điều khiển.
    2. Thuật toán sẽ tự động phân tích:
       *   *Loại máy*: Điều hòa, Tủ lạnh, Máy giặt, Quạt... để tính định mức ngày thử mặc định (Ví dụ: Máy Inverter mất 3 ngày, máy Mono mất 2 ngày).
       *   *Tải trọng buồng thử*: Kiểm tra công suất và sức chứa của Chamber 1 & Chamber 2.
       *   *Lịch trống của Tester*: Chọn Tester chuyên trách chưa bị quá tải lịch.
       *   *Ngày nghỉ/Lễ*: Tự động bỏ qua các ngày nghỉ cuối tuần (nếu cấu hình không làm việc) và các ngày lễ Tết đã khai báo trước đó.
    3. Hệ thống đưa ra ngày dự kiến bắt đầu và ngày kết thúc tối ưu nhất.

*   **Điều chỉnh lịch thủ công (Manual Adjust)**:
    Nếu muốn can thiệp thủ công, người dùng có thể mở phân hệ **Lịch Thử Nghiệm**:
    *   Kéo thả hoặc thay đổi trực tiếp Ngày bắt đầu, Số ngày thử nghiệm ngay trong màn hình chi tiết phiếu.
    *   Hệ thống sẽ ngay lập tức tính toán lại toàn bộ dòng chảy tiến độ liên quan và cập nhật thời hạn hoàn thành (Deadline) mới.

---

### Tự động Lập Báo Cáo Thử Nghiệm & Xuất Word (.docx)

Phân hệ **Lập báo cáo** (`ReportGeneratorView`) được sắp xếp thuận tiện ngay sau tab **Lịch EMC** trên thanh Sidebar, cung cấp quy trình tự động hóa khép kín để lập báo cáo thử nghiệm chính thức theo các tiêu chuẩn TCVN/IEC:

1. **Vị trí điều hướng**:
   * Trên thanh Sidebar bên trái (và Menu điều hướng di động), mục **"Lập báo cáo"** (Biểu tượng `FileText`) nằm ở vị trí sau **Lịch EMC** (Thứ tự: *Tổng quan ➔ Phiếu YC ➔ Sổ tổng hợp ➔ Giao nhận ➔ Lịch ITD ➔ Lịch EMC ➔ **Lập báo cáo** ➔ Thương hiệu...*).

2. **Lựa chọn Tiêu chuẩn & Mẫu thử nghiệm**:
   * **Chọn tiêu chuẩn áp dụng**: Hệ thống hỗ trợ sẵn các tiêu chuẩn An toàn điện & EMC phổ biến (Ví dụ: `TCVN 5699-2-15` cho thiết bị đun nước/nồi cơm, `TCVN 5699-2-80` cho quạt điện, `TCVN 5699-2-21` cho bình đun nước nóng, `TCVN 5699-2-25` cho lò vi sóng, `TCVN 5699-2-35` cho bình đun nước nóng nhanh, `TCVN 5699-2-3` cho bàn là...).
   * **Tự động liên kết PYC**: Chọn phiếu yêu cầu thử nghiệm trong danh sách để tự động điền các thông tin hành chính: *Tên sản phẩm, Model, Nhãn hiệu, Khách hàng, Số lô ITD/EMC, Số lượng mẫu, Ngày nhận mẫu và Ngày thử nghiệm*.

3. **Trích xuất dữ liệu tự động & Đọc tem mác AI (OCR)**:
   * **Trích xuất Radimation / File đo**: Cho phép tải lên file dữ liệu đo đạc (Excel/PDF/Word) từ phần mềm Radimation hoặc báo cáo thô để tự động trích xuất các thông số kỹ thuật, bảng dữ liệu nhiễu và điện áp.
   * **Số hóa tem mác thiết bị bằng Gemini AI**: Tải lên ảnh chụp tem mác/nhãn thông số sản phẩm, AI sẽ tự động đọc (OCR) và trích xuất chính xác Điện áp danh định, Công suất, Tần số, Cấp bảo vệ, Mã kiểu dáng...

4. **Biên tập Bảng kết quả thử nghiệm (Clauses Editor)**:
   * **Phân loại trạng thái điều khoản**: Kỹ thuật viên dễ dàng đánh giá từng điều khoản thử nghiệm theo các mức chuẩn: `P` (Pass / Đạt), `F` (Fail / Không đạt), `N/A` (Not Applicable / Không áp dụng), `N/T` (Not Tested / Chưa thử).
   * **Ghi chú & Số liệu chi tiết**: Cho phép nhập số liệu đo thực tế (Điện trở dòng rò, Độ tăng nhiệt, Độ bền điện, Khoảng cách rò...) cho từng mục trong bảng điều khoản.

5. **Quản lý Hình ảnh thử nghiệm & Đẩy lưu trữ NAS**:
   * **Đính kèm hình ảnh**: Đơn giản hóa việc tải lên và đính kèm ảnh chụp tổng thể sản phẩm, tem nhãn, sơ đồ nguyên lý và ảnh chụp từng công đoạn thử nghiệm.
   * **Tạo file Word (.docx) & Tự động đẩy NAS**:
     * Nhấn nút **Tạo báo cáo (.docx)** để sinh file báo cáo Word chính thức đúng định dạng chuẩn ISO của phòng Lab.
     * Hệ thống hỗ trợ tính năng **Tự động lưu trữ NAS**: Tự động tải file báo cáo và tập hợp hình ảnh thử nghiệm lên máy chủ lưu trữ NAS nội bộ để lưu trữ và chia sẻ lâu dài.

---

### Quản lý Kho mẫu Vật lý

Phân hệ Kho mẫu được thiết kế tích hợp ở thanh Sidebar bên trái giao diện, hỗ trợ quản lý vòng đời vật lý của mẫu thử.

| Trạng thái vật lý | Ý nghĩa nghiệp vụ | Hành động cần thiết |
| :--- | :--- | :--- |
| **Chờ nhận mẫu** | Khách hàng đăng ký nhưng mẫu chưa chuyển tới phòng Lab. | Chuẩn bị biên bản bàn giao, liên hệ khách hàng hẹn lịch gửi mẫu. |
| **Mẫu trong kho** | Mẫu đã bàn giao thực tế, đã niêm phong và dán nhãn mã hóa. | Tiến hành gắn thiết bị lên giàn thử, bật hệ thống giám sát và bắt đầu thử nghiệm. |
| **Đã trả khách** | Đã kết thúc thử nghiệm và lập biên bản hoàn trả mẫu vật lý. | Bàn giao lại mẫu thử kèm biên bản có chữ ký xác nhận của hai bên. |

> ⚠️ **CẢNH BÁO TRỄ HẠN (Overdue Warning)**:
> Hệ thống sẽ tự động hiển thị biểu tượng nhấp nháy màu đỏ **"TRỄ HẠN"** bên cạnh các mẫu thử đã quá hạn lưu trữ hoặc thời gian thử nghiệm dự kiến mà chưa hoàn thành kết quả thử nghiệm.

---

### Nhập kết quả & Phê duyệt kết quả thử nghiệm

Quy trình số hóa biên bản thử nghiệm giúp loại bỏ hoàn toàn việc ghi chép tay truyền thống.

1. **Nhập kết quả (Dành cho Tester)**:
   * Tìm kiếm PYC đang thử nghiệm, nhấn nút **Nhập KQTN** (Biểu tượng bảng tính).
   * Lựa chọn phương án cập nhật kết quả:
     * *Phương án A*: Upload file PDF báo cáo kết quả để trợ lý AI tự động trích xuất thông tin.
     * *Phương án B*: Nhập thông số kết quả thử nghiệm tổng hợp (Dung lượng, công suất, cấp năng lượng, mã số máy...) và ghi chú kỹ thuật.
   * Nhấn **Gửi duyệt kết quả**. Trạng thái PYC chuyển sang `Chờ duyệt KQTN`.

2. **Phê duyệt kết quả (Dành cho Admin)**:
   * Admin nhận được thông báo kiểm tra. Mở chi tiết phiếu để xem thông số Tester đã nhập hoặc file báo cáo trích xuất.
   * Nếu dữ liệu hợp lệ: Nhấn **Phê duyệt kết quả**. Trạng thái chuyển sang `Đã duyệt KQ` và tiến hành in ấn báo cáo thử nghiệm chính thức.
   * Nếu phát hiện sai sót: Nhấn **Cần bổ sung**, ghi kèm ý kiến chỉ đạo phản hồi trực tiếp cho Tester sửa đổi.

---

### In ấn Phiếu yêu cầu & Quản lý Biên bản giao nhận mẫu (BMGN)

Hệ thống cho phép kết xuất dữ liệu trực tiếp vào mẫu văn bản hành chính theo chuẩn quy định ISO của phòng thí nghiệm, đồng thời quản lý toàn bộ vòng đời Biên bản Giao nhận Mẫu (BMGN).

*   **Cấu trúc & Quy tắc đánh Số Biên Bản Giao Nhận (`docNumber`)**:
    *   **Định dạng chuẩn hóa theo loại biên bản**:
        *   **Biên bản Nhận mẫu (`RECEIVE`)**: Định dạng `NM DDT YYMMDD-TT` (Ví dụ: `NM DDT 260802-01` đại diện cho Biên bản Nhận mẫu số 01 lập ngày 02/08/2026).
        *   **Biên bản Giao/Trả mẫu (`RETURN`)**: Định dạng `GM DDT YYMMDD-TT` (Ví dụ: `GM DDT 260802-01` đại diện cho Biên bản Giao trả mẫu số 01 lập ngày 02/08/2026).
    *   **Phân loại 2 Dạng Biên bản Giao nhận (`HandoverType`)**:
        1. **`RECEIVE` (Giao/Nhận mẫu mới)**: Lập khi tiếp nhận mẫu thử nghiệm mới từ khách hàng bàn giao cho phòng lab (Mã `NM DDT`).
        2. **`RETURN` (Trả mẫu thử nghiệm)**: Lập khi hoàn thành thử nghiệm và hoàn trả mẫu vật lý cho khách hàng (Mã `GM DDT`).
    *   **Quản lý thông tin pháp lý & vận chuyển**:
        *   *Thông tin Bên giao*: Tên đơn vị/khách hàng, Đại diện người giao, Số điện thoại liên hệ.
        *   *Thông tin Bên nhận*: Đại diện phòng thí nghiệm / Đơn vị nhận, Số điện thoại.
        *   *Thông tin phương tiện*: Phương tiện vận chuyển, Biển số xe.
        *   *Danh mục mẫu chi tiết*: Bảng kê đầy đủ Tên sản phẩm, Model, Thương hiệu, Chủng loại, Số lượng, Đơn vị tính, Mã hóa mẫu (ITD/EMC/ITDC), Tình trạng niêm phong và Ghi chú kỹ thuật.

*   **Modal Quản lý Biên bản Giao nhận (`HandoverDocsModal.tsx`)**:
    *   Truy cập danh sách toàn bộ biên bản đã khởi tạo.
    *   **Tra cứu đa năng**: Tìm kiếm nhanh theo Số BMGN, Tên khách hàng, Tên model thiết bị hoặc các thông tin ghi chú liên quan.
    *   **Xem lại & In ấn**: Mở xem lại chi tiết nội dung biên bản và tiến hành in lại bất kỳ lúc nào.

*   **Quy trình In ấn & Tạo văn bản Word (.docx) tự động (`GiaoNhanMau.docx` & `DDT_PYC.docx`)**:
    1. Tại màn hình danh sách PYC hoặc Modal Giao nhận mẫu, nhấn nút **In BMGN/PYC** (Biểu tượng chiếc máy in 🖨️).
    2. Hệ thống sử dụng công cụ nạp dữ liệu động `Docxtemplater` & `PizZip` tự động bóc tách thông tin khách hàng, bảng kê danh sách mẫu, tem niêm phong và mã hóa để điền tự động (mail-merge) vào template:
       *   *Phiếu yêu cầu thử nghiệm*: Dựa trên template `DDT_PYC.docx`.
       *   *Biên bản giao nhận mẫu thử*: Dựa trên template `GiaoNhanMau.docx`.
    3. Nhấn **Tạo văn bản và Tải xuống** để xuất file Word `.docx` hoàn chỉnh phục vụ in ấn, ký duyệt và lưu trữ hồ sơ.

---

### Tương tác Trợ lý ảo AI ChatBot

Tích hợp mô hình ngôn ngữ lớn **Gemini AI**, mang đến trải nghiệm vận hành thông minh và hiện đại.

<img src="https://picsum.photos/seed/laboratory_ai/800/450" alt="Giao diện Trợ lý ảo AI" referrerPolicy="no-referrer" style="width:100%; border-radius:12px; margin: 16px 0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />

*   **Vị trí**: Nằm ở góc dưới cùng bên phải màn hình (biểu tượng bong bóng chat có tia sét lấp lánh).
*   **Các tính năng nổi bật**:
    *   *Tra cứu nhanh dữ liệu*: Bạn có thể hỏi: *"Phiếu yêu cầu PYC-260802-01 đang ở trạng thái nào?"* hoặc *"Trong kho hiện tại có bao nhiêu mẫu của khách hàng Daikin?"*.
    *   *Hỗ trợ kỹ thuật*: Giải đáp các câu hỏi liên quan đến tiêu chuẩn đo lường, quy chuẩn Việt Nam đối với hiệu suất năng lượng của tủ lạnh, điều hòa.
    *   *Đề xuất lập lịch*: Nhập thông tin thiết bị thô và yêu cầu AI tư vấn xem nên xếp vào Chamber nào và do ai thực hiện là tối ưu nhất.

---

### Đồng bộ hóa & Lưu trữ đám mây

Hệ thống cung cấp khả năng lưu trữ và đồng bộ hóa tự động trên nền tảng đám mây thời gian thực:

*   **Lưu trữ & Đồng bộ dữ liệu thời gian thực (Real-time Cloud Sync)**:
    *   Mọi thay đổi về thông tin phiếu yêu cầu, danh mục khách hàng, thương hiệu, hoặc thông tin kho mẫu đều được tự động lưu trữ và đồng bộ hóa tức thì trên cơ sở dữ liệu đám mây.
    *   Tính năng này đảm bảo dữ liệu luôn được cập nhật nhất quán giữa tất cả các tài khoản truy cập, ngăn ngừa mất mát thông tin và hỗ trợ xuất báo cáo dễ dàng.

---

## 5. CÀI ĐẶT & CẤU HÌNH HỆ THỐNG (DÀNH CHO ADMIN)

Để hệ thống hoạt động chính xác nhất, Admin cần thường xuyên kiểm tra và thiết lập các thông số tại tab **Cài Đặt Hệ Thống**:

<img src="https://picsum.photos/seed/laboratory_settings/800/450" alt="Giao diện cài đặt cấu hình hệ thống" referrerPolicy="no-referrer" style="width:100%; border-radius:12px; margin: 16px 0; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);" />

1.  **Cấu hình thời gian làm việc**:
    *   Bật/Tắt chế độ *Làm việc vào thứ Bảy*, *Làm việc vào Chủ Nhật*. Thuật toán xếp lịch tự động sẽ căn cứ vào cấu hình này để phân bổ ngày thực hiện thử nghiệm thiết bị.
2.  **Khai báo Ngày lễ và Ngày cao điểm**:
    *   Thêm danh sách các ngày nghỉ lễ chính thức để thuật toán tự động cộng dồn số ngày thử nghiệm vượt qua các ngày nghỉ này.
    *   Đánh dấu các khoảng thời gian cao điểm để hệ thống chủ động tối ưu công suất buồng EMC lên ngưỡng cao nhất nhằm giải quyết ùn ứ mẫu thử.
3.  **Quản lý kết nối đám mây (Cloud API)**:
    *   Khai báo API key Gemini riêng biệt của phòng ban để điều phối hoạt động của Trợ lý ảo AI.
    *   Cấu hình tham số kết nối đám mây để duy trì liên lạc và đồng bộ dữ liệu thông suốt.

---

## 6. CÂU HỎI THƯỜNG GẶP (FAQ)

### Q1: Tại sao lịch thử nghiệm của tôi bị tự động kéo dài thêm 2 ngày so với cấu hình mặc định?
> **Trả lời**: Hãy kiểm tra lại lịch dương trong khoảng thời gian thử nghiệm đó. Rất có thể khoảng thời gian này rơi vào hai ngày nghỉ cuối tuần (Thứ Bảy, Chủ Nhật) mà hệ thống đang tắt chế độ làm việc cuối tuần, hoặc trùng vào ngày lễ Tết đã khai báo trong danh mục cấu hình. Hệ thống đã tự động bảo lưu và cộng dồn số ngày thử thực tế để bảo vệ quyền lợi của Tester.

### Q2: Khách hàng (Guest) có thể tự đăng ký tài khoản để vào xem tiến độ không?
> **Trả lời**: Không. Để đảm bảo tính an toàn bảo mật thông tin nội bộ của phòng Lab, tài khoản của Khách hàng phải do Quản trị viên (Admin) phê duyệt cấp trước và khai báo định danh trong danh sách tài khoản được phê duyệt (`PRESET_ACCOUNTS`).

### Q3: Làm sao để biết dữ liệu đã được đồng bộ lên hệ thống đám mây thành công chưa?
> **Trả lời**: Bạn hãy quan sát ký hiệu biểu tượng đồng bộ ở góc trên cùng giao diện. Nếu biểu tượng vòng tròn xoay màu xanh lá xuất hiện và thông báo thành công tức là dữ liệu đã được lưu trữ an toàn trên đám mây. Trong trường hợp mất mạng, hệ thống sẽ lưu tạm ở LocalStorage và tự động đồng bộ bù ngay khi có kết nối Internet trở lại.

---

*Mọi thắc mắc kỹ thuật hoặc yêu cầu nâng cấp tính năng phần mềm, xin vui lòng gửi email liên hệ trực tiếp tới Quản trị viên hệ thống qua địa chỉ email:* `luongxuanhung2402@gmail.com` *để được hỗ trợ kịp thời.*

<!-- --- End of HUONG_DAN_SU_DUNG.md --- -->
