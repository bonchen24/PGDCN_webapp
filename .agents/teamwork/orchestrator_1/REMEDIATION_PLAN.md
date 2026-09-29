# KẾ HOẠCH KHẮC PHỤC VÀ HOÀN THIỆN UI/UX TVCI WEB APP (REMEDIATION PLAN)

**Dự án**: TVCI Web App (PGDCN / PCN / PGD)  
**Tài liệu tham chiếu**: `design.md`  
**Nguyên tắc thực thi**: Chỉ bắt đầu lập trình khi có sự phê duyệt chính thức từ người dùng (tuân thủ nghiêm ngặt R4).  
**Mục tiêu**: Chuẩn hóa 100% giao diện theo `design.md`, loại bỏ toàn bộ lỗi layout/tokens/responsive, không làm gãy vỡ logic nghiệp vụ và bảo vệ tuyệt đối 934 tests passing hiện hành.  
**Cấu trúc thư mục mã nguồn**: Next.js App Router dạng phẳng (`components/*.tsx`, `utils/*.ts`, `app/*.tsx`, `index.css` tại root).

---

## I. LỘ TRÌNH THỰC THI THEO 4 GIAI ĐOẠN (PHASED ROADMAP)

```
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1: NỀN TẢNG CSS CORE, TOKENS TOÀN CỤC & RESPONSIVE CHUẨN     │
│ (CSS Variables, Root Layout, Badge Primitives, Cấm Thẻ <datalist>)     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2: CHUẨN HÓA CARD COMPONENTS & ACCORDIONS (PCN & PGD)        │
│ (PcnSampleFlow Card Flow, Dossier Card Progress, PGD Accordion & Chips)│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3: CHUẨN HÓA MODALS, TYPOGRAPHY & ADMIN INTERACTION          │
│ (PcnOperational Typography, Native Dialog Elimination, Pagination)    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 4: TÍCH HỢP TÍNH NĂNG MỚI (BACKUP UI & SỔ KQTN NẾU DUYỆT)    │
│ (BackupRestore Panel, Master Data Products/Brands, KQTN Persistence)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## II. CHI TIẾT TỪNG GIAI ĐOẠN THỰC THI

### GIAI ĐOẠN 1: NỀN TẢNG CSS CORE, TOKENS TOÀN CỤC & RESPONSIVE KHUNG (Ưu tiên cao nhất)

#### 1. Mục tiêu & Phạm vi
Khắc phục các lỗi nền tảng ảnh hưởng toàn cục đến màu sắc trạng thái, layout mobile và các thành phần cốt lõi.

#### 2. Danh sách file và công việc cụ thể
1. **`index.css`**:
   - Bổ sung khai báo đầy đủ các biến `:root` còn thiếu:
     ```css
     :root {
       --status-waiting-bg: #f8fafc;
       --status-waiting-text: #475569;
       --status-inlab-bg: #eff6ff;
       --status-inlab-text: #1d4ed8;
       /* Các biến màu kiểm nghiệm viên: --tester-1-bg đến --tester-8-text */
     }
     ```
   - Đóng gói `.mobile-safe-bottom { padding-bottom: 72px; }` bên trong `@media (max-width: 767px)`.
   - Giữ nguyên khai báo gốc `.pgdcn-toolbar-nowrap` để bảo vệ test regex `test/toolbar-single-row-ui.test.ts`, và thêm override riêng:
     ```css
     @media (max-width: 767px) {
       .pgdcn-toolbar-nowrap {
         flex-wrap: wrap !important;
       }
     }
     ```
   - Điều chỉnh công thức typography compact `.app-compact` để đạt đúng kích thước 11px/line-height 1.2 (xs) và 13px/line-height 1.3 (sm).
   - Hợp nhất selector `.app-compact, .pcn-compact` cho toàn bộ quy tắc spacing scale và scrollbar style.
2. **`app/layout.tsx`**:
   - Thêm container `<div id="root">` bọc `{children}` để các CSS rule định vị `#root` và zoom hoạt động chuẩn xác.
   - Bổ sung container thông điệp cảnh báo xoay màn hình `<div id="portrait-only-message">` chuẩn Mục 5.2.1.4.
