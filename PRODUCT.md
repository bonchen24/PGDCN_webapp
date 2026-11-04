# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Chuyên viên & Chuyên gia Giám định (PGD): Tiếp nhận hồ sơ, lập kế hoạch kiểm tra hiện trường, tạo yêu cầu thử nghiệm phòng lab, đánh giá và cấp chứng thư giám định.
- Chuyên viên & Chuyên gia Chứng nhận (PCN): Tiếp nhận hồ sơ chứng nhận, theo dõi luồng mẫu thử, thẩm xét kết quả, phát hành và quản lý hồ sơ chứng nhận sản phẩm.
- Văn thư hồ sơ & Lãnh đạo Phòng (Trưởng/Phó phòng), Lãnh đạo Trung tâm (TVCI): Phê duyệt phân công, ký duyệt chứng thư/chứng nhận, giám sát tiến độ và báo cáo vận hành.

## Product Purpose
Hệ thống Quản lý Vận hành tập trung cho Phòng Giám định - Chứng nhận và Phát triển thị trường (PGDCN) trực thuộc Trung tâm Thử nghiệm - Kiểm định Công nghiệp (TVCI / IEMM). Hệ thống số hóa toàn diện quy trình tiếp nhận, theo dõi luồng mẫu vật lý, điều phối thử nghiệm nội bộ/ngoại bộ, soạn thảo và ban hành chứng thư giám định & giấy chứng nhận theo tiêu chuẩn kiểm định công nghiệp với độ chính xác và bảo mật cao.

## Positioning
Nền tảng điều hành hồ sơ kiểm định kỹ thuật khép kín chuẩn công nghiệp (Industrial Precision Cockpit) tích hợp trợ lý AI chuyên biệt cho bóc tách kết quả thử nghiệm (OCR/Extract), soạn thảo văn bản quy chuẩn (DOCX engine), và quản lý trạng thái hồ sơ nhiều phòng ban theo thời gian thực mà các giải pháp ERP thông thường không đáp ứng được.

## Operating Context
- Môi trường thử nghiệm và kiểm định công nghiệp nghiêm ngặt (ISO/IEC 17025, ISO/IEC 17020, ISO/IEC 17065).
- Tương tác với tài liệu quét (scan PDF/ảnh), hồ sơ vật lý, mẫu thử trong phòng lab, biên bản bàn giao và mẫu biểu chứng thư theo quy chuẩn nhà nước.
- Thiết bị vận hành: Màn hình desktop văn phòng độ phân giải cao và laptop kỹ sư kiểm định hiện trường.

## Capabilities and Constraints
- Kiến trúc Next.js App Router (React, Tailwind CSS, TypeScript).
- Mô hình dữ liệu hai phân hệ nghiệp vụ độc lập: PCN (Chứng nhận) và PGD (Giám định), cùng chức năng soạn thảo và kho mẫu.
- Cơ chế phân quyền nhiều tầng (RBAC): Lãnh đạo Trung tâm, Trưởng/Phó phòng, Chuyên viên PCN/PGD, Văn thư.
- Giao tiếp REST API, cơ sở dữ liệu SQLite / Prisma / Lowdb đa tầng.
- AI OCR & Trích xuất siêu dữ liệu phiếu thử nghiệm tự động.

## Brand Commitments
- Nhận diện thương hiệu: Trung tâm Thử nghiệm - Kiểm định Công nghiệp (TVCI / IEMM).
- Phong cách: Industrial Laboratory Precision — độ tương phản cao, nền sáng (`bg-slate-50`), nhấn thương hiệu xanh lá (`emerald-700`) và xanh kỹ thuật (`blue-700`), viền chuẩn `slate-200`. Loại bỏ giao diện tối đen/hộp lồng hộp gây ngột ngạt thị giác.

## Evidence on Hand
- Quy chuẩn thiết kế và tài liệu kiến trúc: `design.md`, `AGENTS.md`.
- Giao diện và thành phần đang hoạt động tại thư mục `app/`, `components/`.

## Product Principles
1. Độ chính xác và minh bạch công nghiệp (Industrial Precision): Dữ liệu kỹ thuật, mã số mẫu và kết quả đo đạc luôn được phân cấp rõ ràng, dễ đọc, không che khuất bởi hiệu ứng trang trí.
2. Tối ưu mật độ dữ liệu (High-Density Ergonomics): Thiết kế bảng, hàng hồ sơ và thanh điều hướng 1 dòng đồng bộ, giúp chuyên viên xử lý khối lượng lớn hồ sơ không mỏi mắt.
3. Không lạm dụng bóng đổ và viền lồng viền (Anti-Slop): Triệt tiêu card trong card, border rối mắt, thay thế bằng khoảng cách và nền phân cấp tinh tế.
4. Kiểm soát lỗi tức thì: Phản hồi trạng thái, quá hạn, cảnh báo khẩn cấp rõ ràng với màu sắc quy chuẩn, hạn chế tối đa sai sót trong phát hành tài liệu pháp lý.
