# BÁO CÁO RÀ SOÁT & ĐỐI CHIẾU QUY CHUẨN UI/UX & CARD COMPONENTS (R1)
**Hệ thống**: PGDCN Web App (Phòng Giám định - Chứng nhận & Phát triển thị trường)  
**Phân hệ**: PCN (Chứng nhận) & PGD (Giám định)  
**Tài liệu tham chiếu chuẩn**: `design.md` (Single Source of Truth)  
**Người thực hiện**: Explorer UI/UX & Card Components (`explorer_ui_cards`)  
**Ngày hoàn thành**: 2026-09-30  

---

## I. TỔNG QUAN & PHẠM VI RÀ SOÁT

Báo cáo này thực hiện nhiệm vụ **R1** theo phân công của Orchestrator, tập trung vào việc đối chiếu chi tiết giữa tài liệu đặc tả thiết kế chuẩn `design.md` và mã nguồn triển khai thực tế trên toàn bộ các thành phần Card, Toolbar, Badge Tokens, Action Icons, Tiến độ hoàn thành và Layout lưới hiển thị:

1. **Mục 2 `design.md`**: Hệ thống màu sắc, Design Tokens & Badge Trạng thái phiếu (Request Status Tokens).
2. **Mục 3 `design.md`**: Chi tiết thiết kế Card Components, đặc biệt **Mục 3.1.1 (Card Hồ sơ & Đề nghị TVCI Lab)**, cùng các card liên quan (Mục 3.1 Request Card, 3.2 Sample Card, 3.3 Schedule Card, 3.5 Summary Log Card, 3.6 Sổ Mẫu Thử & Luồng PYC).
3. **Mục 5 `design.md`**: Cấu trúc Layout tổng thể, Compact UI Density, Responsive Mobile, Dashboard Cockpit PGDCN và Toolbar quy chuẩn.
4. **Mã nguồn thực tế**:
   - `components/PcnDossierGroupCard.tsx` (Card Đề nghị & Hồ sơ PCN)
   - `components/PcnWorkspace.tsx` (Workspace Đề nghị PCN: Toolbar, Pills, ViewMode, Grid)
   - `components/PgdWorkspace.tsx` (`RequestCard`, Toolbar sổ đăng ký, Grid, ViewMode)
   - `components/PcnDossierQueueView.tsx` & `components/PgdDossierQueueView.tsx` (Hàng đợi công việc, Card view & Table view)
   - `components/PcnSampleFlowView.tsx` (Luồng mẫu thử & PYC nội bộ)
   - `components/PgdcnDashboardView.tsx` (Dashboard cockpit dùng chung)
   - `components/PgdcnUiPrimitives.tsx` & `utils/pgdcnDashboard.ts` (Badge tokens & primitives chuẩn)

---

## II. MA TRẬN ĐỐI CHIẾU CHI TIẾT (DISCREPANCY MATRIX)

