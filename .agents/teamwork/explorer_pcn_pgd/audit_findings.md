# BÁO CÁO RÀ SOÁT KỸ THUẬT PHÂN HỆ PCN & PGD: CARDS & MODALS

**Người thực hiện**: Explorer 2 (teamwork_preview_explorer)  
**Thời điểm thực hiện**: 2026-09-28  
**Tài liệu quy chuẩn (Single Source of Truth)**: `design.md` (Mục 3: Card Components, Mục 4: Modal Design, Mục 4.7: Soạn thảo tài liệu State UI).  
**Nguyên tắc**: Read-only investigation (không sửa đổi mã nguồn).

---

## 1. TỔNG QUAN ĐÁNH GIÁ (EXECUTIVE SUMMARY)

1. **Về Card Components (Mục 3 design.md)**:
   - Kiến trúc Card Hồ Sơ & Đề Nghị PCN/PGD (`PcnDossierGroupCard.tsx`) đã triển khai khung cơ bản nhưng bị thiếu các thành phần quan trọng theo chuẩn Mục 3.1.1: Thanh tiến độ đang tính % cứng theo status thay vì theo tỷ lệ hoàn thiện hồ sơ/bước; Accordion vùng mở rộng thiếu trạng thái KQTN sơ bộ (Chờ KQ / PASS / Cần thử lại) và danh sách tài liệu bắt buộc còn thiếu; Header thiếu badge số lượng mẫu ở góc phải.
   - Tại `PcnDossierQueueView.tsx` và `PgdDossierQueueView.tsx`, Card View đang render markup riêng lẻ thay vì dùng `PcnDossierGroupCard`, dẫn đến mất hoàn toàn khả năng mở rộng Accordion xem mẫu & tuyến PTN, đồng thời thiếu thanh Filter Chips Toolbar chuẩn (`rounded-xl text-[11px] font-black uppercase`). Nút "Mở hồ sơ" trong PCN Queue lại mang màu xanh dương (Blue) thay vì xanh ngọc (Emerald).
   - Màn hình Sổ Mẫu Thử & Luồng PYC (`PcnSampleFlowView.tsx`): **Lệch chuẩn kiến trúc nghiêm trọng** so với Mục 3.6. Spec yêu cầu hiển thị dạng **Card Flow** tuần tự có mũi tên nối các chặng (1 Hiệu suất → 2 EMC → 3 ATĐ), nhưng mã nguồn đang dựng thành một **Bảng dữ liệu `<table>` rộng tối thiểu 980px**, buộc cuộn ngang toàn trang trên mobile. KPI đang đếm theo Lô (`stats.lots`) thay vì đếm theo Mẫu (`tổng mẫu, mẫu đang ở PTN, chờ PYC, chờ KQTN, có sự cố`).

2. **Về Modal Components (Mục 4 design.md)**:
   - `PgdcnWindowsWorkflowModal.tsx` (Mục 4.1.2) và `PcnSampleRequestBundleModal.tsx` (Mục 4.1.1) được thiết kế và thực thi rất tốt, đáp ứng chuẩn Windows workflow modal, khóa ngữ cảnh khách hàng và boundary API riêng biệt.
   - Các Modal vệ tinh (`PcnTemplateSettingsModal.tsx`, `PcnProposalDetailModal.tsx`, `PcnResultDetailModal.tsx`, `ActivityLogView.tsx` modal) có nhiều điểm lệch chuẩn: Nút đóng header và các nút footer có kích thước chạm nhỏ (~28-36px), vi phạm tiêu chuẩn vùng chạm tối thiểu 44px (`min-h-11 min-w-11`) và thiếu `focus-visible` ring.
   - `PcnOperationalFormModal.tsx` vi phạm nghiêm trọng quy chuẩn Typography Mục 4.7: Ô nhập liệu có font `text-[10px]` và nhãn `text-[9px]`, chiều cao `min-h-9` (36px), trong khi chuẩn spec yêu cầu ô nhập 13–14px, nhãn 12–13px, chiều cao tối thiểu khoảng 44px.

3. **Về Trạng thái tương tác (Interactive States)**:
   - Các nút chính có hiệu ứng hover/active và focus-visible ring tương đối tốt theo màu phân hệ (Emerald cho PCN, Blue cho PGD).
   - Tuy nhiên, nhiều nút thao tác phụ bị thiếu focus ring khi duyệt bằng bàn phím; một số nút khi không khả dụng bị ẩn hoàn toàn thay vì hiển thị trạng thái disabled kèm tooltip giải thích lý do; các view danh sách thiếu skeleton/loading indicator khi nạp dữ liệu.

