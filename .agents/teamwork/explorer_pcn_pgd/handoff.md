# HANDOFF REPORT: EXPLORER 2 (PCN & PGD CARDS & MODALS AUDIT)

**Agent ID**: Explorer 2 (teamwork_preview_explorer)  
**Parent Agent ID**: `92df2c9d-db73-4bf8-8a0e-f0ad87a92c30`  
**Working Directory**: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_pcn_pgd`  
**Timestamp**: 2026-09-28T14:55:00Z  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

Rà soát mã nguồn 27 components liên quan Cards, Modals và trạng thái tương tác của hai phân hệ PCN & PGD đối chiếu Mục 3 (Card Components), Mục 4 (Modal Design) và Mục 4.7 (Soạn thảo tài liệu State UI) của `design.md`. Các quan sát trực tiếp từ mã nguồn:

1. **`components/PcnSampleFlowView.tsx` (lines 205-290)**:
   - Dựng bằng thẻ `<table className="w-full text-left border-collapse min-w-[980px]">`.
   - Bắt buộc cuộn ngang trên màn hình thông thường và di động; không có các card nối tiếp nhau bằng mũi tên chặng tuần tự.
   - Line 207: Header KPI hiển thị 4 thẻ đếm theo Lô mẫu:
     ```tsx
     <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
       // Đếm stats.lots, stats.moving, stats.waitingResults, stats.issues (đếm Lô)
     ```
   - Trong khi `design.md` Mục 3.6 quy định: *"Card không bắt đầu bằng số PYC; nó bắt đầu bằng mã lô/mã mẫu và hiển thị tuyến thử như một flow có chặng tuần tự... Khu vực KPI của màn hình đếm theo mẫu: tổng mẫu, mẫu đang ở PTN, mẫu chờ lập PYC, mẫu chờ KQTN, mẫu có sự cố."*

2. **`components/PcnDossierGroupCard.tsx` (lines 105-128, 234-242, 246-298)**:
   - Thanh tiến độ tính bằng hàm:
     ```tsx
     const getProgressPercentage = (status: PcnProposalStatus): number => {
       switch (status) {
         case PcnProposalStatus.DRAFT: return 10;
         case PcnProposalStatus.INTAKE_REVIEW: return 25;
         case PcnProposalStatus.ASSIGNED: return 45;
         ...
     ```
     Đây là tỷ lệ cố định theo enum, không phản ánh tỷ lệ tài liệu thực tế.
   - Vùng Accordion mở rộng (lines 246-298) chỉ lặp danh sách thô `matchingItems` hoặc fallback ra text `proposal.specifications`. Thiếu hoàn toàn trạng thái KQTN sơ bộ (`Chờ KQ / PASS / Cần thử lại`) và danh sách tài liệu bắt buộc còn thiếu cần nạp theo Mục 3.1.1 (Mục 5).
   - Header Card (lines 139-186): Biểu tượng dùng `Layers` nền đen, thiếu Badge số lượng mẫu ở góc phải bên cạnh Badge trạng thái theo Mục 3.1.1 (Mục 1).

3. **`components/PcnOperationalFormModal.tsx` (lines 151, 153-157)**:
   - Các ô nhập dữ liệu sử dụng:
     ```tsx
     className="w-full min-h-9 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] text-slate-800 font-medium..."
     ```
   - Nhãn trường: `text-[9px] font-black uppercase text-slate-400`.
   - Trong khi `design.md` Mục 4.7 quy định: *"Bề mặt dùng chung phải ưu tiên nhãn nghiệp vụ và typography đọc được: nội dung/ô nhập 13–14px, nhãn 12–13px, metadata tối thiểu 11px... control/action đạt target tối thiểu khoảng 44px."*

4. **`components/PcnDossierQueueView.tsx` (lines 142-241) & `components/PgdDossierQueueView.tsx` (lines 144-245)**:
   - `PcnDossierQueueView` tự render Card inline riêng biệt thay vì import `PcnDossierGroupCard`. Bị khuyết Accordion xem danh sách mẫu; nút "Mở hồ sơ" mang màu xanh dương (`bg-blue-700 hover:bg-blue-800`) thay vì màu chuẩn PCN Emerald (`bg-emerald-600`).
   - `PgdDossierQueueView` Card View 2 cột không có Accordion mở rộng để xem mẫu; thiếu thanh Filter Chips Toolbar chuẩn trên đầu danh sách (chỉ có ô search và nút toggle view).

5. **`components/PcnTemplateSettingsModal.tsx` (lines 43, 51, 58, 62)**:
   - Nút đóng header dùng `p-1.5`, nút chọn tệp `px-3 py-2 text-[10px]`, nút đóng footer `px-3 py-2`, tất cả đều nhỏ hơn 44px và thiếu `focus-visible:ring-2 focus-visible:ring-emerald-500` theo hợp đồng modal Mục 4.7.

6. **Các Modal cốt lõi (`PgdcnWindowsWorkflowModal.tsx`, `PcnSampleRequestBundleModal.tsx`)**:
   - Tuân thủ xuất sắc kiến trúc Windows Workflow Modal (Mục 4.1.2) và tạo PYC tổng (Mục 4.1.1): Khóa ngữ cảnh khách hàng, kiểm soát chặng PTN, tách biệt rõ ràng payload tạo bundle.

---

## 2. Logic Chain

1. **Từ Yêu cầu Mục 3.6 → Hiện trạng `PcnSampleFlowView.tsx`**:
   - Yêu cầu Mục 3.6 đặt trọng tâm vào trực quan hóa hành trình luân chuyển mẫu giữa các phòng thử nội bộ theo từng chặng tuần tự (`1 PTN A ──→ 2 PTN B`).
   - Quan sát 1 cho thấy màn hình đang dùng bảng dữ liệu `<table>` rộng tối thiểu 980px, khiến người dùng trên thiết bị di động/màn hình nhỏ buộc phải cuộn ngang và không thấy được sự liên kết trực quan giữa các chặng. Đồng thời KPI đếm lô che lấp số lượng mẫu thực tế đang ở các phòng thử.
   - **Hệ quả**: Giảm năng lực giám sát tiến độ mẫu tại hiện trường và sai lệch chỉ số KPI mẫu thử.

2. **Từ Yêu cầu Mục 3.1.1 → Hiện trạng `PcnDossierGroupCard.tsx` & Queue Views**:
   - Mục 3.1.1 quy định Card Hồ Sơ phải là điểm tóm tắt thông tin hành động nhanh: Nhìn thấy ngay số lượng mẫu, tỷ lệ tài liệu bắt buộc còn thiếu và bấm mở Accordion để xem ngay kết quả thử nghiệm sơ bộ / tài liệu thiếu mà không cần rời màn hình.
   - Quan sát 2 & 4 cho thấy thanh tiến độ hiển thị % ảo (dựa trên status enum 10%, 25%, 45%), Accordion thiếu kết quả thử sơ bộ và tài liệu thiếu, Queue View tự render lại markup thiếu Accordion và sai màu nhận diện thương hiệu (dùng màu Blue của PGD cho phân hệ PCN).
   - **Hệ quả**: Người dùng không nắm được hồ sơ đang thiếu giấy tờ gì nếu không mở trang chi tiết, làm chậm tốc độ xử lý hồ sơ.

3. **Từ Yêu cầu Mục 4.7 → Hiện trạng `PcnOperationalFormModal.tsx` & Settings Modals**:
   - Mục 4.7 đặt ra quy chuẩn bắt buộc về Ergonomics & Accessibility trong bối cảnh soạn thảo nghiệp vụ: font chữ nội dung 13-14px, nhãn 12-13px, vùng chạm tối thiểu 44px (`min-h-11`).
   - Quan sát 3 & 5 cho thấy các ô nhập liệu dùng `text-[10px]` và chiều cao 36px (`min-h-9`), các nút đóng modal dùng `p-1.5` (~30px) và thiếu focus ring.
   - **Hệ quả**: Khó đọc trên màn hình độ phân giải cao và khó thao tác trên thiết bị cảm ứng hoặc khi dùng bàn phím chuyên dụng.

---

## 3. Caveats

1. **Phạm vi Legacy DDT**: Trong yêu cầu ban đầu có nhắc đến `RequestModal`, `TestExecutionModal`, `HandoverModal`. Theo tài liệu kiến trúc và kế hoạch `docs/superpowers/plans/2026-09-08-remove-ddt-legacy-runtime.md`, các component DDT cũ đã được loại bỏ hoàn toàn khỏi runtime. Việc rà soát đã được định tuyến chính xác sang các component thay thế trực tiếp thuộc kiến trúc PGDCN (`PgdcnWindowsWorkflowModal`, `PcnSampleRequestBundleModal`, `PcnProposalDetailModal`, `PcnResultDetailModal`, `PcnSampleHandoverModal`).
2. **Không can thiệp mã nguồn**: Rà soát tuân thủ nguyên tắc READ-ONLY theo chỉ thị. Các đề xuất sửa đổi chưa được áp dụng trực tiếp vào mã nguồn mà được lập kế hoạch chi tiết trong `audit_findings.md`.
3. **Phạm vi phân hệ khác**: Khảo sát tập trung độc quyền vào phân hệ PCN & PGD (Cards, Modals, Interactivity); không bao quát các phân hệ chung (Admin, Master Data, RBAC).

---

## 4. Conclusion

1. **Mức độ sẵn sàng tổng thể**: Phân hệ PCN & PGD đã có khung kiến trúc vững chắc, đặc biệt là các workflow modal chính (`PgdcnWindowsWorkflowModal`, `PcnSampleRequestBundleModal`) và bộ primitive soạn thảo (`PgdcnDraftingPrimitives.tsx`) đáp ứng tốt yêu cầu nghiệp vụ phức tạp.
2. **Các điểm nghẽn kỹ thuật cần xử lý**:
   - **Ưu tiên 1 (High - 3 điểm)**:
     - Tái cấu trúc `PcnSampleFlowView.tsx` từ Bảng dữ liệu 980px sang Card Flow tuần tự theo Mục 3.6; sửa KPI đếm theo mẫu.
     - Sửa logic % tiến độ và bổ sung kết quả sơ bộ + danh mục tài liệu thiếu vào Accordion của `PcnDossierGroupCard.tsx`.
     - Nâng cấp typography và kích thước ô nhập của `PcnOperationalFormModal.tsx` đạt chuẩn Mục 4.7 (`min-h-11`, font 13-14px).
   - **Ưu tiên 2 (Medium - 7 điểm)**:
     - Dùng trực tiếp `PcnDossierGroupCard` trong `PcnDossierQueueView.tsx`, đổi màu nút mở hồ sơ sang Emerald.
     - Bổ sung Accordion và thanh Filter Chips Toolbar chuẩn cho `PgdDossierQueueView.tsx`.
     - Chuẩn hóa touch target 44px và focus-visible ring cho `PcnTemplateSettingsModal.tsx` và `PgdSampleOperationsView.tsx`.
   - **Ưu tiên 3 (Low - 4 điểm)**:
     - Chuẩn hóa nút đóng và nút footer của các modal phụ (`PcnProposalDetailModal`, `PcnResultDetailModal`, `ActivityLogView`).
3. **Tài liệu tham chiếu hoàn chỉnh**: Toàn bộ 16 phát hiện chi tiết kèm trích dẫn dòng code, chuẩn spec và giải pháp khắc phục đã được lưu tại:
   `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_pcn_pgd\audit_findings.md`.

---

## 5. Verification Method

Để kiểm chứng độc lập các phát hiện và đánh giá trong báo cáo:

1. **Kiểm tra trực quan mã nguồn vi phạm**:
   - Xem `PcnSampleFlowView.tsx` dòng 205-290: Xác nhận cấu trúc thẻ `<table className="... min-w-[980px]">` và KPI đếm theo lô `stats.lots`.
   - Xem `PcnDossierGroupCard.tsx` dòng 105-128: Xác nhận hàm `getProgressPercentage` trả về % tĩnh theo enum status.
   - Xem `PcnOperationalFormModal.tsx` dòng 151, 153-157: Xác nhận class `min-h-9 text-[10px]` của ô nhập liệu và `text-[9px]` của nhãn.
   - Xem `PcnDossierQueueView.tsx` dòng 202: Xác nhận nút mang class `bg-blue-700`.
   - Xem `PcnTemplateSettingsModal.tsx` dòng 43, 58: Xác nhận nút đóng `p-1.5` thiếu `focus-visible:ring`.

2. **Kiểm tra tính toàn vẹn Typecheck của dự án**:
   - Chạy lệnh kiểm tra TypeScript trong terminal:
     ```powershell
     npm run typecheck
     # hoặc
     npx tsc --noEmit
     ```
   - Đảm bảo việc đọc soát mã nguồn không tạo ra bất kỳ side-effect hay lỗi biên dịch nào.