| # | Mục / Dòng `design.md` | File / Component / Dòng mã nguồn | Đặc tả quy định | Hiện trạng mã nguồn thực tế | Đánh giá | Đề xuất giải pháp |
|---|------------------------|----------------------------------|-----------------|------------------------------|----------|-------------------|
| 1 | **3.1.1 (Dòng 630, 658)**: Khung Card & Hiệu ứng hover | `components/PcnDossierGroupCard.tsx` (Dòng 101–103) | `bg-white`, `border-slate-200`, `rounded-xl` hoặc `rounded-2xl`, `shadow-2xs hover:shadow-md transition-all duration-200` | `className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-md"` | **Khớp 100%** | Giữ nguyên; đạt chuẩn tối đa về visual feedback và bo góc. |
| 2 | **3.1.1 (Dòng 659)**: Hộp icon thư mục bên trái Card | `components/PcnDossierGroupCard.tsx` (Dòng 106–112) | Bo góc `rounded-xl`, nền vàng cam nhạt: `bg-amber-50 border border-amber-200/80 text-amber-500 w-11 h-11 shrink-0 flex items-center justify-center` | `className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50 text-amber-500 transition-colors hover:bg-amber-100"` kèm icon `<Folder size={22} className="fill-amber-100/90 text-amber-500" />` | **Khớp 100%** | Giữ nguyên; đúng hoàn toàn class màu và kích thước hộp biểu tượng. |
| 3 | **3.1.1 (Dòng 660–665)**: Cụm tiêu đề & Badges dòng 1 (PCN) | `components/PcnDossierGroupCard.tsx` (Dòng 118–151) | - Mã định danh: `font-mono font-black text-slate-800 text-sm tracking-tight`<br>- Badge mã HS: `bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5 text-xs font-semibold`<br>- Badge SL mẫu: `bg-slate-100 text-slate-600 rounded px-2 py-0.5 text-xs font-bold`<br>- Ngày tiếp nhận: `bg-slate-100 text-slate-600 rounded px-2 py-0.5 text-xs`<br>- Hạn hoàn tất: `bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 text-xs font-semibold` | - Mã ĐN: `font-mono text-sm font-black tracking-tight text-slate-800`<br>- Mã HS: `border-emerald-200 bg-emerald-50 text-emerald-800 font-bold`<br>- SL mẫu: `bg-slate-100 text-slate-600 font-bold text-xs`<br>- Ngày nhận: `bg-slate-100 text-slate-500 text-xs`<br>- Hạn: `border-blue-200 bg-blue-50 text-blue-700 font-bold text-xs` | **Khớp (95%)** | Chỉ khác biệt nhỏ về font-weight (`font-bold` vs `font-semibold`) và text-slate-500 vs 600, không ảnh hưởng bố cục. |
| 4 | **3.1.1 (Dòng 666–671)**: Cụm icon thao tác nhanh góc trên phải | `components/PcnDossierGroupCard.tsx` (Dòng 154–199) | - Icon Sửa (`Edit` - bút xanh dương)<br>- Icon In (`Printer`)<br>- Icon Sao chép (`Copy`)<br>- Icon Xóa (`Trash2` - đỏ nhạt)<br>- Icon Accordion (`ChevronDown/Up`)<br>- Kích thước compact `14px`, chevron `10px`<br>- Touch target mobile ~`44px` | - `Edit3 size={14}` màu text-blue-600<br>- `Printer size={14}`<br>- `Copy size={14}` (có sao chép clipboard + toast)<br>- `Trash2 size={14}` màu text-rose-500<br>- `ChevronDown / ChevronUp size={14}`<br>- Nút bọc `p-1 rounded` | **Lệch nhẹ (touch target & chevron)** | - Chevron đang dùng `14px` thay vì `10px`.<br>- Cần bổ sung lớp `mobile-touch-target` hoặc padding vùng bấm tối thiểu 44px trên mobile cho các icon này theo Mục 5.3. |
| 5 | **3.1.1 (Dòng 672–673)**: Tag Thương hiệu / Nhãn hiệu | `components/PcnDossierGroupCard.tsx` (Dòng 204–208) | `bg-blue-50 text-blue-600 border border-blue-100 font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wide` | `inline-block rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-600` | **Khớp 100%** | Giữ nguyên. |
| 6 | **3.1.1 (Dòng 674–675)**: Tên Khách hàng / Doanh nghiệp | `components/PcnDossierGroupCard.tsx` (Dòng 213–219) | `text-xs font-black text-slate-700 uppercase tracking-tight line-clamp-1` | `cursor-pointer truncate text-xs font-bold uppercase tracking-tight text-slate-700 transition-colors hover:text-slate-900` | **Khớp (95%)** | Giữ nguyên; `truncate` hoạt động tương đương `line-clamp-1` trên dòng đơn. |
| 7 | **3.1.1 (Dòng 676–678)**: Thanh tiến độ & Nhãn `X/Y XONG` | `components/PcnDossierGroupCard.tsx` (Dòng 74–86, 293–307) | - Đường tiến độ màu xanh lá: `bg-emerald-500 h-1.5 rounded-full`<br>- Nhãn tiến độ góc phải dạng `X/Y XONG` (ví dụ `1/1 XONG`, `0/2 XONG`, `3/5 XONG`) hoặc phần trăm hoàn thành, font monospace `text-[11px] font-black text-slate-600` | - Khung: `h-1.5 w-full overflow-hidden rounded-full bg-slate-100`, ruột: `bg-emerald-500 rounded-full transition-all duration-300`<br>- Nhãn: `font-mono text-[11px] font-black text-slate-500 whitespace-nowrap`<br>- Công thức: `completionRatio = isDone ? totalSamples : doneItemsCount; progressRatioLabel = "${completionRatio}/${totalSamples} XONG"` | **Khớp 100%** | Thuật toán tính toán chuẩn xác theo từng mẫu trong hồ sơ và các chặng PTN trả kết quả (`RESULT_RETURNED`, `CLOSED`). |
| 8 | **3.1.1 (Dòng 641–645, 679–681)**: Vùng mở rộng Accordion của Card | `components/PcnDossierGroupCard.tsx` (Dòng 224–290) | Mở rộng danh sách mẫu, số lượng, tuyến PTN, trạng thái KQTN sơ bộ và **danh mục tài liệu còn thiếu** (`Tài liệu còn thiếu: X mục`) | Hiển thị chi tiết từng mẫu (`#sampleCode`, model, quantity), badge KQTN sơ bộ (`Đã có KQ`, `Đang thử`, `Chờ KQ`), thông tin Chủ hồ sơ (`dossier.ownerUsername`). **Chưa có dòng tài liệu còn thiếu**. | **Thiếu trong code** | Bổ sung dòng hiển thị tài liệu còn thiếu của hồ sơ vào vùng Accordion của `PcnDossierGroupCard` (sử dụng thông tin checklist/requirements như ở `DossierPipelineCard`). |
| 9 | **3.1.1 (Dòng 630)**: Bố cục lưới Card 2 cột | `components/PcnWorkspace.tsx` (Dòng 977) & `components/PgdWorkspace.tsx` (Dòng 968) | `grid grid-cols-1 md:grid-cols-2 gap-3.5` | `className="grid grid-cols-1 md:grid-cols-2 gap-3.5"` | **Khớp 100%** | Giữ nguyên trên cả PCN và PGD. |
| 10 | **3.1.1 (Dòng 682–683)**: Nút chuyển đổi chế độ xem (Card vs Table) | `components/PcnWorkspace.tsx` (Dòng 639–667) & `components/PgdWorkspace.tsx` (Dòng 928–956) | Chuyển đổi nhanh giữa Dạng Card (mặc định) và Dạng Bảng (truyền thống) tại toolbar | `viewMode` mặc định `'card'`. Cụm nút toggle với icon `LayoutGrid` và `List`, active style `bg-slate-900 text-white shadow-xs` | **Khớp 100%** | Đã triển khai hoàn chỉnh cả ở Workspace lẫn các Queue View. |
| 11 | **3.1.1 (Dòng 649–656)**: Toolbar tìm kiếm & Status Filter Pills (PCN) | `components/PcnWorkspace.tsx` (Dòng 680–851) | - Search input `rounded-xl`, icon kính lúp, tìm theo mã PYC, số lô, mã HS, model, KH.<br>- Status Pills: Tổng PYC (`bg-slate-900 text-white`), Chờ xử lý, Đang thực hiện, Quá hạn.<br>- Lọc nâng cao (Filter kèm chevron) & Dropdown Sắp xếp (Số lô giảm dần, Ngày mới nhất).<br>- CTA chính: nút xanh lá `+ Nhận Phiếu / Tạo Đề nghị` (`bg-emerald-600 text-white font-black text-xs px-3.5 py-1.5 rounded-lg`). | - Input `rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs shadow-2xs` với placeholder chuẩn.<br>- Pills: `Tổng PYC` (bg-slate-900), `Chờ xử lý` (bg-amber-600), `Đang thử nghiệm` (bg-sky-600), `Quá hạn` (bg-rose-600), `QC4`, `QC9` có count badges.<br>- Lọc nâng cao `SlidersHorizontal` + Chevron, popover chọn trạng thái và lĩnh vực.<br>- Sắp xếp: `Mới nhất`, `Số lô giảm dần`.<br>- CTA: `+ Nhận Phiếu / Tạo Đề nghị` `bg-emerald-600`. | **Khớp 100%** | Thực thi xuất sắc theo chuẩn TVCI Lab. |
| 12 | **3.1.1 & 5.2.1.2**: Toolbar tìm kiếm & Status Filter Pills (PGD) | `components/PgdWorkspace.tsx` (Dòng 1490–1640) | Đồng bộ chuẩn TVCI Lab với màu nhận diện riêng của miền PGD | - Search input `rounded-xl` với placeholder PGD.<br>- Status Pills: `Tổng PYC`, `Chờ xử lý`, `Đang giám định`, `Đã ký / Xong`, `Thép`, `Máy móc` kèm count badges.<br>- Nút `Lọc thêm` (SlidersHorizontal) mở popover bộ lọc.<br>- CTA `Tạo PYC` (`bg-blue-600`). | **Khớp 100%** | Đã bản địa hóa xuất sắc cho đặc thù giám định PGD. |
| 13 | **3.1.1**: Card Giám định PGD (`RequestCard`) | `components/PgdWorkspace.tsx` (Dòng 700–908) | Đồng bộ Card chuẩn trực quan TVCI Lab sang hồ sơ giám định PGD | - Khung Card: `rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs`.<br>- Hộp icon vàng cam: `Folder size={22}` nền `bg-amber-50 text-amber-500`.<br>- Mã PYC: `bg-slate-900 text-white font-mono text-[11px] font-black`.<br>- Số ngoài, SL mẫu, Ngày nhận, Lịch hẹn `formatPgdDdMm`.<br>- Brand/Lô tag: `bg-blue-50 text-blue-600 font-bold`.<br>- Accordion thông số hàng hóa, địa điểm, phương thức.<br>- Thanh tiến độ `bg-emerald-500` và nhãn `X/Y XONG`.<br>- Nút `Mở ->` (`bg-blue-700 text-white`). | **Khớp 95%** | Card PGD đồng nhất giao diện rất tốt. **Điểm lệch**: Thiếu icon Sửa (`Edit3`) và Xóa (`Trash2`) trên thanh quick actions của card. |
| 14 | **2.2 (Dòng 553–566)**: Hệ thống Badge Trạng thái phiếu | `design.md` Mục 2.2 vs `components/PcnWorkspace.tsx` (Dòng 129–149) & `components/PgdWorkspace.tsx` (Dòng 284–291) | Mục 2.2 chỉ quy định 10 trạng thái `RequestStatus` cũ (PENDING, APPROVED, SAMPLES_RECEIVED, SCHEDULED, TESTING, RESULTS_SUBMITTED, RESULTS_APPROVED, COMPLETED, CANCELLED, REQ_SUPPLEMENT) với mã Tailwind `-100`, text `-800`, border `-300` | - PCN thực tế dùng `PcnDossierStatus` (19 trạng thái), class trong `PcnWorkspace` dùng tông nhạt `-50`, text `-700`, border `-200`.<br>- PGD thực tế dùng `PgdInspectionStatus` (14 trạng thái), `StatusBadge` chỉ chia 3 màu gộp (emerald cho hoàn thành, rose cho hủy, blue cho tất cả các bước còn lại).<br>- `components/PgdcnUiPrimitives.tsx` đã xây dựng `PgdcnStatusBadge` với 10 `StateTone` chuẩn (`neutral`, `info`, `warning`, `success`, `critical`, `cyan`, `indigo`, `purple`, `orange`, `teal`). | **Lệch & Thiếu trong spec** | - `design.md` mục 2.2 chưa cập nhật bảng tokens cho 19 trạng thái PCN và 14 trạng thái PGD.<br>- `StatusBadge` trong `PgdWorkspace` cần chuyển sang dùng `PgdcnStatusBadge` để không bị gộp màu thô. |
| 15 | **3.1 (Dòng 588–624)**: Request Card kiểu DDT/PTN cũ | `design.md` Mục 3.1 vs Toàn bộ Codebase | Card PYC kiểu PTN: DDT-2026-001, Buồng Chamber 1/2, KTV Nguyễn Văn A, Tem niêm phong | Mã nguồn PGDCN không còn dùng Request Card kiểu PTN vật lý này nữa mà đã chuyển hoàn toàn sang Card Hồ sơ Đề nghị PCN (`PcnDossierGroupCard`) và Card PYC Giám định PGD (`RequestCard`). | **Thiếu cập nhật trong spec** | Cần ghi rõ trong `design.md` Mục 3.1: Đây là đặc tả tham chiếu kế thừa từ app DDT (Legacy Reference), phân hệ hoạt động PGDCN áp dụng trực tiếp Mục 3.1.1. |
| 16 | **3.2 (Dòng 687–709) & 3.3 (Dòng 711–733)**: Sample Inventory Card & Schedule Item Card | `design.md` Mục 3.2, 3.3 vs `components/PcnSampleFlowView.tsx` | Mô tả `WarehouseSidebar.tsx` và Bảng lịch ATD/EMC kéo thả (`@dnd-kit`) | Các file này thuộc hệ thống PTN thử nghiệm DDT. Trên PGDCN, luồng mẫu được triển khai qua `PcnSampleFlowView.tsx` (Sổ mẫu thử và luồng PYC - Mục 3.6 & 3.6.1) và `PgdSampleOperationsView.tsx`. | **Thiếu cập nhật trong spec** | Cập nhật Mục 3.2 và 3.3 trong `design.md` để ghi nhận rõ ranh giới: Thử nghiệm vật lý tại PTN là legacy/tích hợp ngoài; PCN/PGD quản lý luồng mẫu theo Mục 3.6. |
| 17 | **3.6 & 3.6.1 (Dòng 768–802)**: Sổ Mẫu Thử & Luồng PYC | `components/PcnSampleFlowView.tsx` (Dòng 205–265) | - KPI đếm theo mẫu: tổng mẫu, mẫu đang ở PTN, mẫu chờ KQTN, có sự cố.<br>- Bảng cố định cột: Lô, Mẫu/model, SL, Tuyến PTN, Vị trí hiện tại, Trạng thái.<br>- Chặng tuyến tuần tự hiển thị trạng thái và PYC liên kết. | - Dải KPI: `Tổng mẫu thử`, `Đang luân chuyển`, `Chờ KQTN`, `Có sự cố` (dòng 214).<br>- Bảng dữ liệu với đầy đủ các cột quy chuẩn (dòng 233–265).<br>- Tuyến chặng hiển thị qua `RouteCell` (dòng 89–96). | **Khớp 100%** | Triển khai rất chi tiết và tuân thủ chặt chẽ Mục 3.6.1 của `design.md`. |
| 18 | **5.2.1.2 (Dòng 1116–1128)**: Dashboard PGDCN dùng chung (Operations Cockpit) | `components/PgdcnDashboardView.tsx` (Dòng 90–200) | - Command header với CTA `Tạo Đề nghị` (PCN) và `Tạo PYC` (PGD).<br>- Hàng đợi hành động ("Việc cần chú ý").<br>- Dải 6 KPI phân bổ.<br>- Pipeline theo miền (PCN xanh lá vs PGD xanh dương).<br>- Không mutation trực tiếp. | - Header (dòng 92–109): Đúng 2 nút CTA `Tạo Đề nghị` và `Tạo PYC`.<br>- Hàng đợi hành động `AttentionQueue` ("Việc cần chú ý", dòng 136–170).<br>- `DomainPipelineCard` (dòng 172–200) phân tách rõ ràng emerald/blue. | **Khớp 100%** | Bố cục và hành vi hoàn toàn khớp với đặc tả buồng lái điều hành. |
| 19 | **5.2.1.3 (Dòng 1133)**: Quy chuẩn dàn trang Toolbar | `components/PcnWorkspace.tsx` (Dòng 681) | Toolbar desktop phải nằm trên 1 hàng không bị vỡ (`pgdcn-toolbar-nowrap`), mobile xếp 1 cột | `PcnWorkspace.tsx` dùng `flex flex-wrap items-center gap-2`. Trên màn hình laptop nhỏ, các pill có thể bị rớt xuống dòng thứ 2 thay vì cuộn ngang nhẹ hoặc co giãn đều. | **Lệch nhẹ** | Đưa class `pgdcn-toolbar-nowrap` hoặc cơ chế overflow cuộn ngang cho dải pill trên desktop hẹp theo đúng chuẩn Mục 5.2.1.3. |

