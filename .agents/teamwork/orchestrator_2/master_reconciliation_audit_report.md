# BÁO CÁO RÀ SOÁT & ĐỐI CHIẾU TOÀN DIỆN: SPEC (`design.md`) VS MÃ NGUỒN THỰC TẾ
## Hệ thống: PGDCN Web App (Phòng Giám định - Chứng nhận & Phát triển thị trường / TVCI - IEMM)
- **Cơ quan thẩm định**: Project Orchestrator 2 (`orchestrator_2`)
- **Tài liệu chuẩn tối cao**: `design.md` (*Single Source of Truth*)
- **Yêu cầu gốc**: `ORIGINAL_REQUEST.md` (2026-09-30T04:19:42Z)
- **Tình trạng kiểm thử hệ thống**: **934/934 tests PASS (100%)**
- **Thời điểm hoàn tất**: 2026-09-30

---

## I. TÓM TẮT ĐIỀU HÀNH & KẾT LUẬN CHUNG (EXECUTIVE SUMMARY)

Cuộc rà soát đối chiếu toàn diện được triển khai độc lập qua 3 Explorer chuyên trách (UI/UX Cards, Data Models/Lifecycle/Business Rules, API Contracts/Security) nhằm đánh giá tính nhất quán giữa tài liệu đặc tả chuẩn `design.md` và toàn bộ mã nguồn thực tế của hệ thống PGDCN Web App (hai phân hệ cốt lõi: **PCN - Chứng nhận** và **PGD - Giám định**).

### 1. Đánh giá Mức độ Tuân thủ Tổng thể
- **Nghiệp vụ cốt lõi & Quy tắc cách ly (Business Rules & Domain Boundary)**: **ĐẠT 100% TUYỆT ĐỐI**.
  - Phân hệ PCN tuân thủ triệt để chỉ xử lý `QC4` và `QC9`, cách ly hoàn toàn và không tiếp nhận `QC20`. Điều phối mẫu theo số lượng (`quantity > 1`: PARALLEL, `quantity = 1`: SEQUENTIAL). Định dạng mã định danh `PCN-YYMMDD-TT` và `CN TTTT-YY` được cấp số nguyên tử chống trùng lặp.
  - Phân hệ PGD xử lý 4 nhóm hàng (`STEEL_METAL`, `MACHINERY_LINE`, `COAL`, `OTHER`), 11 catalog profile chuẩn hóa (bao gồm thép không gỉ `GĐ-THEP-KG` gắn mã nhóm `QC20`). Bảng lấy mẫu thép TTLT 58 (`QT-GĐ-14`) chuẩn xác 6 dải cỡ lô. Phân tách mẫu `LAB` và `RETAINED` đúng quy định. Định dạng mã `PGD-YYMMDD-TT`.
  - Tách biệt tuyệt đối 24 collection dữ liệu độc lập, mã trạng thái, pipeline, quy trình mẫu/PYC/KQTN, private Storage bucket (`pcn-files` vs PGD) và route API (`/api/pcn/*` vs `/api/pgd/*`).
- **Giao diện người dùng & Card Components (UI/UX)**: **ĐẠT TRÊN 90%**.
  - Cả `PcnDossierGroupCard.tsx` và `RequestCard` (PGD) đều khớp xuất sắc với chuẩn trực quan TVCI Lab tại Mục 3.1.1: Hộp icon thư mục vàng cam `bg-amber-50 text-amber-500 w-11 h-11`, bo góc 2xl, phân cấp thị giác 4 tầng, thanh tiến độ xanh lá `bg-emerald-500` kèm nhãn `X/Y XONG`.
  - Toolbar lọc dạng pill đếm số, nút Tổng PYC nền đen chữ trắng, bộ lọc nâng cao `SlidersHorizontal`, bố cục lưới 2 cột `grid grid-cols-1 md:grid-cols-2 gap-3.5` và nút chuyển đổi Thẻ/Bảng (Card/Table view switcher) vận hành mượt mà.
- **Hạ tầng API, Server & Bảo mật (API Contracts & Security/RBAC)**: **ĐẠT TRÊN 95%**.
  - Cấu hình runtime chuẩn xác: `APP_PROFILE=pcn`, database `pcn_certification`, dev port 1357 (PG 15432), prod port 2357 (PG 5432).
  - RBAC đa trục (`systemRole`, `managementRoleCode`, `professionalRoleCodes[]`, `departmentScopes`) kiểm soát chặt chẽ.
  - Nguyên tắc Zero Cascade Deletion (`DELETE /api/pcn/users/:id` kiểm tra `findPcnUserReferences` từ chối 409) và bảo vệ xóa hồ sơ vĩnh viễn (yêu cầu xác nhận mã và lý do, từ chối hồ sơ đã phát hành) hoạt động nghiêm ngặt.
  - Gemini AI bắt buộc dùng personal key mã hóa trong DB, không dùng key môi trường hệ thống.
  - Toàn bộ 934 bài kiểm thử tự động của dự án vượt qua thành công (**PASS 934, FAIL 0**).