3. **`components/PgdcnAppShell.tsx`**:
   - Gỡ bỏ class `.mobile-safe-bottom` khỏi nút bấm trên Header di động (dòng 384).
   - Bổ sung hook kích hoạt `window.screen?.orientation?.lock('portrait')` khi phát hiện chế độ standalone.
4. **`components/PgdIntakeSampleTable.tsx`**:
   - Loại bỏ hoàn toàn thẻ `<datalist>` (dòng 64, 83), thay bằng `<select className="pgdcn-select">` hoặc accessible dropdown combobox.
   - Giữ nguyên các text marker `catalogOptionId`, `Mẫu khác`, `Tên/mô tả mẫu`, `mobile-scroll-x` theo quy định Test Guardrails.
5. **`utils/pgdcnDashboard.ts` & `components/PgdcnUiPrimitives.tsx`**:
   - Cập nhật union type `PgdcnStatusTone` trong `utils/pgdcnDashboard.ts` thêm các tone: `'cyan' | 'indigo' | 'purple' | 'orange' | 'teal'`.
   - Mở rộng `PgdcnBadge` trong `components/PgdcnUiPrimitives.tsx` hỗ trợ đầy đủ 9 tone màu token chuẩn quy định tại Mục 2.2:
     - `cyan` (SAMPLES_RECEIVED)
     - `indigo` (SCHEDULED)
     - `purple animate-pulse` (TESTING - đang thử nghiệm)
     - `orange` (RESULTS_SUBMITTED)
     - `teal` (COMPLETED)
     - `emerald`, `blue`, `amber`, `rose`, `slate`.

#### 3. Tiêu chí nghiệm thu Giai đoạn 1
- Toàn bộ class trạng thái mẫu hiển thị đúng màu nền và màu chữ.
- Header không bị phình to bất thường do padding 72px; giao diện mobile có cảnh báo khi xoay ngang thiết bị.
- Không còn bất kỳ thẻ `<datalist>` nào trong toàn bộ dự án.
- `npm run typecheck` và `npm run test:pcn` vượt qua 100%.

---

### GIAI ĐOẠN 2: CHUẨN HÓA CARD COMPONENTS & ACCORDIONS (PCN & PGD)

#### 1. Mục tiêu & Phạm vi
Đưa toàn bộ kiến trúc Card hồ sơ, Card quản lý mẫu và Filter toolbar của 2 phân hệ mũi nhọn PCN và PGD về chuẩn Mục 3 của `design.md`.

#### 2. Danh sách file và công việc cụ thể
1. **`components/PcnSampleFlowView.tsx`**:
   - Tái cấu trúc giao diện: Thay thế bảng `<table>` 980px bằng danh sách **Card Flow** tuần tự (`PcnSampleFlowCard`).
   - Mỗi card bao gồm:
     - Header: Mã lô/mã mẫu, tên mẫu, quy cách, vị trí hiện tại.
     - Body: Flow chặng ngang tuần tự nối tiếp nhau bằng mũi tên (1 PTN A ──→ 2 PTN B ──→ 3 PTN C), hiển thị badge trạng thái từng chặng. Cho phép cuộn ngang trong vùng flow trên mobile mà vẫn giữ cố định thông tin mẫu.
     - Footer: Thông tin chặng tiếp theo và nút "Mở hồ sơ liên quan".
   - Tuân thủ Test Guardrails: Giữ nguyên các biến hook `selectedDossier`, `availableFields`, `expandedLotIds`, `busyRouteId`, `itemSnapshots` và các thuộc tính ARIA `aria-expanded`, `aria-controls`.
   - Sửa logic KPI đầu trang: Tính tổng số lượng mẫu thực tế thay vì đếm số lượng lô.