---

## III. PHÂN TÍCH CHUYÊN SÂU CÁC TRỌNG TÂM KIỂM TRA

### 1. Phân tích Card Hồ sơ & Đề nghị TVCI Lab (`PcnDossierGroupCard.tsx`)
- **Visual Hierarchy**: Cực kỳ xuất sắc. Phân cấp thị giác 4 tầng rõ rệt:
  1. *Tầng 1 (Định danh & Thao tác)*: Mã Đề nghị in đậm `font-mono text-sm font-black` kết hợp mã hồ sơ trong badge xanh lá cây, số mẫu xám, ngày tiếp nhận và hạn hoàn tất. Phía đối diện là cụm icon thao tác nhanh trực quan.
  2. *Tầng 2 (Thương hiệu)*: Tag nhãn hiệu xanh dương nhạt bo góc mềm, chữ in hoa nổi bật.
  3. *Tầng 3 (Khách hàng)*: Tên doanh nghiệp in hoa rõ ràng, dễ đối soát.
  4. *Tầng 4 (Tiến độ)*: Đường tiến độ xanh lá thanh mảnh `1.5px` cùng nhãn `X/Y XONG`.
- **Điểm cần hoàn thiện**:
  - Khi mở rộng Accordion, người dùng mong muốn nhìn thấy ngay số lượng tài liệu còn thiếu để biết hồ sơ đang nghẽn ở đâu mà không bắt buộc phải click chuyển trang vào chi tiết hồ sơ.