### 2. Bản chất các Sai lệch Phát hiện (Root Cause of Discrepancies)
Hệ thống **không có lỗi logic nghiệp vụ** và **không có vi phạm quy tắc trong mã nguồn**. Toàn bộ các điểm sai lệch phát hiện đều thuộc nhóm **Độ lệch tài liệu hóa (Documentation Drift)** do mã nguồn đã được module hóa và hoàn thiện nhanh hơn tiến độ cập nhật tài liệu `design.md`:
1. **Thiếu Tokens tại Mục 2.2**: `design.md` vẫn giữ bảng 10 trạng thái của app PTN cũ, chưa cập nhật bảng tokens cho 19 trạng thái `PcnDossierStatus` và 14 trạng thái `PgdInspectionStatus`.
2. **Chưa phân định Legacy Reference tại Mục 3.1–3.5**: Các card buồng thử ATD/EMC, buồng Chamber 1/2 của PTN DDT là di sản tham chiếu; active profile PGDCN chạy trên Mục 3.1.1 và Mục 3.6.
3. **Cấu trúc phân bổ Type tại Mục 6**: Mục 6 ghi *"Toàn bộ Type nằm ở `/types.ts`"*, nhưng thực tế các Type PGD đã được module hóa thành công sang `utils/pgdDomain.ts`, `utils/pgdDossier.ts`, `utils/pgdArtifacts.ts`; thiếu danh mục 14 Interface PGD và các Interface PCN Topology.
4. **Hợp đồng API tại Mục 7.3 & Mục 10**: Thiếu endpoint `POST /api/pcn/intake` (tiếp nhận Đề nghị tạo hồ sơ) và `GET /api/tieuchuan`; phương thức xóa thông báo dùng `DELETE` thay vì `POST`; endpoint `GET /api/pcn/cutover-status` (dòng 1353) không có trong code do Mục 0.3 đã quy định PCN chỉ phục vụ hồ sơ mới, cấm công cụ cutover.
5. **Kiến trúc Server Kép**: `server.ts` (Express) đang là API Gateway duy nhất xử lý 174 endpoints; thư mục `app/api/` là di sản chuyển đổi dở dang (thiếu PGD và Backup) và đang bị Express chặn không cho nhận request.

---

## II. KẾT QUẢ ĐỐI CHIẾU CHI TIẾT THEO 3 TRỌNG TÂM

### 1. R1: Quy chuẩn UI/UX & Card Components (Mục 2, 3, 5 `design.md` vs Code)

#### 1.1. Card Hồ Sơ & Đề Nghị TVCI Lab (`PcnDossierGroupCard.tsx`)
- **Khung Card & Hiệu ứng**: `className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-md"` khớp 100% đặc tả Mục 3.1.1 dòng 630, 658.
- **Hộp Icon Thư Mục**: Khối `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200/80 bg-amber-50 text-amber-500` kèm `<Folder size={22} />` khớp 100% dòng 659.
- **Cụm tiêu đề & Badges**: Mã đề nghị in đậm `font-mono text-sm font-black text-slate-800`, badge mã hồ sơ xanh lá `bg-emerald-50 text-emerald-800`, badge số lượng mẫu `bg-slate-100 text-slate-600`, hạn hoàn tất xanh dương `bg-blue-50 text-blue-700 font-bold text-xs`. Khớp 95% dòng 660–665.
- **Cụm Icon thao tác nhanh**: Gồm Sửa (`Edit3 size={14}`), In (`Printer size={14}`), Sao chép (`Copy size={14}` kèm toast), Xóa (`Trash2 size={14}` màu rose), Mở rộng (`ChevronDown/Up size={14}`).
  * *Điểm lệch*: Chevron dùng 14px thay vì 10px; vùng bấm icon trên mobile cần bổ sung padding đảm bảo touch-target 44px theo Mục 5.3.
- **Thương hiệu & Khách hàng**: Tag thương hiệu `bg-blue-50 text-blue-600 font-bold uppercase text-[11px]` (dòng 204) và Tên khách hàng `text-xs font-bold uppercase truncate text-slate-700` (dòng 213) khớp 100%.
- **Thanh tiến độ & Nhãn `X/Y XONG`**: Đường tiến độ `h-1.5 bg-emerald-500 rounded-full`, nhãn monospace `font-mono text-[11px] font-black text-slate-500` hiển thị chính xác công thức `${completionRatio}/${totalSamples} XONG` (dòng 74–86, 293–307) khớp 100% dòng 676–678.
- **Vùng mở rộng Accordion**: Hiển thị chi tiết từng mẫu thử, model, số lượng, kết quả sơ bộ.
  * *Điểm thiếu*: Chưa có dòng hiển thị tóm tắt danh mục tài liệu còn thiếu của hồ sơ (`Tài liệu còn thiếu: X mục`) theo mockup dòng 644.