2. **`components/PcnDossierGroupCard.tsx`**:
   - Thay đổi cách tính thanh tiến độ: Lấy theo tỷ lệ tài liệu bắt buộc thực tế (`requiredDocumentPresent / requiredDocumentTotal * 100`).
   - Cập nhật vùng Accordion mở rộng: Bổ sung Badge trạng thái KQTN sơ bộ (Chờ KQ / Đạt / Cần thử lại) cho từng mẫu và khối cảnh báo danh sách tài liệu bắt buộc còn thiếu.
   - Tinh chỉnh Header Card: Đổi icon sang `FolderOpen`, mã Đề nghị màu `text-slate-800 tracking-wider`, đưa Badge Lĩnh vực (QC4/QC9) và Badge số lượng mẫu sang cụm bên phải cạnh Badge Trạng thái.
3. **`components/PcnDossierQueueView.tsx`**:
   - Sử dụng component chuẩn `PcnDossierGroupCard` thay cho việc tự render markup inline, mang lại khả năng mở rộng Accordion đầy đủ.
   - Đổi màu nút "Mở hồ sơ" sang màu xanh ngọc thương hiệu PCN (`bg-emerald-600 hover:bg-emerald-700`).
4. **`components/PgdDossierQueueView.tsx`**:
   - Bổ sung nút Chevron và vùng panel Accordion mở rộng xem danh sách mẫu (mẫu lưu / mẫu gửi PTN) và trạng thái tài liệu.
   - Thêm thanh Filter Chips Toolbar chuẩn trên đầu danh sách: bo góc `rounded-xl`, tracking `text-[11px] font-black uppercase` cho các nhóm: Tất cả, Thép/Kim loại, Máy móc, Than, Tiếp nhận, Đang xử lý, Quá hạn, Hoàn thành.
5. **`components/PcnWorkspace.tsx`**:
   - Chuẩn hóa Filter Chips Toolbar theo token `rounded-xl text-[11px] font-black uppercase`, bổ sung chip "ĐANG XỬ LÝ" và "QUÁ HẠN".
   - Thay thế các class `gray-*` thành `slate-*` (dòng 144).
   - Đổi chiều cao Header PCN từ `h-14` (56px) thành `h-13` (52px).
6. **`components/PgdWorkspace.tsx`**:
   - Đổi chiều cao Header PGD từ `h-14` (56px) thành `h-13` (52px).
   - Bổ sung class `mobile-scroll-x` cho các container bọc bảng mẫu dữ liệu.

#### 3. Tiêu chí nghiệm thu Giai đoạn 2
- Màn hình luồng mẫu PCN hiển thị trực quan dạng flow mũi tên, KPI đếm chuẩn xác theo số mẫu.
- Thao tác xem nhanh mẫu bằng Accordion hoạt động mượt mà trên cả PCN và PGD.
- Bộ lọc chip toolbar đồng nhất hình thái và typography trên cả 2 phân hệ.
- Bài test `test/pcn-sample-flow.test.ts` pass 100%.

---

### GIAI ĐOẠN 3: CHUẨN HÓA MODALS, TYPOGRAPHY & ADMIN INTERACTION

#### 1. Mục tiêu & Phạm vi
Đảm bảo tính nhất quán về visual hierarchy, công thái học (ergonomics), accessibility (vùng chạm 44px, focus trap, phím Escape) và loại bỏ hoàn toàn các dialog native.

#### 2. Danh sách file và công việc cụ thể
1. **`components/PcnOperationalFormModal.tsx`**:
   - Nâng chiều cao các trường nhập liệu từ `min-h-9` lên `min-h-11` (44px).
   - Nâng cỡ chữ ô nhập lên `text-sm` (13-14px) và nhãn trường lên `text-xs` (12-13px) theo đúng Mục 4.7.
2. **`components/PcnTemplateSettingsModal.tsx` & Các modal chi tiết**:
   - Nâng kích thước nút đóng header lên `min-h-11 min-w-11` kèm `focus-visible:ring-2 focus-visible:ring-emerald-500`.
   - Nâng chiều cao các nút tải và nút thao tác footer lên tối thiểu 44px.
   - Thêm thẻ `<footer>` cố định cho các nhánh hiển thị trong `components/PcnApprovalModal.tsx`.