---

## 2. BẢNG CHI TIẾT CÁC PHÁT HIỆN LỆCH CHUẨN (AUDIT FINDINGS)

| File / Component | Hiện trạng thực tế | Chuẩn design.md (kèm trích dẫn mục) | Mức độ | Đề xuất khắc phục |
| :--- | :--- | :--- | :---: | :--- |
| `components/PcnSampleFlowView.tsx` (lines 205-290) | Màn hình hiển thị dưới dạng **Bảng dữ liệu `<table>` rộng tối thiểu 980px** (`min-w-[980px]`). Người dùng phải cuộn ngang và mở accordion lồng trong hàng bảng để xem tuyến thử. Không có mũi tên flow tuần tự giữa các chặng. | **Mục 3.6**: "Đây là card trung tâm của màn hình PYC & luân chuyển mẫu. Card không bắt đầu bằng số PYC; nó bắt đầu bằng mã lô/mã mẫu và hiển thị tuyến thử như một flow có chặng tuần tự... Trên mobile, flow cho phép cuộn ngang trong card; thông tin mã mẫu/vị trí vẫn nằm ở phần đầu card." | **High** | Chuyển đổi giao diện danh sách lô/mẫu từ dạng `<table>` sang danh sách **Card Flow**. Mỗi card hiển thị Header (mã lô/mã mẫu, tên mẫu, SL, vị trí hiện tại) → Flow chặng ngang tuần tự (`1 PTN A ──→ 2 PTN B`) với badge trạng thái chặng, badge PYC → Footer (Vị trí hiện tại, Chặng tiếp theo, Nút Mở card hồ sơ). |
| `components/PcnSampleFlowView.tsx` (lines 207) | 4 KPI cards trên đầu trang đếm theo **Lô mẫu**: `Tổng lô mẫu` (`stats.lots`), `Đang luân chuyển` (`stats.moving`), `Chờ KQTN` (`stats.waitingResults`), `Có vấn đề` (`stats.issues`). | **Mục 3.6**: "Khu vực KPI của màn hình đếm theo **mẫu**: tổng mẫu, mẫu đang ở PTN, mẫu chờ lập PYC, mẫu chờ KQTN, mẫu có sự cố. Không dùng số route làm KPI chính; số route chỉ là thông tin phụ." | **High** | Sửa logic thống kê KPI: Tính tổng theo số lượng mẫu (`sampleItems` hoặc `lot.quantity`) tương ứng với từng trạng thái thay vì đếm số lượng lô. |
| `components/PcnDossierGroupCard.tsx` (lines 105-128, 234-242) | Thanh tiến độ tính % tĩnh bằng hàm `getProgressPercentage(status)` cố định theo enum trạng thái (DRAFT: 10%, INTAKE_REVIEW: 25%, ASSIGNED: 45%...). | **Mục 3.1.1 (Mục 3)**: "Thanh tiến độ (Progress Indicator): Hiển thị tỷ lệ hoàn thiện các bước hoặc số lượng tài liệu bắt buộc đã nạp / còn thiếu (`requiredDocumentPresent / requiredDocumentTotal`)." | **High** | Thay thế hàm tính % tĩnh bằng tỷ lệ tài liệu bắt buộc thực tế (`requiredDocumentPresent / requiredDocumentTotal * 100`) hoặc số bước quy trình đã hoàn thành, đồng bộ với `PcnDossierQueueView`. |
| `components/PcnDossierGroupCard.tsx` (lines 246-298) | Vùng Accordion mở rộng chỉ hiển thị danh sách `matchingItems` thô (mã mẫu, model, mã lab) hoặc fallback ra text `proposal.specifications`. | **Mục 3.1.1 (Mục 5)**: "Vùng Accordion (Expanded Panel): Danh sách mẫu thử / model trong lô kèm trạng thái tuyến gửi phòng thử nội bộ... Trạng thái kết quả thử nghiệm sơ bộ (Chờ KQ / PASS / Cần thử lại). Danh sách tài liệu bắt buộc còn thiếu cần bổ sung." | **High** | Bổ sung vào Accordion panel: (1) Badge trạng thái KQTN sơ bộ của từng mẫu (Chờ KQ / Đạt / Cần thử lại), (2) Khối cảnh báo danh sách tài liệu bắt buộc còn thiếu cần nạp. |
| `components/PcnOperationalFormModal.tsx` (lines 151, 153-157) | Các trường nhập liệu sử dụng `min-h-9` (36px), cỡ chữ `text-[10px]`, nhãn trường dùng `text-[9px] font-black uppercase text-slate-400`. | **Mục 4.7**: "Bề mặt dùng chung phải ưu tiên nhãn nghiệp vụ và typography đọc được: nội dung/ô nhập 13–14px, nhãn 12–13px, metadata tối thiểu 11px... control/action đạt target tối thiểu khoảng 44px." | **High** | Tăng chiều cao ô nhập liệu lên `min-h-11` (44px), cỡ chữ nội dung `text-xs`/`text-sm` (13-14px), nhãn trường `text-xs` (12-13px) để tuân thủ accessibility và chuẩn typography Mục 4.7. |
| `components/PcnDossierQueueView.tsx` (lines 142-241) | Tự dựng markup Card inline thay vì gọi `PcnDossierGroupCard`. Thiếu hoàn toàn Accordion mở rộng xem mẫu & tuyến PTN; thiếu badge Lĩnh vực QC4/QC9; nút "Mở hồ sơ" dùng màu xanh dương (`bg-blue-700`). | **Mục 3.1.1**: Toàn bộ danh sách Đề nghị / Hồ sơ PCN chuyển đổi sang Card lưới 2 cột, hỗ trợ mở rộng nhanh (Accordion) để xem mẫu/tiến độ; màu nhận diện PCN dùng emerald. | **Medium** | Tái cấu trúc Card View trong `PcnDossierQueueView` bằng cách sử dụng trực tiếp component chuẩn `PcnDossierGroupCard`, hoặc bổ sung Accordion mẫu/kết quả và chuyển nút "Mở hồ sơ" sang màu `bg-emerald-600 hover:bg-emerald-700`. |
| `components/PgdDossierQueueView.tsx` (lines 144-245) | Card View 2 cột thiếu hoàn toàn tính năng mở rộng Accordion (xem mẫu PGD, phân loại mẫu lưu/LAB, kết quả); thiếu Badge số lượng mẫu ở Header; nút "Mở hồ sơ" có chiều cao ~32px (`px-3 py-1.5`). | **Mục 3.1.1 & Mục 4.1.2**: Card lưới 2 cột kế thừa kiến trúc RequestGroupCard, có Accordion mở rộng chi tiết mẫu/tiến độ; nút thao tác đạt target tối thiểu 44px. | **Medium** | Bổ sung nút Chevron và vùng Accordion trong card PGD để xem nhanh các mẫu thử thuộc hồ sơ; tăng chiều cao nút "Mở hồ sơ" lên `min-h-11` (44px). |
| `components/PcnDossierGroupCard.tsx` (lines 139-186) | Header Card: Icon hồ sơ dùng `Layers` nền đen; Mã Đề nghị nằm trong thẻ đen `bg-slate-900`; Badge Lĩnh vực (QC4/QC9) nằm ở bên trái cạnh mã; thiếu Badge số lượng mẫu ở góc phải Header. | **Mục 3.1.1 (Mục 1)**: "Header Card: Bên trái: Biểu tượng hồ sơ (FolderOpen / Award), Mã Đề nghị (`font-mono font-black text-slate-800 tracking-wider`) và Mã Hồ sơ liên kết. Bên phải: Badge số lượng mẫu (`font-bold bg-slate-100 text-slate-600`), Badge Lĩnh vực (QC4 / QC9) và Badge Trạng thái hồ sơ." | **Medium** | Điều chỉnh Header Card: Đổi icon sang `FolderOpen`, mã Đề nghị hiển thị `text-slate-800 tracking-wider`, chuyển Badge Lĩnh vực và Badge số lượng mẫu (`font-bold bg-slate-100 text-slate-600`) sang cụm bên phải cạnh Badge Trạng thái. |
| `components/PcnWorkspace.tsx` (lines 725-756) & `PcnDossierQueueView.tsx` (lines 122-137) | Thanh lọc nhanh (Filter chips) dùng `rounded-lg text-xs font-bold` và chữ thường (`Tiếp nhận / Rà soát`, `Chờ tài liệu`, `Đã duyệt / Hoàn tất`), thiếu các trạng thái Quá hạn, Đang xử lý. `PcnDossierQueueView` thiếu hoàn toàn chip toolbar. | **Mục 3.1.1 (Mục 6)**: "Thanh lọc nhanh (Filter Chips Toolbar): Nằm trên đầu danh sách: Các nút chip bo góc `rounded-xl`, tracking `text-[11px] font-black uppercase`: Tất cả, QC4, QC9, Tiếp nhận, Đang xử lý, Quá hạn, Hoàn thành." | **Medium** | Chuẩn hóa toàn bộ filter chips toolbar theo đúng spec token: `rounded-xl`, `text-[11px] font-black uppercase`, bổ sung chip "ĐANG XỬ LÝ" và "QUÁ HẠN". Đưa chip toolbar vào cả `PcnDossierQueueView`. |
| `components/PgdDossierQueueView.tsx` (lines 90-140) | Thiếu hoàn toàn thanh Filter Chips Toolbar trên đầu danh sách (chỉ có ô tìm kiếm và nút chuyển chế độ view). | **Mục 3.1.1 (Mục 6)**: "Thanh lọc nhanh (Filter Chips Toolbar): Nằm trên đầu danh sách: Các nút chip bo góc `rounded-xl`, tracking `text-[11px] font-black uppercase`: Tất cả, nhóm thép/máy móc/than của PGD, Tiếp nhận, Đang xử lý, Quá hạn, Hoàn thành." | **Medium** | Bổ sung thanh Filter Chips Toolbar chuẩn `rounded-xl text-[11px] font-black uppercase` cho PGD: Tất cả, Thép/Kim loại, Máy móc, Than, Tiếp nhận, Đang xử lý, Hoàn tất. |
| `components/PcnTemplateSettingsModal.tsx` (lines 43, 51, 58, 62) | Nút đóng header (`p-1.5`), nút tải file (`px-3 py-2 text-[10px]`), nút đóng footer (`px-3 py-2`) đều có chiều cao khoảng 30-32px, thiếu `focus-visible:ring`. | **Mục 4.7 (line 1006)**: "Modal Cài đặt DOCX của PCN và PGD cũng dùng cùng contract: overlay có `role=dialog`, panel `flex min-h-0 max-h` cùng chiều rộng chuẩn, header `shrink-0`, body `mobile-scroll-y/min-h-0`, nút đóng tối thiểu 44px và focus ring." | **Medium** | Cập nhật `PcnTemplateSettingsModal`: Đặt nút đóng `min-h-11 min-w-11` kèm `focus-visible:ring-2 focus-visible:ring-emerald-500`, tăng kích thước nút tải lên và nút đóng lên `min-h-11`. |
| `components/PgdSampleOperationsView.tsx` (lines 112, 119) | Thiếu nút hành động chính "Tạo Phiếu yêu cầu thử nghiệm"; Nút "Mở hồ sơ" và toggle chi tiết PTN dùng `min-h-8` (~32px) và cỡ chữ `text-[9px]`. | **Mục 3.6.1**: "Tiêu đề trang là Sổ quản lý mẫu; KPI chính đếm theo số dòng mẫu... Nút hành động chính là Tạo Phiếu yêu cầu thử nghiệm... control/action đạt target tối thiểu khoảng 44px." | **Medium** | Bổ sung nút "Tạo Phiếu yêu cầu thử nghiệm" mở modal PYC PGD; tăng chiều cao nút "Mở hồ sơ" và summary toggle lên `min-h-11` (44px), font chữ tối thiểu `text-[11px]`. |
| `components/PcnProposalDetailModal.tsx` (lines 30, 36) & `PcnResultDetailModal.tsx` (lines 71, 117) | Nút đóng header dùng padding `p-1.5` (~30px); nút thao tác footer dùng font `text-[10px]`. | **Mục 4.1.2 & Mục 4.7**: Nút đóng tối thiểu 44px (`min-h-11 min-w-11`), nhãn nút tối thiểu 11-12px, đạt touch target chuẩn accessibility. | **Low** | Nâng kích thước nút đóng header lên `min-h-11 min-w-11` và nút footer lên `min-h-11 text-xs font-black`. |
| `components/ActivityLogView.tsx` (lines 364, 381-386) | Modal xem chi tiết log thiếu focus trap và không lắng nghe phím `Escape` để đóng; nút đóng kích thước `p-2` thiếu target 44px; trên thẻ mobile tất cả loại action đều tô chung màu xanh ngọc (`text-emerald-700`). | **Mục 3.5 & Mục 4.1.2**: Modal nổi chuẩn có phím Escape, bẫy focus, nút đóng 44px; nhật ký phân cấp rõ hành động thêm/sửa/xóa/duyệt. | **Low** | Bổ sung bẫy focus và lắng nghe phím Escape cho modal log chi tiết; phân màu badge action theo tính chất nghiệp vụ (CREATE: xanh lá, UPDATE: lam, DELETE/REJECT: đỏ). |
| `components/PgdcnDossierSummaryGrid.tsx` (lines 341, 355, 368-369) | Nút "Mở hồ sơ" trong cell bảng có kích thước rất nhỏ (`px-2 py-1.5 text-[9px]`); nút phân trang `‹` và `›` thiếu `aria-label`; resizer cột chỉ bắt sự kiện chuột `onMouseDown` mà không hỗ trợ touch drag. | **Mục 4.5 & Mục 4.7**: Bảng lưới chuyên nghiệp, hỗ trợ tương tác cảm ứng, target thao tác rõ ràng, có nhãn accessibility đầy đủ. | **Low** | Tăng kích thước nút "Mở hồ sơ" lên `min-h-8 text-[10px]`; bổ sung `aria-label="Trang trước"` và `aria-label="Trang sau"` cho pagination buttons; hỗ trợ touch event cho resizer. |
| `components/PcnWorkspace.tsx` (line 774) | Các nút trong footer của `PgdcnWindowsWorkflowModal` khi tạo Đề nghị PCN dùng `min-h-10` (~40px). | **Mục 4.1.2**: "target thao tác tối thiểu khoảng 44px." | **Low** | Đổi class của nút "Hủy" và "Tạo Đề nghị & bộ hồ sơ" từ `min-h-10` thành `min-h-11`. |

