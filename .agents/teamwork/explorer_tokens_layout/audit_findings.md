# BÁO CÁO RÀ SOÁT KỸ THUẬT: DESIGN TOKENS, TYPOGRAPHY & RESPONSIVE LAYOUT (R1 & R3)

**Dự án**: TVCI Web App (PGDCN / PCN / PGD)  
**Người thực hiện**: Explorer 1 (`teamwork_preview_explorer`)  
**Ngày thực hiện**: 2026-09-28  
**Tài liệu đối chiếu**: `design.md` (Mục 2: Dòng 545–586; Mục 5: Dòng 1017–1134; Phụ lục 5A: Dòng 1512–1570)  
**Trạng thái mã nguồn kiểm tra**: `npm run typecheck` (0 errors), `npm run test:pcn` (934 passed).

---

## I. TỔNG QUAN KẾT QUẢ

| Mức độ nghiêm trọng | Số lượng | Mô tả tóm tắt |
| :--- | :---: | :--- |
| **High (Cao)** | 6 | Biến CSS `:root` bị thiếu, vỡ layout mobile portrait/landscape lock, padding 72px rác trên desktop, toolbar không wrap trên mobile, badge token phân mảnh, thẻ HTML bị cấm (`<datalist>`). |
| **Medium (Trung bình)** | 8 | Typography `calc()` lệch kích thước, arbitrary font pixel classes tràn lan, selector compact không đồng bộ, hardcoded hex, sai thứ tự section Dashboard, thiếu mobile sidebar backdrop, vi phạm modal semantic contract, thiếu Screen Orientation Lock API. |
| **Low (Thấp)** | 5 | Dùng `gray-*` thay vì Slate, thiếu class `mobile-scroll-x`, header cao 56px thay vì 52px, sai icon sidebar, touch target nhỏ hơn 44px. |
| **Tổng cộng** | **19** | |

---

## II. BẢNG DANH MỤC 19 ĐIỂM SAI LỆCH & ĐỀ XUẤT KHẮC PHỤC