3. **Loại bỏ Dialog Native (Browser Native Dialogs)**:
   - Thay thế `window.confirm` và `window.prompt` trong `components/PcnUserManagementView.tsx`, `components/PcnSettingsView.tsx`, `components/PgdcnDossierTemplateManagementView.tsx` bằng các Modal React chuyên dụng:
     - `ConfirmModal`: Dành cho thao tác xóa người dùng, ngừng dùng mẫu DOCX.
     - `PasswordResetModal`: Dành cho thao tác cấp lại mật khẩu.
     - `ReasonPromptModal`: Dành cho thao tác nhập lý do chỉnh sửa/ngừng áp dụng.
4. **`components/PcnUserManagementView.tsx`**:
   - Sửa logic hiển thị: Thay các dòng chữ phủ định `"Không giữ chức danh quản lý"` và `"Chưa gán vai trò chuyên môn"` bằng ký tự gạch ngang tinh tế `—` theo đúng Mục 5A.34.
   - Bổ sung thanh điều hướng phân trang (20 / 50 / 100 / Tất cả) dưới chân bảng.
5. **`components/PcnCustomersManagementView.tsx`**:
   - Thay thế toàn bộ mã màu tím `indigo-*` bằng màu xanh ngọc chuẩn `emerald-*`.
   - Bổ sung phân trang và tăng kích thước vùng bấm cho các nút thao tác (>= 44px).
6. **`components/ActivityLogView.tsx`**:
   - Bổ sung hook lắng nghe phím tắt `Escape` và thiết lập focus trap cho modal xem chi tiết nhật ký hoạt động.
   - Chuyển bộ lọc khi mở rộng trên mobile sang responsive grid 1-2 cột (`grid grid-cols-1 sm:grid-cols-2 md:flex`) thay vì ép `nowrap`.
7. **`components/PcnOcrPanel.tsx`**:
   - Thêm dependency array cho `useEffect` đăng ký listener `paste` để chấm dứt tình trạng re-attach listener liên tục.
8. **`components/PgdcnSidebar.tsx`**:
   - Thêm backdrop nền mờ `bg-black/50` khi mở mobile sidebar.
   - Cập nhật padding, bo góc `rounded-xl`, font bold cho item điều hướng và đổi icon chân trang thành icon `Settings`.
9. **`components/PgdcnDashboardView.tsx`**:
   - Sắp xếp lại thứ tự các section theo Mục 5.2.1.2 (Overview Metric → My Work → Domain Pipeline → Milestones → Activity Log).

#### 3. Tiêu chí nghiệm thu Giai đoạn 3
- Không còn bất kỳ cửa sổ native popup nào chặn trình duyệt.
- Mọi nút bấm và ô nhập liệu đều đạt chuẩn touch target tối thiểu 44px trên thiết bị cảm ứng.
- Bảng nhân sự hiển thị sạch sẽ, không còn các đoạn text phủ định dài dòng.

---

### GIAI ĐOẠN 4: TÍCH HỢP TÍNH NĂNG MỚI (SAO LƯU UI & SỔ KQTN - KHI CÓ PHÊ DUYỆT)

#### 1. Mục tiêu & Phạm vi
Thực thi các tính năng giao diện lớn đã có backend/API nhưng chưa có frontend, và xử lý mâu thuẫn kiến trúc Sổ KQTN theo quyết định của người dùng.

#### 2. Danh sách file và công việc cụ thể
1. **Xây dựng Giao diện Sao lưu & Khôi phục (`BackupRestoreAdminPanel`)**:
   - Tệp mới: `components/BackupRestoreAdminPanel.tsx`.
   - Kết nối với `utils/backupApi.ts` đã có sẵn.
   - Tính năng UI:
     - Hiển thị card trạng thái công cụ `pg_dump` và `pg_restore`.
     - Danh sách archive PCN kèm dung lượng và thời điểm tạo.
     - Nút "Tạo bản sao lưu tức thời" và "Tạo checkpoint trước import".
     - Modal khôi phục an toàn: Yêu cầu người dùng gõ chính xác từ khóa `KHOIPHUC` trước khi gửi lệnh restore.
   - Nhúng vào tab "Sao lưu & Dữ liệu" trong `components/PgdcnSystemSettingsView.tsx` và `components/PcnSettingsView.tsx` (chỉ hiển thị cho vai trò Admin).
