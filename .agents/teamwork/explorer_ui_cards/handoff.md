# Handoff Report: R1 - Rà soát & Đối chiếu UI/UX & Card Components

## 1. Observation (Quan sát thực tế)
- **Tài liệu chuẩn `design.md`**:
  * Mục 2.1–2.4 (Dòng 545–585): Bảng màu cơ sở, bảng 10 tokens trạng thái phiếu `RequestStatus` cũ của PTN/DDT (`PENDING` đến `REQ_SUPPLEMENT`), tokens kho mẫu và KTV.
  * Mục 3.1.1 (Dòng 628–685): Chuẩn trực quan TVCI Lab cho Card Hồ sơ & Đề nghị: lưới 2 cột `grid grid-cols-1 md:grid-cols-2 gap-3.5`, hộp icon thư mục vàng cam `bg-amber-50 text-amber-500 w-11 h-11`, header font-mono kèm badges, tag nhãn hiệu xanh dương, thanh tiến độ `bg-emerald-500` kèm nhãn `X/Y XONG`, toolbar tìm kiếm rounded-xl, status filter pills, view mode switcher (card vs table).
  * Mục 3.1–3.5 (Dòng 588–767): Request Card, Sample Card, Schedule Card kiểu phòng thử DDT (legacy reference).
  * Mục 3.6 & 3.6.1 (Dòng 768–802): Sổ Mẫu Thử & Luồng PYC, KPI đếm theo mẫu, bảng quản lý dạng cell.
  * Mục 5.2.1.2 & 5.2.1.3 (Dòng 1116–1144): Dashboard Operations Cockpit PGDCN và Toolbar quy chuẩn desktop/mobile.
- **Mã nguồn thực tế**:
  * `components/PcnDossierGroupCard.tsx`: Khung card (dòng 102), hộp icon thư mục vàng cam (dòng 108), badges (dòng 118–151), icon actions (dòng 154–199), tag thương hiệu (dòng 204), tên KH (dòng 213), thanh tiến trình & `progressRatioLabel = `${completionRatio}/${totalSamples} XONG`` (dòng 74–86 & 293–307), accordion chi tiết mẫu (dòng 224–290).
  * `components/PcnWorkspace.tsx`: Nút toggle `LayoutGrid` / `List` (dòng 639–667), Search input rounded-xl (dòng 683–697), Status pills đếm số (dòng 701–802), Lọc nâng cao `SlidersHorizontal` (dòng 804–851), Sắp xếp (dòng 854–860), Grid render `grid grid-cols-1 md:grid-cols-2 gap-3.5` (dòng 977).
  * `components/PgdWorkspace.tsx`: `RequestCard` (dòng 700–908) áp dụng visual hierarchy tương đồng với TVCI Lab, thanh tiến độ `X/Y XONG`, Status pills đếm số (dòng 1506–1612), grid 2 cột (dòng 968) và bảng cuộn ngang `mobile-scroll-x min-w-[1400px]` (dòng 974). `StatusBadge` (dòng 284–291) gom 3 màu thô.
  * `components/PcnDossierQueueView.tsx` & `components/PgdDossierQueueView.tsx`: Đã hỗ trợ viewMode toggle, card grid 2 cột.
  * `components/PgdcnUiPrimitives.tsx` (dòng 10–67) & `utils/pgdcnDashboard.ts`: Đã có `PgdcnStatusBadge` với 10 `StateTone` chuẩn nhưng chưa được dùng đồng bộ tại `PgdWorkspace.tsx` và `PcnDossierGroupCard.tsx`.