| STT | Mức độ | Khu vực / File | Vị trí dòng | Đối chiếu `design.md` | Hiện trạng vi phạm | Hậu quả kỹ thuật | Đề xuất giải pháp khắc phục |
| :---: | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **High** | `src/index.css` | 19–50 | Mục 2.1 & 2.2 (Dòng 545–586) | Các selector `.bg-status-waiting`, `.bg-status-inlab`, `.bg-tester-1` đến `.bg-tester-8` tham chiếu CSS var `var(--status-waiting-bg)`, `var(--tester-1-bg)`,... nhưng `:root` không hề khai báo các biến này. | Các class màu trạng thái rớt về transparent / unstyled, gây mất màu sắc nhận diện mẫu và KTV. | Bổ sung khai báo đầy đủ bảng biến `--status-*-bg`, `--status-*-text`, `--tester-*-bg`, `--tester-*-text` vào khối `:root` trong `src/index.css`. |
| 2 | **High** | `src/app/layout.tsx` | Toàn file | Mục 5.2.1.4 (Dòng 1061–1074) | File `layout.tsx` thiếu hẳn `<div id="root">` và `<div id="portrait-only-message">`. CSS rule `@media (orientation: landscape) and (max-height: 500px)` và `#root { zoom: 1 }` không tìm thấy target DOM. | Khóa xoay màn hình ngang trên thiết bị di động bị vô hiệu hóa; CSS zoom compact mất neo DOM. | Thêm container `<div id="root">` bọc `{children}` và thêm thông điệp cảnh báo `<div id="portrait-only-message">` chuẩn vào `src/app/layout.tsx`. |
| 3 | **High** | `src/components/pgdcn/PgdcnAppShell.tsx`, `src/index.css` | `PgdcnAppShell.tsx:384`, `index.css:376` | Mục 5.1 & 5.2 (Dòng 1020–1060) | Header mobile button gắn nhầm `mobile-safe-bottom` và `pgdcn-mobile-nav`. File `index.css:376` đặt `.mobile-safe-bottom { padding-bottom: 72px; }` ở scope toàn cục không bọc media query. | Header cao 52px bị đội padding 72px; chân trang Dashboard và Modal trên màn hình Desktop bị đẩy thừa 72px vô lý. | Bỏ class `mobile-safe-bottom` khỏi Header button. Đóng gói `.mobile-safe-bottom` trong `@media (max-width: 767px)` và chỉ áp dụng cho container nội dung chính. |
| 4 | **High** | `src/index.css` | 169–174 | Mục 5.2.1.3 (Dòng 1050–1058) | `.pgdcn-toolbar-nowrap` bị ép `flex-wrap: nowrap; overflow-x: auto;` trên toàn bộ breakpoint. | Thanh công cụ thao tác trên mobile (320px–430px) bị tràn ngang thay vì co giãn thành 1 cột (full-width stacked buttons) theo quy chuẩn Mục 5.2.1.3. | Chuyển thành `@media (min-width: 768px) { .pgdcn-toolbar-nowrap { flex-wrap: nowrap; overflow-x: auto; } }`, mobile để flex-col/wrap tự nhiên. |
| 5 | **High** | `src/components/pgdcn/PgdcnUiPrimitives.tsx`, `src/components/pcn/*` | `PgdcnUiPrimitives.tsx:64–76`, `PcnDossierGroupCard.tsx:44–68` | Mục 2.2 (Dòng 567–586) | Badge tokens phân mảnh: `PgdcnBadge` chỉ có 5 tone cơ bản dùng `bg-*-50`; các modal/card PCN tự viết object map class `bg-emerald-100`, `bg-amber-100` riêng lẻ; thiếu các token chuẩn: cyan (`SAMPLES_RECEIVED`), indigo (`SCHEDULED`), purple animate-pulse (`TESTING`), orange (`RESULTS_SUBMITTED`), teal (`COMPLETED`). | Trải nghiệm trực quan không đồng nhất giữa PCN và PGD; trạng thái Đang thử nghiệm thiếu hiệu ứng pulse nhận diện. | Đồng bộ hóa toàn bộ Badge Token vào `PgdcnUiPrimitives.tsx` và ánh xạ đầy đủ 9 trạng thái mẫu/hồ sơ theo đúng bảng màu quy chuẩn. |
| 6 | **High** | `src/components/pgd/PgdIntakeSampleTable.tsx` | 64, 83 | Mục 5.3 (Dòng 1098–1106) | Sử dụng thẻ HTML `<datalist id="...">` cho gợi ý quy cách mẫu và đơn vị tính. | Vi phạm lệnh cấm thẻ `<datalist>` tại Mục 5.3 (gây vỡ hiển thị và lỗi chọn giá trị trên trình duyệt WebView di động). | Thay thế `<datalist>` bằng native `<select className="pgdcn-select">` hoặc accessible combobox dropdown. |
| 7 | **Medium** | `src/index.css` | 118–146 | Mục 2.3 & Mục 5A.1 (Dòng 570, 1515–1530) | Quy tắc typography compact tính: `font-size: calc(0.75rem * 0.9)` = 10.8px, line-height 1.25; `font-size: calc(0.875rem * 0.9)` = 12.6px. | Không đúng kích thước quy chuẩn 11px (0.6875rem), line-height 1.2 (cho xs) và 13px (0.8125rem) (cho sm/base) trong Mục 2.3 & 5A.1. | Điều chỉnh lại giá trị `font-size` và `line-height` trong `.app-compact` khớp tuyệt đối với bảng quy chuẩn 11px/1.2, 13px/1.3, 14px/1.4. |
| 8 | **Medium** | Toàn bộ các component `src/components/**/*` | Hơn 1000 vị trí | Mục 2.3 & Mục 5A.1 | Lạm dụng arbitrary Tailwind class: `text-[10px]`, `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[15px]`, `text-[16px]`. | Các class pixel cố định không chịu tác động của bộ tỷ lệ compact 90%, gây vỡ nhịp dọc font và khó kiểm soát theme. | Chuẩn hóa toàn bộ về các utility class tiêu chuẩn (`text-xs`, `text-sm`, `text-base`, `text-caption`) đã được scale tự động theo compact mode. |
| 9 | **Medium** | `src/index.css` | 215–278 | Mục 5A.1 (Dòng 1515–1535) | Khối quy định khoảng cách gọn gàng chỉ gán cho `.app-compact`, bỏ quên `.pcn-compact`; ngược lại quy tắc custom scrollbar chỉ gán cho `.pcn-compact`. | Không gian làm việc PCN không được hưởng compact spacing; không gian PGDCN không được hưởng custom scrollbar 4px/6px. | Gộp chung bộ selector thành `.app-compact, .pcn-compact` cho toàn bộ các quy tắc spacing scale và scrollbar style. |
| 10 | **Medium** | `src/components/pcn/PcnUserKpiTable.tsx`, `src/utils/activityLogKpi.ts` | `PcnUserKpiTable.tsx:13–19`, `activityLogKpi.ts:26–30` | Mục 5A.2 (Dòng 1538–1545) | Hardcoded trực tiếp mã màu hex `#059669`, `#2563eb`, `#d97706`, `#7c3aed`, `#94a3b8` và dùng inline `style={{ backgroundColor: item.color }}`. | Vi phạm nguyên tắc cấm hardcode hex và inline style màu sắc trong UI component; không hỗ trợ CSS variables theme. | Thay thế bằng các class màu Semantic / Token (`bg-emerald-600`, `bg-blue-600`, `bg-amber-600`, `bg-purple-600`, `bg-slate-400`). |
| 11 | **Medium** | `src/components/pgdcn/PgdcnDashboardView.tsx` | 261–268 | Mục 5.2.1.2 (Dòng 1040–1049) | Chèn `RecentItemsSection` lên giữa Pipeline và Milestones; đẩy `MyWorkSection` xuống vị trí cuối cùng; bọc `DomainPipeline` trong `mobile-scroll-x`. | Trật tự dashboard vi phạm chuẩn Mục 5.2.1.2 (chuẩn: 1. Overview Metric, 2. My Work/Waiting, 3. Domain Pipeline, 4. Deadlines, 5. Activity Log). Pipeline bị cuộn ngang thay vì responsive stack. | Sắp xếp lại thứ tự render các section theo đúng Mục 5.2.1.2; chuyển Domain Pipeline sang layout CSS grid/stack tự nhiên. |
| 12 | **Medium** | `src/components/pgdcn/PgdcnSidebar.tsx`, `src/components/pcn/PcnSidebar.tsx` | Sidebar component | Mục 5.2.1.1 (Dòng 1030–1039) | Khi mở Sidebar trên mobile (`md:hidden`), Sidebar hiển thị dưới dạng overlay trượt ra nhưng thiếu lớp màn mờ nền backdrop (overlay layer với nền đen bán trong suốt `bg-black/50`). | Người dùng chạm nhầm vào các nút phía dưới sidebar khi đang mở menu; không có hiệu ứng nhấn ra ngoài để đóng sidebar chuẩn mobile. | Thêm thẻ backdrop `<div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />` khi mobile sidebar mở. |
| 13 | **Medium** | `src/components/pcn/PcnApprovalModal.tsx`, `src/components/pcn/PcnDocxSettingsModal.tsx`, `src/components/pgd/PgdDocxSettingsModal.tsx` | `PcnApprovalModal.tsx:121`, `PcnDocxSettingsModal.tsx:75`, `PgdDocxSettingsModal.tsx:75` | Mục 5.1 & Mục 5.2.1.5 (Dòng 1020–1028, 1080–1095) | `PcnApprovalModal` nhánh `!canAct` bị mất thẻ `<footer>`; `PcnDocxSettingsModal` và `PgdDocxSettingsModal` đặt `overflow-y-auto` ở cấp container ngoài cùng của dialog và không có `<footer>`. | Phá vỡ cấu trúc semantic bắt buộc của Modal (`Header - Body scrollable - Footer fixed`); sinh 2 thanh cuộn lồng nhau trên màn hình nhỏ. | Chuẩn hóa cấu trúc Modal: Header cố định, Body có `flex-1 overflow-y-auto`, Footer cố định chứa nút đóng/thao tác (kể cả chế độ readonly). |
| 14 | **Medium** | `src/components/pgdcn/PgdcnAppShell.tsx`, `src/app/layout.tsx` | App init | Mục 5.2.1.4 (Dòng 1061–1074) | Hoàn toàn chưa có logic gọi Web API `screen.orientation.lock('portrait')` khi ứng dụng chạy ở chế độ PWA Standalone (`display-mode: standalone`). | Bỏ lỡ cơ chế khóa xoay màn hình tự nhiên của thiết bị Android/Chromium PWA, phụ thuộc hoàn toàn vào fallback CSS overlay. | Bổ sung hook `useEffect` kích hoạt `window.screen?.orientation?.lock('portrait').catch(() => {})` khi ứng dụng khởi chạy PWA. |
| 15 | **Low** | `src/components/pcn/PcnWorkspace.tsx` | 144 | Mục 2.1 (Dòng 545–555) | Sử dụng bảng màu `gray-*` (`bg-gray-100 text-gray-600 border-gray-200`) cho badge trạng thái `ON_HOLD`. | Vi phạm quy chuẩn trung tính: hệ thống chỉ dùng `slate-*`, cấm pha trộn `gray-*` và `zinc-*`. | Đổi toàn bộ các class `gray-*` thành `slate-*` (`bg-slate-100 text-slate-600 border-slate-200`). |
| 16 | **Low** | `src/components/pgdcn/PgdcnDossierSummaryGrid.tsx`, `src/components/pgd/PgdWorkspace.tsx` | `PgdcnDossierSummaryGrid.tsx:337`, `PgdWorkspace.tsx:824` | Mục 5.2.1.3 (Dòng 1050–1058) | Dùng `overflow-x-auto` thuần túy cho container bảng dữ liệu danh sách hồ sơ mà không kèm class utility `mobile-scroll-x`. | Thanh cuộn ngang trên mobile không có chỉ báo visual cue (bóng mờ chỉ báo cuộn) và mất quán tính cuộn mượt mà (`-webkit-overflow-scrolling: touch`). | Bổ sung class `mobile-scroll-x` cho các container bọc thẻ `<table>`. |
| 17 | **Low** | `src/components/pcn/PcnWorkspace.tsx`, `src/components/pgd/PgdWorkspace.tsx` | `PcnWorkspace.tsx:1240`, `PgdWorkspace.tsx:1297` | Mục 5.1 (Dòng 1022) | Phần Header cục bộ của Workspace PCN và PGD đặt chiều cao `h-14` (56px / 3.5rem). | Không khớp chuẩn chiều cao Header toàn cục 52px (`h-13` / 3.25rem) quy định tại Mục 5.1. | Đổi class chiều cao thành `h-13` (hoặc `h-[52px]`) để đồng bộ tuyệt đối tỷ lệ giao diện toàn ứng dụng. |
| 18 | **Low** | `src/components/pgdcn/PgdcnSidebar.tsx` | 140–160, 210 | Mục 5.1 (Dòng 1022) | Sidebar navigation item dùng `min-h-8 rounded-lg px-2.5 py-1.5` thay vì `py-2.5 rounded-xl px-3.5 gap-3 font-bold`; footer sidebar dùng icon `User` thay vì `Settings`. | Nhịp dọc sidebar quá dày hoặc quá mảnh, biểu tượng chân trang không đúng ngữ nghĩa cài đặt hệ thống. | Cập nhật padding, border radius của sidebar navigation item theo Mục 5.1; thay icon `User` bằng `Settings` ở chân sidebar. |
| 19 | **Low** | `src/components/pgd/PgdDossierSelector.tsx` | 73–76 | Mục 5.2.1.5 (Dòng 1085–1090) | Các button chọn nhanh hồ sơ dùng `min-h-10` (~40px), một số nút danh sách không có touch target padding. | Kích thước vùng bấm chạm nhỏ hơn tiêu chuẩn tối thiểu 44px x 44px trên màn hình cảm ứng di động. | Đổi sang `min-h-11` (44px) và đảm bảo `touch-action: manipulation` cho mọi interactive touch target. |