---

## 3. PHÂN TÍCH CHUYÊN SÂU THEO YÊU CẦU NHIỆM VỤ

### 3.1. Phân hệ PCN (Phòng Chứng nhận)
1. **Request Card & Dossier Card (Mục 3.1 & 3.1.1)**:
   - `PcnDossierGroupCard.tsx` đã có bóng đổ mềm (`shadow-2xs hover:shadow-md`), viền bo góc `rounded-xl`, màu viền hover xanh ngọc `hover:border-emerald-300`.
   - Tuy nhiên, sự phân cấp thông tin (visual hierarchy) cần được tối ưu: Mã Đề nghị không nên dùng badge đen đậm lấn át mã hồ sơ chính; badge số lượng mẫu cần được đưa lên Header card để người dùng nhận diện nhanh quy mô lô hàng ngay từ cái nhìn đầu tiên.
   - Tính toán tiến độ cần bám sát thực tế: không được dùng status enum để gán % ảo (ví dụ gán cứng 45% hay 60%), mà phải lấy từ trường `requiredDocumentPresent / requiredDocumentTotal` hoặc số task hoàn thành trong workflow engine.
2. **Sổ Mẫu Thử & Luồng PYC (Mục 3.6 & 3.6.1)**:
   - Hiện tại `PcnSampleFlowView.tsx` đang là một bảng dữ liệu thông thường với bề rộng 980px. Điều này hoàn toàn đi ngược lại triết lý thiết kế của Mục 3.6 vốn yêu cầu một **Card Flow tuần tự**.
   - Việc hiển thị chặng tuần tự bằng mũi tên nối giữa các phòng thử (1 Hiệu suất → 2 EMC → 3 ATĐ) là điểm đặc trưng sống còn của luồng luân chuyển mẫu PCN. Cần xây dựng component `PcnSampleFlowCard` chuẩn hóa thay thế bảng cồng kềnh hiện tại.
   - Sổ quản lý mẫu dạng cell (`PcnLabOperationsView.tsx`) đã làm rất tốt việc phân tách cell PTN theo màu token riêng (`labTone`) và đối soát ràng buộc cùng khách hàng khi tạo PYC tổng.