### 2. Phân tích Toolbar Lọc dạng Pill (Pill Filter Tokens)
- Cả hai workspace chính (`PcnWorkspace.tsx` và `PgdWorkspace.tsx`) đã triển khai mẫu Toolbar Pill Tokens chuẩn TVCI Lab:
  - Tách bạch rõ rệt giữa nút "Tổng PYC" (nền đen chữ trắng `bg-slate-900 text-white`) với các nút trạng thái chức năng (`Chờ xử lý`, `Đang thực hiện`, `Quá hạn`).
  - Mỗi pill đều có badge số đếm (`count badge`) nhỏ gọn bo góc, tương phản cao, đổi màu thông minh khi pill được kích hoạt.
  - Tích hợp bộ lọc phân hệ chuyên môn: `QC4`/`QC9` cho PCN; `Thép`/`Máy móc` cho PGD.
  - Dropdown "Lọc nâng cao" / "Lọc thêm" bằng icon `SlidersHorizontal` giúp mở rộng thêm các tiêu chí nâng cao mà không làm rối mắt giao diện chính.

### 3. Phân tích Độ lệch Badge Tokens & Trạng thái Màu sắc
- **Điểm nghẽn lớn nhất trong tài liệu `design.md`**: Bảng mã tại **Mục 2.2** vẫn ghi chú các trạng thái `RequestStatus` của hệ thống PTN cũ (PENDING, APPROVED, SAMPLES_RECEIVED, SCHEDULED, TESTING, RESULTS_SUBMITTED, RESULTS_APPROVED, COMPLETED, CANCELLED, REQ_SUPPLEMENT).
- Trong khi đó, mã nguồn thực tế đã phát triển thành hệ thống phân quyền 2 miền độc lập với số lượng trạng thái phong phú hơn:
  - `PcnDossierStatus` (19 trạng thái).
  - `PgdInspectionStatus` (14 trạng thái).