2. **Xây dựng Quản lý Danh mục Sản phẩm (`products`) & Nhãn hiệu (`brands`)**:
   - Bổ sung màn hình/tab quản lý danh mục sản phẩm và nhãn hiệu trong phân hệ Quản trị / Master Data, hỗ trợ tìm kiếm, thêm, sửa, xóa và phân trang.
3. **Xử lý Phân hệ Sổ KQTN (Tùy theo Quyết định của Người dùng)**:
   - **Phương án A (Khuyến nghị nếu TVCI tiếp nhận KQTN từ PTN)**: Cập nhật `design.md` để đồng bộ spec với kiến trúc hiện hành: Chuẩn hóa `components/PcnResultReturnView.tsx` (tiếp nhận file scan KQTN, hiển thị 4 trường token chuẩn: requestCode, sampleCode, sealStamp IEMM) và `components/PgdResultsStationPanel.tsx`.
   - **Phương án B (Nếu TVCI cần Data Grid KQTN nội bộ)**: Xây dựng mới `components/PgdcnKqtnRegisterView.tsx` kế thừa kiến trúc bảng lưới của `components/PgdcnDossierSummaryGrid.tsx` với đầy đủ 17 cột KQTN, tính năng tùy biến cột (Column Resizing, Ẩn/Hiện cột, lưu localStorage), thanh KPI nhanh và bộ lọc chuyên sâu.
4. **Nâng cấp `components/PcnResultDetailModal.tsx`**:
   - Chuyển đổi thành Modal 4 Tabs: Tab 1 (Tổng quan & Đối soát tem), Tab 2 (Thông số OCR), Tab 3 (Dữ liệu đo đạc), Tab 4 (Lịch sử phiên bản).
5. **Nâng cấp `components/PcnOcrPanel.tsx`**:
   - Hỗ trợ quản lý mảng tem nhãn động `nameplatePhotos: string[]` (Tem 1, Tem 2, Tem 3...) và nút "OCR Tổng Hợp Tất Cả Tem Nhãn" gửi batch request đến AI Gemini.

#### 3. Tiêu chí nghiệm thu Giai đoạn 4
- Quản trị viên có thể tạo checkpoint sao lưu và khôi phục cơ sở dữ liệu trực tiếp trên Web App.
- Danh mục sản phẩm, nhãn hiệu được quản lý tập trung.
- Module KQTN hoạt động đồng nhất và phản ánh chính xác spec đã được người dùng phê duyệt.

---

## III. NGUYÊN TẮC BẢO TOÀN DỮ LIỆU & RỦI RO KỸ THUẬT

1. **Bảo toàn dữ liệu nghiệp vụ (Zero Business Logic Disruption)**:
   - Mọi chỉnh sửa chỉ tác động lên tầng hiển thị UI/UX và các CSS utility class.
   - Không thay đổi tên các field trong cơ sở dữ liệu PostgreSQL hoặc cấu trúc schema của hồ sơ, đề nghị, mẫu thử.
2. **Quy trình kiểm thử hồi quy nghiêm ngặt**:
   - Sau mỗi giai đoạn, bắt buộc chạy kiểm tra toàn bộ suite test:
     ```bash
     npm run typecheck
     npm run test:pcn
     ```
   - Tỷ lệ vượt qua phải duy trì tuyệt đối 100% (không chấp nhận bất kỳ bài test nào bị fail).
3. **Quy tắc tuân thủ Single Source of Truth**:
   - Nếu có điều chỉnh về luồng Sổ KQTN hay màn hình Sao lưu, bắt buộc cập nhật tài liệu `design.md` trước khi bàn giao mã nguồn theo đúng Quy định Agent Compliance.