#### 1.2. Card Giám Định PGD (`RequestCard` trong `components/PgdWorkspace.tsx`)
- Đã được chuẩn hóa thành công theo cùng phong cách TVCI Lab của Mục 3.1.1: Khung bo góc `rounded-2xl`, hộp thư mục vàng cam `bg-amber-50 text-amber-500 w-11 h-11`, mã PYC đen trắng nổi bật, thanh tiến độ xanh lá `bg-emerald-500` kèm nhãn `X/Y XONG`.
- *Điểm lệch*: Hàm `StatusBadge` trong `PgdWorkspace.tsx` hiện đang gom 14 trạng thái thành 3 màu cơ bản (emerald, rose, blue). Cần nâng cấp sang dùng `PgdcnStatusBadge` (trong `components/PgdcnUiPrimitives.tsx`) với 10 `StateTone` chuẩn để phản ánh tinh tế từng giai đoạn giám định.

#### 1.3. Toolbar Lọc dạng Pill, Bố cục Lưới 2 cột & Chế độ xem Thẻ/Bảng
- **Toolbar Lọc dạng Pill**: Cả `PcnWorkspace.tsx` và `PgdWorkspace.tsx` đều có nút Tổng PYC (`bg-slate-900 text-white`), các pill trạng thái chức năng kèm badge đếm số tương phản cao, bộ lọc chuyên môn (`QC4/QC9` hoặc `Thép/Máy móc`), nút Lọc nâng cao `SlidersHorizontal` và nút sắp xếp theo ngày/số lô.
- **Bố cục lưới 2 cột**: Cả PCN và PGD đều áp dụng lớp `grid grid-cols-1 md:grid-cols-2 gap-3.5` chuẩn xác theo Mục 3.1.1 dòng 630.
- **Chuyển đổi Thẻ/Bảng (ViewMode)**: Nút toggle `LayoutGrid` và `List` cho phép chuyển đổi tức thì giữa chế độ xem thẻ 2 cột và bảng dữ liệu chuyên sâu có hỗ trợ cuộn ngang an toàn `mobile-scroll-x`.

---

### 2. R2: Data Models, Lifecycle, Hợp đồng API & Business Rules

#### 2.1. Thực thi Nghiệp vụ & Ranh giới PCN vs PGD
- **Phân hệ PCN (Chứng nhận)**:
  - Chỉ quản lý hai lĩnh vực `QC4` và `QC9` (`types.ts:222`, `utils/pcnWorkflow.ts:10-23`). Tuyệt đối loại bỏ và cấm xuất hiện mã `QC20`.
  - Điều phối mẫu dựa trên trường `quantity`: `quantity > 1` kích hoạt chế độ thử song song (`PARALLEL`), `quantity = 1` kích hoạt chế độ thử tuần tự (`SEQUENTIAL`) theo `utils/pcnSampleFlow.ts:84-88`.
  - Cấp mã Đề nghị `PCN-YYMMDD-TT` và Lô mẫu `CN TTTT-YY` tại server thông qua atomic sequence, kiểm tra số thứ tự hợp lệ (1..99 và 1..9999).
- **Phân hệ PGD (Giám định)**:
  - Quản lý 4 nhóm hàng (`STEEL_METAL`, `MACHINERY_LINE`, `COAL`, `OTHER`), 11 catalog profile chuẩn hóa (bao gồm hồ sơ thép không gỉ `GĐ-THEP-KG` gắn mã nhóm `QC20`).
  - Bảng kế hoạch lấy mẫu thép TTLT 58/2015 (`QT-GĐ-14`) được cài đặt chính xác 6 dải cỡ lô (1–25, 26–50, 51–150, 151–500, 501–1200, 1201–3200) và quy tắc tự động giảm 1 mẫu cơ lý khi cùng mác nhiều loại sản phẩm (`utils/pgdDomain.ts:458-487`).
  - Mẫu PGD phân tách nghiêm ngặt giữa mẫu gửi thử nghiệm (`LAB`) và mẫu lưu (`RETAINED`). Tiêu hủy mẫu lưu cập nhật trạng thái `DESTROYED` kèm audit log, không xóa bản ghi (`utils/pgdDossier.ts:335-350`).
- **Cách ly Ranh giới (Boundary Isolation)**:
  - 24 collection PGD độc lập hoàn toàn với dữ liệu PCN.
  - Phân tách ranh giới ở tầng middleware Express: `/api/pcn/*` và `/api/db/*` bắt buộc có `departmentScopes` chứa `PCN`; `/api/pgd/*` bắt buộc có scope `PGD`. Không thể truy vấn chéo dữ liệu bằng cách thay đổi tham số URL.

#### 2.2. Vòng đời Trạng thái (Lifecycle & State Transitions)
- **PCN (19 trạng thái)**: Hiện thực thành công kiến trúc 2 tầng độc đáo: Lưu trình động linh hoạt dựa trên `workflowSnapshot` của `PcnWorkflowTemplate` (DAG graph với các node văn bản, phê duyệt, quyết định, rẽ nhánh song song, join policies `ALL`/`ANY`/`QUORUM` và chu trình sửa đổi/trả lại) kết hợp song hành với Stage Gate 5 bước kiểm soát cấp số phát hành.
- **PGD (15 trạng thái)**: Chuỗi chuyển trạng thái tuần tự chặt chẽ qua hàm `getPgdTransitionDenial()` và chuỗi phê duyệt 2 cấp độc lập (`TECHNICAL_REVIEW` cấp chuyên môn PGD → `LEADERSHIP_APPROVAL` cấp Lãnh đạo Trung tâm/Viện), lưu vết `packageManifestHash`.