- Sự thiếu hụt này dẫn đến việc mã nguồn tự định nghĩa các bảng class màu phân tán:
  - `PcnWorkspace.tsx` có một bảng `statusClasses` riêng (tông nhạt -50).
  - `PgdWorkspace.tsx` có hàm `StatusBadge` riêng (chỉ gom 3 màu).
  - `components/PgdcnUiPrimitives.tsx` có `PgdcnStatusBadge` với 10 `StateTone`.
- **Giải pháp chuẩn hóa**: Cần cập nhật `design.md` mục 2.2 bổ sung bảng token chính thức cho `PcnDossierStatus` và `PgdInspectionStatus`, sau đó quy chuẩn toàn bộ code về dùng chung component `PgdcnStatusBadge`.

### 4. Phân tích Cơ chế tính toán Tiến độ `X/Y XONG`
- Thuật toán tại `PcnDossierGroupCard.tsx` (dòng 74–86):
  ```typescript
  const totalSamples = matchingItems.length || proposal.quantity || 1;
  const isDone = ['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(dossier.status);
  const doneItemsCount = matchingItems.filter((item) => {
    const itemRoutes = sampleRoutes.filter((r) => r.sampleLotId === item.sampleLotId);
    return itemRoutes.some((r) => r.status === 'RESULT_RETURNED' || r.status === 'CLOSED');
  }).length;
  const completionRatio = isDone ? totalSamples : doneItemsCount;
  const progressRatioLabel = `${completionRatio}/${totalSamples} XONG`;
  const progressPercent = isDone ? 100 : Math.round((completionRatio / totalSamples) * 100);
  ```