---

## III. KẾ HOẠCH HÀNH ĐỘNG KHẮC PHỤC THEO THỨ TỰ ƯU TIÊN

1. **Giai đoạn 1: Sửa nền tảng CSS Core & DOM Root (Ưu tiên cao nhất - Rủi ro cao nếu không xử lý)**
   - Khai báo lại toàn bộ CSS variables `:root` trong `src/index.css`.
   - Sửa `src/app/layout.tsx`: Thêm `<div id="root">` và container cảnh báo `#portrait-only-message`.
   - Sửa `src/index.css`: Đưa `.mobile-safe-bottom` vào media query mobile, bỏ class này khỏi Header button trong `PgdcnAppShell.tsx`.
   - Đưa `.pgdcn-toolbar-nowrap` về media query màn hình Desktop (`min-width: 768px`).

2. **Giai đoạn 2: Chuẩn hóa Tokens, Palette & Controls bị cấm**
   - Loại bỏ hoàn toàn thẻ `<datalist>` trong `PgdIntakeSampleTable.tsx`, thay bằng `select` chuẩn.
   - Thống nhất bảng Badge Tokens trong `PgdcnUiPrimitives.tsx` cho 9 trạng thái mẫu/hồ sơ.
   - Thay thế các mã màu hex hardcoded trong `PcnUserKpiTable.tsx` và `activityLogKpi.ts`.
   - Thay thế `gray-*` thành `slate-*` trong `PcnWorkspace.tsx`.

3. **Giai đoạn 3: Tinh chỉnh Typography & Responsive Spacing**
   - Sửa công thức `calc()` trong `src/index.css` khớp chuẩn 11px/1.2 và 13px/1.3.
   - Hợp nhất selector `.app-compact, .pcn-compact` cho spacing scale và scrollbar.
   - Bổ sung backdrop mờ cho Mobile Sidebar trong `PgdcnSidebar.tsx` và `PcnSidebar.tsx`.
   - Chuẩn hóa cấu trúc 3 phần cho các Modal còn thiếu `<footer>`.
   - Thêm class `mobile-scroll-x` và chuẩn hóa touch target `min-h-11` (44px).