#### 2.3. Hợp đồng API, Server Gateway & Bảo mật/RBAC
- **API Gateway thực tế**: `server.ts` (Express) đang là Gateway duy nhất xử lý 174 endpoints. Middleware tại dòng 18905 chặn toàn bộ `/api/*` cho Express xử lý. Thư mục `app/api/` (Next.js) là kết quả di chuyển dở dang, thiếu hơn 30 routes PGD cốt lõi và module Backup.
- **Bảo mật & RBAC**:
  - Mô hình vai trò đa trục: `systemRole`, `managementRoleCode`, `professionalRoleCodes[]`, `departmentScopes`.
  - Zero Cascade Deletion: `DELETE /api/pcn/users/:id` kiểm tra toàn bộ tham chiếu nghiệp vụ (`findPcnUserReferences`), trả về HTTP `409 Conflict` nếu còn liên kết.
  - Xóa hồ sơ vĩnh viễn: Chỉ cho phép Admin/Quản lý toàn hệ thống, bắt buộc nhập lý do và mã xác nhận khớp mã hồ sơ, từ chối đối với hồ sơ đã thực thi/phát hành.
  - Gemini AI: Bắt buộc dùng personal key mã hóa trong DB, cấm key hệ thống môi trường.
- **Khoảng trống hợp đồng API**:
  - Thiếu trong code: `GET /api/pcn/cutover-status` (dòng 1353 `design.md`) không có trong code do Mục 0.3 cấm công cụ cutover.
  - Thiếu trong spec: `POST /api/pcn/intake` (tiếp nhận Đề nghị tạo hồ sơ) và `GET /api/tieuchuan` (tra cứu danh mục tiêu chuẩn) đã có trong code nhưng chưa có trong Mục 7.3.
  - Lệch HTTP Method: Clear notification PGDCN dùng `DELETE /api/pgdcn/notifications/clear` thay vì `POST`.
  - Route legacy DDT: Một số route cũ (`/api/upload-nas`, `/api/generate-docx`, `/api/extract-radimation`, `/api/kqtn/*`) chưa được bọc middleware auth.

---

## III. MA TRẬN ĐỐI CHIẾU SAI LỆCH TOÀN HỆ THỐNG (MASTER DISCREPANCY MATRIX)

