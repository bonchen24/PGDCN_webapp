# Original User Request

## 2026-09-28T14:39:29Z

Rà soát toàn diện UI/UX của toàn bộ ứng dụng TVCI Web App (Dashboard, PCN, PGD, Sổ KQTN, Admin & Cài đặt), đối chiếu nghiêm ngặt với đặc tả trong design.md. Lập báo cáo danh sách chi tiết các điểm lệch chuẩn, lỗi layout/tokens/responsive và đề xuất phương án hoàn thiện trước khi thực thi mã nguồn.

Working directory: e:/CODING/PGDCN_webapp
Integrity mode: development

## Requirements

### R1. Rà soát chuẩn hóa Design Tokens & Typography
- Đối chiếu toàn bộ hệ thống màu sắc, badge tokens, typography, spacing scales theo mục 2 của design.md.
- Phát hiện các style inline, hardcoded color, lệch chuẩn font, cỡ chữ hoặc badge state giữa PCN, PGD và Dashboard.

### R2. Rà soát cấu trúc Card Components & Modals
- Kiểm tra các Card (Request Card, Sample Card, Schedule Card, Log Card) theo mục 3 design.md.
- Kiểm tra các Modal (RequestModal, TestExecutionModal, HandoverModal, ReportGeneratorView, KQTN Grid) theo mục 4 design.md.
- Đảm bảo tính nhất quán về visual hierarchy, trạng thái tương tác (hover, active, focus, disabled, loading).

### R3. Rà soát Responsive & Layout tổng thể
- Kiểm tra layout Dashboard PGDCN, thanh điều hướng sidebar/header, tỷ lệ hiển thị toàn cục theo mục 5 design.md.
- Đánh giá khả năng hiển thị responsive trên Desktop và Mobile/Tablet, nhận diện tình trạng tràn màn hình (overflow), gãy dòng hay che khuất thao tác.

### R4. Báo cáo đánh giá & Kế hoạch sửa đổi chi tiết
- Lập bảng tổng hợp các vấn đề phát hiện: Vị trí file / Component, Hiện trạng, Chuẩn quy định trong design.md, Mức độ ưu tiên (High / Medium / Low), Đề xuất sửa đổi.
- Chưa trực tiếp sửa code; chờ người dùng duyệt kế hoạch trước khi chuyển sang bước thực thi.

## Acceptance Criteria

### Báo cáo kiểm tra UI/UX
- [ ] Báo cáo rà soát đầy đủ cả 5 khu vực: Dashboard, PCN, PGD, Sổ KQTN, Admin/Settings.
- [ ] Mọi điểm phát hiện đều dẫn chiếu rõ ràng đến section tương ứng trong design.md.
- [ ] Có danh sách cụ thể từng component/file vi phạm chuẩn tokens hoặc layout.
- [ ] Đề xuất phương án khắc phục chi tiết, không làm vỡ logic nghiệp vụ hiện có.