### 3.2. Phân hệ PGD (Phòng Giám định)
1. **Dossier Queue Card (Mục 3.1.1)**:
   - Card PGD trong `PgdDossierQueueView.tsx` có bố cục sạch sẽ, thể hiện rõ tiến độ hoàn thiện tài liệu (`requiredDocumentPresent / requiredDocumentTotal`) và số mục còn thiếu kèm icon cảnh báo màu hổ phách/đỏ.
   - Điểm thiếu sót lớn nhất là chưa hỗ trợ **Accordion mở rộng**. Khi giám định viên muốn xem nhanh lô hàng gồm những mẫu nào (mẫu lưu hay gửi PTN), họ buộc phải bấm "Mở hồ sơ" chuyển hẳn sang trang chi tiết thay vì mở xem tại chỗ như quy chuẩn.
   - Thanh Filter Chips Toolbar theo nhóm sản phẩm (Thép, Máy móc, Than) bị thiếu ở đầu trang.
2. **Workflow Modals & Intake (Mục 4.1.2)**:
   - `PgdIntakeForm` lồng trong `PgdcnWindowsWorkflowModal` là một điểm sáng: hỗ trợ kéo thả tệp AI OCR với chế độ xem trước bản nháp và yêu cầu người dùng xác nhận trước khi hydrate vào form; bảng tổng hợp mẫu inline (`PgdIntakeSampleTable.tsx`) cho phép nhập/chọn mẫu catalog linh hoạt, lưu custom label và chặn trùng lặp mã mẫu.