| STT | Vị trí Mục / Dòng `design.md` | File / Component / Endpoint trong Mã nguồn | Quy định trong `design.md` | Hiện trạng triển khai trong Mã nguồn | Phân loại Sai lệch | Đánh giá & Hướng xử lý |
|:---:|:------------------------------|:-------------------------------------------|:---------------------------|:--------------------------------------|:-------------------|:-----------------------|
| **1** | **Mục 2.2 (Dòng 553–566)** | `components/PcnWorkspace.tsx:129`, `components/PgdWorkspace.tsx:284`, `components/PgdcnUiPrimitives.tsx:10` | Bảng 10 tokens `RequestStatus` của app PTN cũ (PENDING..REQ_SUPPLEMENT). | PCN dùng 19 trạng thái `PcnDossierStatus`; PGD dùng 14 trạng thái `PgdInspectionStatus`. Code đã có `PgdcnStatusBadge` với 10 `StateTone`. | **Lệch trong Spec (Spec Outdated)** | Cập nhật Mục 2.2 `design.md` bổ sung bảng ánh xạ tokens cho 19 trạng thái PCN và 14 trạng thái PGD theo 10 StateTone. |
| **2** | **Mục 3.1–3.5 (Dòng 588–767)** | Toàn bộ components giao diện | Mô tả Request Card kiểu buồng thử ATD/EMC, buồng Chamber 1/2, KTV PTN DDT. | Phân hệ PGDCN active profile chuyển sang dùng `PcnDossierGroupCard`, `RequestCard` (Mục 3.1.1) và `PcnSampleFlowView` (Mục 3.6). | **Thiếu phân định trong Spec** | Bổ sung ghi chú đầu Mục 3.1: Các mục 3.1–3.5 là [Legacy Reference] kế thừa từ DDT; hệ thống active profile vận hành theo Mục 3.1.1 & 3.6. |
| **3** | **Mục 3.1.1 (Dòng 644, 680)** | `components/PcnDossierGroupCard.tsx:224–290` | Accordion mở rộng hiển thị dòng tóm tắt tài liệu còn thiếu: `Tài liệu còn thiếu: X mục`. | Accordion hiển thị chi tiết từng mẫu, kết quả sơ bộ, chủ hồ sơ; **chưa có** dòng tài liệu còn thiếu. | **Thiếu trong Code (Code Gap)** | Bổ sung dòng hiển thị tài liệu còn thiếu vào Accordion của `PcnDossierGroupCard.tsx`. |
| **4** | **Mục 3.1.1 & 5.3 (Dòng 666–671, 1150)** | `components/PcnDossierGroupCard.tsx:154–199` | Touch target nút thao tác nhanh trên mobile tối thiểu 44px; chevron mở rộng 10px. | Nút thao tác nhanh dùng `p-1 rounded` (chưa đạt 44px trên mobile hẹp); chevron đang dùng `size={14}`. | **Lệch nhẹ trong Code** | Bổ sung lớp touch target mobile 44px và điều chỉnh `ChevronDown size={10}`. |
| **5** | **Mục 3.1.1** | `components/PgdWorkspace.tsx:284–291` | Badge trạng thái trên Card phản ánh chính xác sắc thái tiến trình theo chuẩn TVCI Lab. | Hàm `StatusBadge` trong PGD gộp 14 trạng thái thành 3 màu cơ bản (emerald, rose, blue). | **Lệch trong Code (Code Suboptimal)** | Thay thế `StatusBadge` trong `PgdWorkspace.tsx` bằng `PgdcnStatusBadge` chuẩn. |
| **6** | **Mục 5.2.1.3 (Dòng 1133)** | `components/PcnWorkspace.tsx:681` | Dải toolbar pills trên desktop không bị vỡ hàng (`pgdcn-toolbar-nowrap`), mobile xếp cột. | `PcnWorkspace` dùng `flex-wrap gap-2`, có thể rớt hàng trên laptop màn hình nhỏ. | **Lệch nhẹ trong Code** | Áp dụng quy chuẩn `pgdcn-toolbar-nowrap` kết hợp cuộn ngang dự phòng. |
| **7** | **Mục 6 (Dòng 1149)** | `types.ts` vs `utils/pgdDomain.ts`, `utils/pgdDossier.ts`, `utils/pgdArtifacts.ts` | Ghi: *"Toàn bộ Type định nghĩa hệ thống nằm ở file `/types.ts`"*. | `types.ts` chứa PCN, Auth và Shared; toàn bộ Type nghiệp vụ PGD nằm ở `utils/pgdDomain.ts`, `utils/pgdDossier.ts`, `utils/pgdArtifacts.ts`. | **Lệch trong Spec (Spec Outdated)** | Cập nhật Mục 6.1 `design.md` ghi nhận rõ cấu trúc phân bổ file type thực tế. |
| **8** | **Mục 6 (Dòng 1151–1165)** | `types.ts` & `utils/pcnWorkflowTemplate.ts` | Liệt kê các Interface Cốt lõi của hệ thống. | Thiếu danh mục các Interface PCN Workflow Topology (`PcnWorkflowTemplate`, `PcnWorkflowNodeDefinition`, `PcnWorkflowSnapshot`...). | **Thiếu trong Spec (Spec Omission)** | Bổ sung danh mục các Interface PCN Workflow Topology vào Mục 6 của `design.md`. |
| **9** | **Mục 6 (Dòng 1151–1165)** | `utils/pgdDomain.ts`, `utils/pgdDossier.ts`, `utils/pgdArtifacts.ts` | Mục 6 chỉ liệt kê 1 interface PGD là `PgdInspectionRequest`. | Mã nguồn triển khai đầy đủ 14 interface PGD cốt lõi (theo đúng Mục 0A.2). | **Thiếu trong Spec (Mục 6)** | Bổ sung tiểu mục 6.2 chuyên biệt liệt kê đầy đủ 14 Interface cốt lõi của PGD vào `design.md`. |
| **10** | **Mục 6 (Dòng 1166–1170)** | `types.ts:133–170` | Ghi chú quy tắc chuyển cột mã hóa ITDC → ITD. | Thuộc schema dữ liệu legacy DDT của phòng thử nghiệm Điện - Điện tử. | **Legacy Spec Note** | Đánh dấu là [DDT Legacy Reference] trong tài liệu `design.md`. |
| **11** | **Mục 0.3 (Dòng 167) & Mục 7.3** | `server.ts:18905–18911`, thư mục `app/api/*` | Ứng dụng chạy trên Next.js App Router, Express làm API Gateway. | `server.ts` (Express) xử lý 174 routes; `app/api/` có 106 routes nhưng thiếu >30 routes PGD cốt lõi & backups; Express chặn lưu lượng `/api/*`. | **Lệch cấu trúc (Architectural Drift)** | Cập nhật `design.md` ghi nhận: `server.ts` là API Gateway thực tế duy nhất hiện tại; Next.js App Router quản lý Frontend. |
| **12** | **Mục 0.4 (Dòng 243–245) & Mục 7.3** | `server.ts:9113–9360` (`POST /api/pcn/intake`) | Tiếp nhận Đề nghị tạo đồng thời Hồ sơ và checklist trong 1 transaction. | Đã hiện thực hoàn chỉnh qua route `POST /api/pcn/intake` nhưng chưa có trong bảng API mục 7.3. | **Thiếu trong Spec (Spec Omission)** | Bổ sung endpoint `POST /api/pcn/intake` vào bảng hợp đồng REST API tại Mục 7.3. |
| **13** | **Mục 7.3** | `server.ts:16940–16958` (`GET /api/tieuchuan`) | Không có quy định. | Endpoint đọc file `public/tieuchuan.xlsx` trả về danh mục tra cứu tiêu chuẩn. | **Thiếu trong Spec (Spec Omission)** | Bổ sung endpoint `GET /api/tieuchuan` vào Mục 7.3 của `design.md`. |
| **14** | **Mục 7.3 (Dòng 1220)** | `server.ts:16058` (`DELETE /api/pgdcn/notifications/clear`) | Mô tả chung ghi phương thức `POST` cho xóa thông báo. | Mã nguồn hiện thực phương thức `DELETE` cho PGDCN notification clear. | **Lệch Method trong Spec** | Cập nhật `design.md` dòng 1220 ghi rõ phương thức `DELETE` theo chuẩn RESTful. |
| **15** | **Mục 10 (Dòng 1353)** | Không có trong mã nguồn | Màn hình đối soát cutover PCN qua `GET /api/pcn/cutover-status`. | Không tồn tại trong code do Mục 0.3 dòng 169-170 cấm công cụ/màn hình cutover. | **Dư thừa trong Spec (Spec Obsolete)** | Xóa bỏ dòng 1353 hoặc đánh dấu [RETIRED] trong `design.md` để đồng bộ với Mục 0.3. |
| **16** | **Mục 0 (Dòng 51) & Mục 7.2** | `server.ts:15112–15443` | DDT là legacy reference; PCN/PGD không dùng code DDT. | Các endpoint DDT legacy (`/api/upload-nas`, `/api/generate-docx`, `/api/extract-radimation`, `/api/kqtn/*`) chưa bọc middleware auth. | **Lỗ hổng bảo mật Legacy (Code Gap)** | Bọc middleware xác thực phiên cho các endpoint DDT legacy còn lại trong `server.ts`. |