## 2. Logic Chain (Chuỗi suy luận logic)
1. Từ quan sát Mục 3.1.1 `design.md` đối chiếu với `PcnDossierGroupCard.tsx` và `PcnWorkspace.tsx`: Cấu trúc Card, kích thước hộp icon, bảng màu, bo góc, phân cấp thị giác, thanh tiến độ `X/Y XONG` và lưới 2 cột khớp với nhau gần như 100%.
2. Từ quan sát `PgdWorkspace.tsx` (`RequestCard` và `PgdRegisterTable`): Miền Giám định (PGD) cũng đã được đồng bộ hóa thành công theo chuẩn trực quan TVCI Lab của Mục 3.1.1 (thẻ 2 cột, folder vàng cam, nhãn X/Y XONG, toolbar dạng pill).
3. Từ quan sát Mục 2.2 `design.md` đối chiếu với hệ thống status của PCN (19 trạng thái) và PGD (14 trạng thái): Tài liệu `design.md` bị trôi lệch (drift) khi chỉ mô tả 10 trạng thái `RequestStatus` của app PTN cũ. Hệ quả là mã nguồn phải tự định nghĩa các bảng class màu phân tán (`statusClasses` trong `PcnWorkspace.tsx`, `StatusBadge` trong `PgdWorkspace.tsx`), dẫn đến việc `StatusBadge` của PGD bị thu hẹp thành 3 nhóm màu gộp.
4. Từ quan sát Mục 3.1–3.5 trong `design.md`: Các mô tả về buồng thử ATD/EMC, buồng Chamber 1/2, KTV là phần kế thừa từ PTN DDT (legacy reference). Phân hệ PGDCN active profile không dùng các card này mà dùng `PcnDossierGroupCard`, `RequestCard` và `PcnSampleFlowView`.
5. Từ các phân tích trên, kết luận: Giao diện Card Components và Toolbar của hệ thống đã đạt độ tuân thủ thiết kế rất cao (>90%), vấn đề cốt lõi cần giải quyết là chuẩn hóa đồng bộ bảng Badge Tokens tại Mục 2.2 của `design.md` và tái cấu trúc nhẹ một số icon/touch-target trên mobile.

## 3. Caveats (Khu vực chưa khảo sát & Giả định)
- Chưa can thiệp hoặc chỉnh sửa mã nguồn trực tiếp (tuân thủ nghiêm ngặt vai trò Read-only Explorer theo `AGENTS.md`).
- Báo cáo này tập trung chuyên sâu vào R1 (Card Components, Badges, Layout & Toolbar), không đánh giá sâu về cấu trúc cơ sở dữ liệu server/schema và RBAC (thuộc phạm vi của R2.1 và R2.2).
- Giả định rằng khi người dùng phê duyệt cập nhật `design.md`, việc thay thế `StatusBadge` sang `PgdcnStatusBadge` trong `PgdWorkspace.tsx` sẽ không gây xung đột logic với các component cha.

## 4. Conclusion (Kết luận & Kiến nghị)
- **Đánh giá chung**: Hệ thống Card Components (`PcnDossierGroupCard`, `RequestCard`), Toolbar lọc dạng Pill, cơ chế tính toán `X/Y XONG`, và layout lưới 2 cột đã tuân thủ đặc tả Mục 3.1.1 và Mục 5 rất tốt, đem lại trải nghiệm đồng nhất cao giữa PCN và PGD theo chuẩn TVCI Lab.
- **Điểm lệch chính cần xử lý**:
  1. *Cập nhật đặc tả `design.md`*: Bổ sung bảng ánh xạ Badge Tokens cho 19 trạng thái `PcnDossierStatus` và 14 trạng thái `PgdInspectionStatus` vào Mục 2.2; phân định rõ Mục 3.1–3.5 là Legacy Reference.
  2. *Tinh chỉnh mã nguồn (khi được duyệt)*: Nâng cấp `StatusBadge` trong `PgdWorkspace.tsx` dùng `PgdcnStatusBadge`; bổ sung thông tin tài liệu còn thiếu vào accordion của `PcnDossierGroupCard.tsx`; đảm bảo touch target 44px trên mobile cho các icon action.
- Chi tiết đầy đủ: Xem file báo cáo toàn diện tại `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_ui_cards\report_ui_cards.md`.

## 5. Verification Method (Phương pháp kiểm chứng độc lập)
- **Kiểm tra giao diện & mã nguồn**:
  1. Xem file `components/PcnDossierGroupCard.tsx` (dòng 101–310) để kiểm chứng cấu trúc thẻ, icon Folder, thanh tiến độ `progressRatioLabel`.
  2. Xem file `components/PcnWorkspace.tsx` (dòng 630–700, 977) để kiểm chứng nút chuyển đổi Dạng thẻ / Dạng bảng và lưới `grid-cols-1 md:grid-cols-2 gap-3.5`.
  3. Xem file `components/PgdWorkspace.tsx` (dòng 700–908, 968) để kiểm chứng `RequestCard`.
  4. Xem file `design.md` dòng 553–566 để kiểm chứng độ lệch của bảng `RequestStatus Tokens`.
- **Kiểm tra build & typecheck dự án**:
  * Lệnh kiểm tra build: `npm run build`
  * Dự kiến: Toàn bộ typecheck và build production đều vượt qua an toàn.