### 3.3. Soạn thảo tài liệu State UI (Mục 4.7)
- Cả hai phân hệ PCN và PGD đều đã áp dụng bộ primitives `PgdcnDraftingPrimitives.tsx` (`DraftingWorkflowOrientation`, `DraftingReadinessPanel`, `DraftingStickyActionBar`, `DraftingContextStatusBar`).
- Bộ state tối thiểu gồm 8 trạng thái (`EMPTY`, `EDITING`, `SAVED`, `GENERATING`, `READY`, `CONFIRMED`, `ATTACHED`, `BLOCKED`, `ERROR`) được biểu diễn nhất quán với màu token tương ứng.
- Điểm cần khắc phục: `PcnOperationalFormModal.tsx` đang có cỡ chữ và kích thước ô nhập quá nhỏ (`text-[10px]`, `min-h-9`), gây khó khăn cho người thao tác trên màn hình cảm ứng hoặc laptop độ phân giải cao.

---

## 4. KẾ HOẠCH & ĐỀ XUẤT KHẮC PHỤC TRƯỚC KHI THỰC THI (ACTION PLAN)

1. **Giai đoạn 1: Chuẩn hóa Card Components PCN & PGD (Mục 3)**
   - Tái cấu trúc `PcnSampleFlowView.tsx` thành Card Flow tuần tự theo đúng layout tại Mục 3.6 (Header Lô/mẫu → Flow chặng nối tiếp → Footer). Sửa KPI đếm theo mẫu.
   - Cập nhật `PcnDossierGroupCard.tsx`: Chuyển tính % tiến độ theo tài liệu thực tế; bổ sung badge KQTN sơ bộ và checklist thiếu vào Accordion; đưa badge số lượng mẫu lên Header.
   - Sử dụng `PcnDossierGroupCard` trong `PcnDossierQueueView.tsx` hoặc bổ sung Accordion; đổi màu nút sang xanh ngọc (Emerald).
   - Bổ sung Accordion mở rộng xem mẫu và thanh Filter Chips Toolbar (`rounded-xl uppercase font-black`) cho `PgdDossierQueueView.tsx`.
2. **Giai đoạn 2: Chuẩn hóa Modal Components & Touch Targets (Mục 4)**
   - Chuẩn hóa typography và touch target cho `PcnOperationalFormModal.tsx`: Tăng chiều cao input lên `min-h-11` (44px), cỡ chữ lên 13-14px.
   - Đồng bộ contract Modal Cài đặt DOCX cho `PcnTemplateSettingsModal.tsx`: Nút đóng 44px, focus-visible ring, các nút hành động đạt tối thiểu 44px.
   - Rà soát nút đóng header và nút footer của `PcnProposalDetailModal`, `PcnResultDetailModal`, `PcnLabRequestDetailModal`, nâng lên chiều cao chuẩn 44px.
   - Thêm focus trap và Escape listener cho modal chi tiết log trong `ActivityLogView.tsx`.
3. **Giai đoạn 3: Kiểm tra hồi quy & Tương tác (Interactive States)**
   - Kiểm tra toàn bộ focus-visible rings khi điều hướng bằng phím `Tab` trên cả PCN và PGD.
   - Kiểm tra trạng thái disabled và loading spinners khi thực hiện mutation (lưu bản soạn, sinh DOCX/PDF, duyệt hồ sơ).