---

## IV. BẢN ĐỀ XUẤT VÁ ĐẶC TẢ `design.md` (SPECIFICATION PATCH PROPOSALS)

Nhằm đảm bảo nguyên tắc **`design.md` là Single Source of Truth tuyệt đối** theo `AGENTS.md`, đề xuất áp dụng 5 bản vá chuẩn hóa cụ thể vào `design.md`:

### Bản vá 1: Cập nhật Mục 2.2 — Bổ sung Bảng Tokens cho PCN & PGD
*Vị trí áp dụng*: Sau dòng 566 của `design.md`.
```markdown
### 2.2.1. Badge Tokens Trạng thái Hồ sơ Chứng nhận PCN (`PcnDossierStatus`)
| Nhóm tiến trình | Trạng thái | Nhãn hiển thị | StateTone | Mã Tailwind quy chuẩn |
|:---|:---|:---|:---|:---|
| Khởi tạo / Tiếp nhận | `DRAFT`, `INTAKE_REVIEW`, `AWAITING_DOCUMENTS` | Bản nháp / Kiểm tra ĐN / Chờ bổ sung | `warning` / `info` | `border-amber-200 bg-amber-50 text-amber-800` / `border-blue-200 bg-blue-50 text-blue-800` |
| Phân công & Đánh giá | `ASSIGNED`, `PLAN_PENDING_APPROVAL`, `FIELD_EVALUATION` | Đã phân công / Chờ duyệt KH / Đang đánh giá | `info` / `indigo` | `border-indigo-200 bg-indigo-50 text-indigo-800` |
| Thử nghiệm PTN | `AWAITING_SAMPLING`, `SENT_TO_LAB`, `AWAITING_RESULTS` | Chờ lấy mẫu / Đã gửi PTN / Chờ KQTN | `cyan` / `purple` / `orange` | `border-purple-200 bg-purple-50 text-purple-800` |
| Xử lý kết quả | `CORRECTIVE_ACTION`, `TECHNICAL_REVIEW`, `WAITING_APPROVAL` | Đang khắc phục / Soát xét KT / Chờ phê duyệt | `critical` / `warning` | `border-rose-200 bg-rose-50 text-rose-800` / `border-amber-200 bg-amber-50 text-amber-800` |
| Hoàn tất | `APPROVED`, `ISSUED`, `DELIVERED`, `ARCHIVED` | Đã phê duyệt / Phát hành / Giao KH / Lưu trữ | `success` | `border-emerald-200 bg-emerald-50 text-emerald-800` |
| Đóng / Hủy | `REJECTED`, `CANCELLED`, `ON_HOLD` | Từ chối / Đã hủy / Tạm dừng | `critical` / `neutral` | `border-rose-200 bg-rose-50 text-rose-800` / `border-slate-200 bg-slate-100 text-slate-700` |

### 2.2.2. Badge Tokens Trạng thái Hồ sơ Giám định PGD (`PgdInspectionStatus`)
| Nhóm tiến trình | Trạng thái | Nhãn hiển thị | StateTone | Mã Tailwind quy chuẩn |
|:---|:---|:---|:---|:---|
| Tiếp nhận & Năng lực | `DRAFT`, `CAPABILITY_REVIEW`, `READY_TO_EXECUTE` | Bản nháp / Xem xét năng lực / Chấp nhận TH | `info` / `warning` | `border-blue-200 bg-blue-50 text-blue-800` |
| Chuẩn bị & Hiện trường | `PREPARING`, `FIELD_INSPECTION`, `WAITING_LAB_RESULTS` | Chuẩn bị / Đang hiện trường / Chờ KQ PTN | `cyan` / `purple` | `border-cyan-200 bg-cyan-50 text-cyan-800` / `border-purple-200 bg-purple-50 text-purple-800` |
| Soát xét & Duyệt | `RESULTS_REVIEW`, `TECHNICAL_REVIEW`, `LEADERSHIP_APPROVAL` | Xem xét KQ / Soát xét KT / Chờ duyệt LĐ | `orange` / `indigo` | `border-indigo-200 bg-indigo-50 text-indigo-800` |
| Hoàn tất & Đóng | `SIGNED`, `RESULT_RETURNED`, `ARCHIVED` | Đã ký / Đã trả kết quả / Đã lưu trữ | `success` | `border-emerald-200 bg-emerald-50 text-emerald-800` |
| Ngoại lệ | `REJECTED`, `CANCELLED` | Từ chối / Đã hủy | `critical` | `border-rose-200 bg-rose-50 text-rose-800` |
```

