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

## 2026-09-30T04:19:42Z

Rà soát và đối chiếu toàn diện tính nhất quán giữa tài liệu thiết kế chuẩn (`design.md`) và mã nguồn thực tế đang triển khai của hệ thống PGDCN Web App (gồm hai phân hệ cốt lõi PCN — Chứng nhận và PGD — Giám định).

Working directory: e:\CODING\PGDCN_webapp
Integrity mode: development

## Requirements

### R1. Đối chiếu quy chuẩn UI/UX & Card Components giữa design.md và code thực tế
- Rà soát mục 3 (Card Components), đặc biệt là mục 3.1.1 (Card Hồ Sơ & Đề Nghị TVCI Lab), đối chiếu với implementation thực tế trong `components/PcnDossierGroupCard.tsx`, `components/PcnWorkspace.tsx`, và `components/PgdWorkspace.tsx` (`RequestCard`).
- Kiểm tra tính đồng bộ của Toolbar lọc dạng pill, trạng thái màu sắc, badge token, icon action và tiến độ (`X/Y XONG`).
- Đánh giá mức độ nhất quán của layout lưới 2 cột và chế độ xem Thẻ/Bảng giữa đặc tả và mã nguồn.

### R2. Đối chiếu Data Model, Lifecycle và Hợp đồng API
- Đối chiếu mục 0 (PGDCN Active Profile), mục 0A (PGD Active Profile), mục 6 (Data Models & Schema) và mục 7 (Cơ chế bảo mật, phân quyền, lưu trữ) với các file mã nguồn:
  - `types.ts`, `utils/pgdDomain.ts`, `utils/pgdDossier.ts`
  - `utils/pcnWorkflowTopology.ts`, `utils/pcnDossierPolicy.ts`
  - `server.ts`, các route API PCN & PGD.
- Xác minh xem các quy tắc nghiệp vụ (QC4, QC9 cho PCN; QC20, STEEL_METAL, MACHINERY_LINE, COAL cho PGD; ranh giới tách biệt giữa PCN và PGD) có được thực thi nghiêm ngặt theo đúng đặc tả hay không.

### R3. Phát hiện độ lệch (Drift / Discrepancy) và Đề xuất cập nhật
- Lập bảng tổng hợp các điểm sai lệch giữa `design.md` và mã nguồn (nếu code chưa theo spec, hoặc spec chưa cập nhật theo tính năng thực tế đã hoàn thiện).
- Đề xuất bản vá chỉnh sửa cụ thể cho `design.md` để đảm bảo `design.md` luôn là Single Source of Truth tuyệt đối.

## Acceptance Criteria

### Audit & Verification
- [ ] Báo cáo chỉ rõ từng dòng / mục trong `design.md` tương ứng với file và component trong mã nguồn.
- [ ] Không có quy tắc nào trong `AGENTS.md` và `design.md` bị vi phạm trong quá trình rà soát.
- [ ] Đưa ra danh sách hành động sửa đổi rõ ràng, tách bạch giữa cập nhật tài liệu và cập nhật mã nguồn (nếu có).