---

## IV. RÀNG BUỘC KỸ THUẬT KIỂM THỬ HỒI QUY (TEST PRESERVATION GUARDRAILS)

Để đảm bảo quá trình refactor giao diện không làm gãy các bài test kiểm tra tĩnh (regex assertions) của test suite hiện hành, lập trình viên bắt buộc phải tuân thủ nghiêm ngặt các nguyên tắc sau:

1. **Ràng buộc đối với `components/PcnSampleFlowView.tsx` (`test/pcn-sample-flow.test.ts`)**:
   - **Tuyệt đối không xóa hoặc đổi tên** các hook state và biến logic nghiệp vụ sau:
     - `const selectedDossier = dossiers.find((item) => item.id === form.dossierId)`
     - `const availableFields = selectedDossier ? fields.filter((field) => selectedDossier.fieldCodes.includes(field.code)) : []`
     - `const [busyRouteId, setBusyRouteId]`
     - `expandedLotIds`
     - `itemSnapshots`
   - **Giữ nguyên các text nhãn điều khiển**: `"Mở tất cả"`, `"Thu gọn tất cả"`.
   - **Giữ nguyên các thuộc tính ARIA hỗ trợ kiểm thử**:
     - `aria-expanded={isExpanded}`
     - `aria-controls={`lot-flow-${lot.id}`}`
     - `id={`lot-flow-${lot.id}`}`
   - **Chiến lược refactor**: Giữ nguyên toàn bộ phần state machine và logic xử lý của component; chỉ thay đổi phần markup hiển thị từ thẻ `<table>` sang thẻ card và arrow flexbox container.

2. **Ràng buộc đối với `index.css` (`test/toolbar-single-row-ui.test.ts`)**:
   - Bài test yêu cầu khớp regex:
     ```javascript
     assert.match(css, /\.pgdcn-toolbar-nowrap\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*nowrap;[\s\S]*overflow-x:\s*auto;/);
     ```
   - **Không được bọc trực tiếp** rule `.pgdcn-toolbar-nowrap` vào bên trong `@media (min-width: 768px)` vì sẽ làm sai cú pháp regex của test.
   - **Giải pháp chuẩn**: Giữ nguyên khối khai báo gốc của `.pgdcn-toolbar-nowrap` tại root của `index.css`. Bổ sung một rule ghi đè riêng biệt bên dưới:
     ```css
     @media (max-width: 767px) {
       .pgdcn-toolbar-nowrap {
         flex-wrap: wrap !important;
       }
     }
     ```

3. **Ràng buộc đối với `components/PgdIntakeSampleTable.tsx` (`test/pgd-intake-sample-ui.test.ts`)**:
   - Khi thay thế thẻ `<datalist>`, **bắt buộc giữ nguyên toàn bộ các text marker và identifier**:
     - `'Bảng tổng hợp mẫu'`, `'Thêm mẫu'`, `'Xóa mẫu'`
     - `'Tên/mô tả mẫu'`, `'Mã mẫu'`, `'Số lượng'`, `'Phân loại mẫu'`, `'Số niêm phong'`
     - `'catalogOptionId'`, `'Mẫu khác'`
     - `'text-rose-600'`, `'mobile-scroll-x'`, `'Tổng số lượng'`
   - Bất kỳ giải pháp custom select nào cũng phải chứa `catalogOptionId` trong props hoặc markup để bài test xác minh logic catalog.

4. **Ràng buộc đối với `utils/pgdcnDashboard.ts` khi mở rộng Badge Tokens**:
   - Khi bổ sung các màu mới (`cyan`, `indigo`, `purple`, `orange`, `teal`) cho component `PgdcnBadge`, bắt buộc phải đồng bộ mở rộng union type `PgdcnStatusTone` trong `utils/pgdcnDashboard.ts` trước để bảo đảm lệnh `npm run typecheck` đạt 0 lỗi.