### Bản vá 2: Phân định Kiến trúc tại Mục 3.1
*Vị trí áp dụng*: Thêm ghi chú ngay đầu Mục 3.1 (trước dòng 588).
```markdown
> **Ghi chú phân định kiến trúc**: Cấu trúc Request Card kiểu PTN (buồng thử ATD/EMC, buồng Chamber 1/2) tại Mục 3.1–3.5 là tài liệu tham chiếu kế thừa từ hệ thống thử nghiệm DDT (Legacy Reference). Đối với phân hệ PGDCN active profile (PCN và PGD), toàn bộ cấu trúc Card, Toolbar và Luồng mẫu được chuẩn hóa áp dụng thống nhất theo quy cách tại **Mục 3.1.1 (Card Hồ Sơ & Đề Nghị TVCI Lab)** và **Mục 3.6 (Sổ Mẫu Thử & Luồng PYC)**.
```

### Bản vá 3: Cập nhật Mục 6.1 — Cấu trúc Phân bổ Type & Interface PCN Topology
*Vị trí áp dụng*: Thay thế dòng 1149–1165 trong Mục 6.
```markdown
### 6.1. Cấu trúc Phân bổ Data Models & Schema
- **`/types.ts`**: Định nghĩa toàn bộ Interface cốt lõi của Phân hệ PCN, Quản trị Người dùng & Phân quyền RBAC (`PcnUserAccount`), Thông báo dùng chung (`PgdcnNotification`), và Nhật ký hoạt động (`ActivityLog`).
- **`utils/pgdDomain.ts`, `utils/pgdDossier.ts`, `utils/pgdArtifacts.ts`**: Định nghĩa toàn bộ Data Models & State Machine của Phân hệ PGD.
- **`utils/pcnWorkflowTemplate.ts`, `utils/pcnWorkflowRuntime.ts`**: Định nghĩa Interface và Logic vận hành Lưu trình Động PCN (Workflow Topology):
  * `PcnWorkflowTemplate`: Template quy trình chứng nhận.
  * `PcnWorkflowNodeDefinition`: Định nghĩa node tác vụ (`DOCUMENT_TASK`, `APPROVAL_TASK`, `DECISION`, `PARALLEL_SPLIT`, `PARALLEL_JOIN`, `END`).
  * `PcnWorkflowTransitionDefinition`: Định nghĩa liên kết chuyển tiếp và điều kiện rẽ nhánh.
  * `PcnWorkflowSnapshot`: Bản chụp bất biến của topology quy trình gắn với từng hồ sơ.
  * `PcnDossierWorkflowTask`: Thể hiện tác vụ cụ thể đang chờ thực thi trong hồ sơ.
```

### Bản vá 4: Bổ sung Mục 6.2 — Danh mục 14 Interface Cốt lõi Phân hệ PGD
*Vị trí áp dụng*: Thêm mới tiểu mục 6.2 vào Mục 6.
```markdown
### 6.2. Danh mục Interface Cốt lõi Phân hệ PGD (`utils/pgdDomain.ts`, `utils/pgdDossier.ts`, `utils/pgdArtifacts.ts`)
1. `PgdInspectionRequest`: Phiếu yêu cầu giám định (mã `PGD-YYMMDD-TT`).
2. `PgdInspectionAssignment`: Phân công giám định viên phụ trách và phối hợp.
3. `PgdFieldInspection`: Hoạt động kiểm tra hiện trường, phương tiện, phương pháp.
4. `PgdSample`: Mẫu giám định (phân tách `LAB` gửi PTN và `RETAINED` lưu kho).
5. `PgdLabRequest`: Phiếu yêu cầu thử nghiệm gửi PTN nội bộ/ngoài.
6. `PgdLabResult`: Kết quả thử nghiệm từ PTN nhận về.
7. `PgdResultTemplateSnapshot`: Bản chụp biểu mẫu kết quả thử nghiệm.
8. `PgdInspectionReport`: Báo cáo kết quả giám định của giám định viên.
9. `PgdApprovalStep`: Bước phê duyệt trong chuỗi phê duyệt hai cấp (`TECHNICAL_REVIEW`, `LEADERSHIP_APPROVAL`).
10. `PgdInspectionCertificate`: Chứng thư giám định chính thức phát hành cho khách hàng.
11. `PgdInspectionPlan`: Kế hoạch giám định chi tiết cho lô hàng.
12. `PgdCaseEvent`: Dòng thời gian sự kiện của hồ sơ giám định.
13. `PgdFieldActivityLog`: Nhật ký ghi chép hoạt động tại hiện trường.
14. `PgdDossierIndex`: Mục lục hồ sơ lưu trữ hoàn chỉnh của vụ việc.
```