- Đây là cơ chế tính toán chính xác, phản ánh đúng thực tế thử nghiệm: mẫu chỉ được tính là hoàn thành khi tuyến PTN đã trả kết quả hoặc đóng tuyến; khi toàn bộ hồ sơ được duyệt/phát hành thì tỷ lệ tự động đạt 100%.

### 5. Phân tích Layout lưới 2 cột & View Mode Switcher
- Cả PCN và PGD đều đã áp dụng quy chuẩn lưới 2 cột `grid grid-cols-1 md:grid-cols-2 gap-3.5`.
- Chế độ xem mặc định luôn là `card` (Dạng thẻ).
- Nút chuyển đổi chế độ xem hiển thị dạng segmented toggle với biểu tượng `LayoutGrid` và `List`, hoạt động mượt mà và chuyển đổi tức thì giữa giao diện lưới thẻ trực quan và bảng dữ liệu chuyên sâu có hỗ trợ cuộn ngang an toàn (`mobile-scroll-x`).

---

## IV. BẢN ĐỀ XUẤT VÁ ĐẶC TẢ `design.md` (SPECIFICATION PATCH PROPOSAL)

Để bảo đảm nguyên tắc **Single Source of Truth** tuyệt đối theo `AGENTS.md`, đề xuất bổ sung/chỉnh sửa các mục sau trong `design.md`:

### 1. Bổ sung vào Mục 2.2: Bảng ánh xạ Badge Tokens cho PCN & PGD
Thêm bảng quy chuẩn cho `PcnDossierStatus` và `PgdInspectionStatus` dựa trên hệ thống 10 `StateTone` của `PgdcnUiPrimitives`:
```markdown
#### 2.2.1. Badge Tokens Trạng thái Hồ sơ Chứng nhận PCN (`PcnDossierStatus`)
| Nhóm tiến trình | Trạng thái | Nhãn hiển thị | StateTone | Mã Tailwind đề xuất |
|:---|:---|:---|:---|:---|
| Khởi tạo / Tiếp nhận | `DRAFT`, `INTAKE_REVIEW`, `AWAITING_DOCUMENTS` | Bản nháp / Kiểm tra ĐN / Chờ bổ sung | `warning` / `info` | `border-amber-200 bg-amber-50 text-amber-800` / `border-blue-200 bg-blue-50 text-blue-800` |
| Phân công & Đánh giá | `ASSIGNED`, `PLAN_PENDING_APPROVAL`, `FIELD_EVALUATION` | Đã phân công / Chờ duyệt KH / Đang đánh giá | `info` / `indigo` | `border-indigo-200 bg-indigo-50 text-indigo-800` |
| Thử nghiệm PTN | `AWAITING_SAMPLING`, `SENT_TO_LAB`, `AWAITING_RESULTS` | Chờ lấy mẫu / Đã gửi PTN / Chờ KQTN | `cyan` / `purple` / `orange` | `border-purple-200 bg-purple-50 text-purple-800` |
| Xử lý kết quả | `CORRECTIVE_ACTION`, `TECHNICAL_REVIEW`, `WAITING_APPROVAL` | Đang khắc phục / Soát xét KT / Chờ phê duyệt | `critical` / `warning` | `border-rose-200 bg-rose-50 text-rose-800` / `border-amber-200 bg-amber-50 text-amber-800` |
| Hoàn tất | `APPROVED`, `ISSUED`, `DELIVERED`, `ARCHIVED` | Đã phê duyệt / Phát hành / Giao KH / Lưu trữ | `success` | `border-emerald-200 bg-emerald-50 text-emerald-800` |
| Đóng / Hủy | `REJECTED`, `CANCELLED`, `ON_HOLD` | Từ chối / Đã hủy / Tạm dừng | `critical` / `neutral` | `border-rose-200 bg-rose-50 text-rose-800` / `border-slate-200 bg-slate-100 text-slate-700` |

#### 2.2.2. Badge Tokens Trạng thái Hồ sơ Giám định PGD (`PgdInspectionStatus`)
| Nhóm tiến trình | Trạng thái | Nhãn hiển thị | StateTone | Mã Tailwind đề xuất |
|:---|:---|:---|:---|:---|
| Tiếp nhận | `DRAFT`, `CAPABILITY_REVIEW`, `READY_TO_EXECUTE` | Bản nháp / Chờ xem xét năng lực / Chấp nhận TH | `info` / `warning` | `border-blue-200 bg-blue-50 text-blue-800` |
| Hiện trường & PTN | `PREPARING`, `FIELD_INSPECTION`, `WAITING_LAB_RESULTS` | Chuẩn bị / Đang hiện trường / Chờ KQ PTN | `cyan` / `purple` | `border-cyan-200 bg-cyan-50 text-cyan-800` / `border-purple-200 bg-purple-50 text-purple-800` |
| Soát xét & Duyệt | `RESULTS_REVIEW`, `TECHNICAL_REVIEW`, `LEADERSHIP_APPROVAL` | Xem xét KQ / Soát xét KT / Chờ duyệt LĐ | `orange` / `indigo` | `border-indigo-200 bg-indigo-50 text-indigo-800` |
| Hoàn tất & Đóng | `SIGNED`, `RESULT_RETURNED`, `ARCHIVED` | Đã ký / Đã trả kết quả / Đã lưu trữ | `success` | `border-emerald-200 bg-emerald-50 text-emerald-800` |
| Ngoại lệ | `REJECTED`, `CANCELLED` | Từ chối / Đã hủy | `critical` | `border-rose-200 bg-rose-50 text-rose-800` |
```