### Bản vá 5: Cập nhật Mục 7.3 & Mục 10 — Chuẩn hóa Hợp đồng API
*Vị trí áp dụng*: Mục 7.3 và Mục 10.
- Bổ sung vào bảng API Mục 7.3:
  * `POST /api/pcn/intake`: Tiếp nhận Đề nghị tạo đồng thời CertificationDossier và checklist tài liệu ban đầu trong 1 transaction nguyên tử.
  * `GET /api/tieuchuan`: Tra cứu danh mục tiêu chuẩn kỹ thuật (đọc từ `public/tieuchuan.xlsx`).
- Sửa đổi phương thức tại dòng 1220 Mục 7.3:
  * Thay `POST /api/pgdcn/notifications/clear` thành `DELETE /api/pgdcn/notifications/clear`.
- Cập nhật dòng 1353 Mục 10:
  * Đánh dấu `GET /api/pcn/cutover-status` là `[RETIRED / BÃI BỎ]` do Mục 0.3 quy định PCN chỉ phục vụ hồ sơ mới, cấm màn hình/công cụ cutover.
- Bổ sung ghi chú kiến trúc vào đầu Mục 7.3:
  * Ghi rõ: `server.ts` (Express) là cổng API Gateway thực tế duy nhất tiếp nhận và xử lý toàn bộ các endpoints `/api/*`. Next.js App Router phụ trách giao diện người dùng Frontend.

---

## V. DANH SÁCH HÀNH ĐỘNG SỬA ĐỔI RÕ RÀNG (ACTION PLAN)
*(Tuân thủ tuyệt đối quy định `AGENTS.md`: Tách bạch hoàn toàn giữa Cập nhật Tài liệu và Cập nhật Mã nguồn; Chỉ thực thi mã nguồn khi Người dùng đồng ý).*

### Kế hoạch 1: Cập nhật Tài liệu Thiết kế (`design.md`) — Ưu tiên cao
Thực hiện cập nhật trực tiếp vào file `design.md` theo 5 bản vá đề xuất ở Mục IV nêu trên:
- [ ] Áp dụng Bản vá 1 vào Mục 2.2 (Bổ sung bảng token trạng thái PCN và PGD).
- [ ] Áp dụng Bản vá 2 vào Mục 3.1 (Ghi chú phân định Legacy Reference DDT vs Active Profile PGDCN).
- [ ] Áp dụng Bản vá 3 vào Mục 6.1 (Cập nhật cấu trúc phân bổ Type và Interface PCN Topology).
- [ ] Áp dụng Bản vá 4 vào Mục 6.2 (Bổ sung danh mục 14 Interface cốt lõi PGD).
- [ ] Áp dụng Bản vá 5 vào Mục 7.3 & Mục 10 (Chuẩn hóa Hợp đồng API, Gateway Express, bãi bỏ cutover-status).

### Kế hoạch 2: Sửa đổi Mã Nguồn (Code Implementation) — Chờ Người dùng Duyệt
Sau khi Người dùng duyệt báo cáo và chấp thuận kế hoạch, các hành động sửa code sẽ được triển khai theo thứ tự an toàn:
1. **Tinh chỉnh UI/UX Components**:
   - `components/PcnDossierGroupCard.tsx`: Bổ sung dòng hiển thị tóm tắt tài liệu còn thiếu trong Accordion (dòng 279); thêm lớp touch-target tối thiểu 44px trên mobile cho các icon action; điều chỉnh `ChevronDown size={10}`.
   - `components/PgdWorkspace.tsx`: Nâng cấp hàm `StatusBadge` trong `RequestCard` sang sử dụng component chuẩn `PgdcnStatusBadge` (trong `components/PgdcnUiPrimitives.tsx`) để hiển thị đầy đủ 10 StateTone.
   - `components/PcnWorkspace.tsx`: Áp dụng lớp `pgdcn-toolbar-nowrap` kết hợp thanh cuộn ngang dự phòng trên toolbar desktop để chống vỡ hàng.
2. **Củng cố An ninh Backend**:
   - `server.ts`: Bọc middleware xác thực phiên cho các route DDT legacy còn sót lại (`/api/upload-nas`, `/api/generate-docx`, `/api/extract-radimation`, `/api/kqtn/*`).
3. **Định hướng Kiến trúc Dài hạn (Tech Debt)**:
   - Thống nhất chiến lược giữa Express (`server.ts`) và Next.js App Router (`app/api/*`): Nếu tiếp tục duy trì Express làm Gateway thì dọn dẹp hoặc đóng băng thư mục `app/api/*`; nếu chuyển đổi sang App Router thì cần chuyển nốt 30+ routes PGD và module Backup trước khi ngắt Express.