### 2. Làm rõ ghi chú tại Mục 3.1: Phân định Legacy Reference vs Active Profile
Thêm phần ghi chú ngay đầu Mục 3.1:
> **Ghi chú phân định kiến trúc**: Cấu trúc Request Card kiểu PTN (buồng thử ATD/EMC, buồng Chamber 1/2) tại Mục 3.1 là tài liệu tham chiếu kế thừa từ hệ thống thử nghiệm DDT (Legacy Reference). Đối với phân hệ PGDCN active profile (PCN và PGD), toàn bộ cấu trúc Card và Toolbar được chuẩn hóa áp dụng thống nhất theo quy cách tại **Mục 3.1.1 (Card Hồ Sơ & Đề Nghị PCN/PGD)**.

---

## V. ĐỀ XUẤT KẾ HOẠCH HÀNH ĐỘNG CODE (KHI ĐƯỢC PHÊ DUYỆT)

Sau khi người dùng và Orchestrator duyệt báo cáo rà soát, đề xuất danh sách hành động sửa code tối ưu:

1. **`components/PcnDossierGroupCard.tsx`**:
   - Thêm hiển thị tóm tắt tài liệu còn thiếu của hồ sơ vào vùng mở rộng Accordion (dòng 279) để khớp mockup đặc tả dòng 644.
   - Bổ sung class `mobile-touch-target min-h-11 min-w-11` cho các nút icon thao tác nhanh trên mobile; thu gọn chevron xuống `10px` (`ChevronDown size={10}`).
2. **`components/PgdWorkspace.tsx` (`RequestCard`)**:
   - Thay thế `StatusBadge` cục bộ (hiện đang gom 3 màu thô) bằng `PgdcnStatusBadge` chuẩn để hiển thị đầy đủ sắc thái trạng thái hồ sơ giám định.
   - Bổ sung icon thao tác nhanh Sửa (`Edit3`) và Xóa (`Trash2`) khi người dùng có thẩm quyền tương tự card PCN.
3. **`components/PcnWorkspace.tsx`**:
   - Chuẩn hóa container toolbar chính sử dụng `pgdcn-toolbar-nowrap` kết hợp cuộn ngang dự phòng trên mobile/laptop hẹp để bảo đảm hàng toolbar không bị vỡ hàng theo Mục 5.2.1.3.

---

*Báo cáo được hoàn thành và đối chiếu độc lập bởi Explorer UI/UX & Card Components.*
