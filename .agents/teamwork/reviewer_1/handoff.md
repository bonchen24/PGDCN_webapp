# BÁO CÁO THẨM ĐỊNH ĐỘC LẬP & PHẢN BIỆN ĐỐI KHÁNG (INDEPENDENT REVIEW & CHALLENGE REPORT)

**Người thẩm định**: Reviewer 1 (`teamwork_preview_reviewer`)  
**Đối tượng thẩm định**:
- `e:\CODING\PGDCN_webapp\.agents\teamwork\orchestrator_1\UI_UX_AUDIT_REPORT.md`
- `e:\CODING\PGDCN_webapp\.agents\teamwork\orchestrator_1\REMEDIATION_PLAN.md`
**Tài liệu quy chuẩn đối chiếu**: `design.md` (Mục 2, 3, 4, 5, Phụ lục 5A, Mục 7, Mục 8) và `ORIGINAL_REQUEST.md`  
**Ngày thực hiện**: 2026-09-28  

---

## 1. OBSERVATION (QUAN SÁT THỰC TẾ)

1. **Kiểm tra tính toàn vẹn mã nguồn (R4 & Integrity Check)**:
   - Chạy lệnh `git status --short`:
     ```text
     ?? .agents/teamwork/
     ```
     Toàn bộ cây thư mục mã nguồn không có bất kỳ thay đổi nào. Không phát hiện hành vi tự ý sửa code trước khi duyệt. Không có dấu hiệu gian lận test, facade code, hoặc hardcoded test results.

2. **Kiểm tra trạng thái kỹ thuật baseline**:
   - `npm run typecheck`: Exit code 0 (TypeScript compile sạch).
   - `npm run test:pcn`: Exit code 0 (934 tests passed, 0 failed).
   - `node --test test/toolbar-single-row-ui.test.ts`: Exit code 0 (2 passed).
   - `node --test test/card-form-layout-ui.test.ts`: Exit code 0 (3 passed).
   - `node --test test/next-app-shell.test.ts`: Exit code 1 (1 failed: regex `/Phòng Chứng nhận/` không khớp với `title` mới trong `app/layout.tsx`).

3. **Cấu trúc cây thư mục thực tế vs Cấu trúc trong Báo cáo**:
   - Trong `UI_UX_AUDIT_REPORT.md` và `REMEDIATION_PLAN.md`, tác giả ghi các đường dẫn có tiền tố `src/` và thư mục phân nhánh con:
     - `src/index.css`
     - `src/app/layout.tsx`
     - `src/components/pcn/PcnSampleFlowView.tsx`
     - `src/components/pcn/PcnDossierGroupCard.tsx`
     - `src/components/pgd/PgdIntakeSampleTable.tsx`
     - `src/components/pgdcn/PgdcnAppShell.tsx`
     - `src/utils/backupApi.ts`
   - Nhưng trên hệ thống tệp thực tế:
     - Thư mục gốc không tồn tại `src/`.
     - `index.css` nằm tại thư mục gốc (`e:\CODING\PGDCN_webapp\index.css`).
     - Layout nằm tại `app/layout.tsx`.
     - Toàn bộ 95 component nằm phẳng trong thư mục `components/` (ví dụ `components/PcnSampleFlowView.tsx`, `components/PgdIntakeSampleTable.tsx`). Không hề có thư mục con `components/pcn/`, `components/pgd/`, `components/pgdcn/`.
     - `utils/backupApi.ts` nằm tại `utils/backupApi.ts`.

4. **Kiểm tra tính chuẩn xác của các phát hiện kỹ thuật tiêu biểu**:
   - **D1 (`index.css:19-50`)**: `:root` không khai báo biến `--status-*-bg`, `--tester-*-bg`, trong khi `@theme` lại gọi `var(--status-waiting-bg)`. Xác nhận chính xác.
   - **D2 (`app/layout.tsx`)**: Thiếu `<div id="root">` và `<div id="portrait-only-message">`. Xác nhận chính xác.
   - **D3 (`components/PgdcnAppShell.tsx:384`, `index.css:376`)**: Nút Header mobile gắn class `mobile-safe-bottom` có `padding-bottom: calc(4.5rem + env(safe-area-inset-bottom))` không nằm trong media query. Xác nhận chính xác.
   - **P1 (`components/PcnSampleFlowView.tsx:227`)**: Bảng `<table>` rộng cố định `min-w-[980px]`. Xác nhận chính xác.
   - **P3 (`components/PcnDossierGroupCard.tsx:105-128`)**: Hàm `getProgressPercentage` gán cứng % theo enum status. Xác nhận chính xác.
   - **G1 (`components/PgdIntakeSampleTable.tsx:64, 83`)**: Sử dụng thẻ `<datalist>` vi phạm Mục 5.3 của `design.md`. Xác nhận chính xác.
   - **K1 & K2**: `components/KQTNView.tsx` và `components/ReportGeneratorView.tsx` không còn tồn tại trong source code. Xác nhận chính xác.
   - **A1 (`utils/backupApi.ts`)**: API backup đã viết đầy đủ nhưng không được import ở bất kỳ đâu trong `components/*.tsx`. Xác nhận chính xác.
   - **A3 (`components/PcnUserManagementView.tsx:235, 250`)**: Dùng `window.confirm` và `window.prompt`. Xác nhận chính xác.
   - **A7 (`components/PcnOcrPanel.tsx:63-70`)**: `useEffect` paste không có dependency array `[]`. Xác nhận chính xác.

5. **Số lượng phát hiện trong báo cáo**:
   - Executive Summary ghi: "tổng cộng 51 điểm sai lệch (12 High, 23 Medium, 16 Low)".
   - Thực tế bảng thống kê:
     - Dashboard & Tokens: 12 (D1 - D12)
     - Phân hệ PCN: 14 (P1 - P14)
     - Phân hệ PGD: 8 (G1 - G8)
     - Sổ KQTN: 8 (K1 - K8)
     - Admin & Cài đặt: 10 (A1 - A10)
     - Tổng cộng thực tế trong các bảng: **52 điểm** (lệch 1 điểm so với tóm tắt).

6. **Quan sát ràng buộc từ Test Suite đối với mã nguồn**:
   - `test/pcn-sample-flow.test.ts` (dòng 313–378) đọc file `components/PcnSampleFlowView.tsx` dưới dạng chuỗi và assert trực tiếp bằng regex:
     - `assert.match(sampleFlowSource, /const selectedDossier = dossiers\.find\(\(item\) => item\.id === form\.dossierId\)/);`
     - `assert.match(sampleFlowSource, /const availableFields = selectedDossier \? fields\.filter\(\(field\) => selectedDossier\.fieldCodes\.includes\(field\.code\)\) : \[\]/);`
     - `assert.match(sampleFlowSource, /const \[busyRouteId, setBusyRouteId\]/);`
     - `assert.match(sampleFlowSource, /expandedLotIds/);`
     - `assert.match(sampleFlowSource, /Mở tất cả/);`
     - `assert.match(sampleFlowSource, /Thu gọn tất cả/);`
     - `assert.match(sampleFlowSource, /aria-expanded=\{isExpanded\}/);`
     - `assert.match(sampleFlowSource, /aria-controls=\{`lot-flow-\$\{lot\.id\}`\}/);`
     - `assert.match(sampleFlowSource, /id=\{`lot-flow-\$\{lot\.id\}`\}/);`
     - `assert.match(sampleFlowSource, /itemSnapshots/);`
   - `test/toolbar-single-row-ui.test.ts` (dòng 10) assert regex trong `index.css`:
     - `assert.match(css, /\.pgdcn-toolbar-nowrap\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*nowrap;[\s\S]*overflow-x:\s*auto;/);`
   - `test/pgd-intake-sample-ui.test.ts` (dòng 8–24) assert sự xuất hiện của các marker trong `components/PgdIntakeSampleTable.tsx`:
     - `'Bảng tổng hợp mẫu'`, `'Thêm mẫu'`, `'Xóa mẫu'`, `'Tên/mô tả mẫu'`, `'Mã mẫu'`, `'Số lượng'`, `'Phân loại mẫu'`, `'Số niêm phong'`, `'catalogOptionId'`, `'Mẫu khác'`, `'text-rose-600'`, `'mobile-scroll-x'`, `'Tổng số lượng'`.

---

## 2. LOGIC CHAIN (CHUỖI LẬP LUẬN ĐÁNH GIÁ)

1. Từ **Quan sát 1 & 4**: Báo cáo của orchestrator_1 có độ chính xác kỹ thuật rất cao. Các phân tích về token thiếu trong `:root`, lỗi layout, vi phạm thẻ `<datalist>`, mâu thuẫn kiến trúc KQTN và thiếu UI backup đều được kiểm chứng độc lập là đúng sự thật và dẫn chiếu chính xác đến từng mục của `design.md`.
2. Từ **Quan sát 3**: Toàn bộ đường dẫn tệp trong báo cáo và kế hoạch đều gắn tiền tố `src/` và tạo các cấp thư mục con giả định (`src/components/pcn/`, `src/components/pgd/`, `src/components/pgdcn/`). Nếu kế hoạch này được phê duyệt nguyên trạng và chuyển giao cho agent lập trình (coder), agent sẽ gặp lỗi `file not found` hoặc tự ý tạo ra cây thư mục `src/` song song, làm phá vỡ kiến trúc Next.js App Router hiện hành của dự án.
3. Từ **Quan sát 6**: Việc thực thi các giải pháp trong `REMEDIATION_PLAN.md` có nguy cơ phá vỡ test suite nếu không có cảnh báo rõ ràng:
   - Giải pháp D4 đề xuất đưa `.pgdcn-toolbar-nowrap` vào media query `min-width: 768px` sẽ làm gãy bài test `test/toolbar-single-row-ui.test.ts` nếu xóa bỏ hoặc bọc toàn bộ selector gốc.
   - Giải pháp P1 thay bảng bằng Card Flow trong `PcnSampleFlowView.tsx` sẽ làm gãy `test/pcn-sample-flow.test.ts` nếu loại bỏ các tên biến hook hoặc các thuộc tính ARIA mà test đang quét bằng regex.
   - Giải pháp G1 thay thế `<datalist>` trong `PgdIntakeSampleTable.tsx` sẽ làm gãy `test/pgd-intake-sample-ui.test.ts` nếu làm mất các marker text tĩnh.
4. Từ **Quan sát 5**: Số lượng thống kê tổng trong Executive Summary (51) bị lệch 1 đơn vị so với 52 mục chi tiết trong các bảng. Cần chuẩn hóa số liệu thống nhất.
5. Từ các bước trên: Kế hoạch khắc phục và báo cáo kiểm tra đạt chất lượng nội dung xuất sắc, nhưng có **2 điểm thiếu sót cấu trúc trọng yếu (Major findings)** cần được chuẩn hóa trước khi trình người dùng phê duyệt: (1) Chuẩn hóa lại đường dẫn tệp thực tế; (2) Bổ sung mục ràng buộc kiểm thử hồi quy (Test Guardrails) để bảo vệ 934 tests passing.

---

## 3. CAVEATS (GIỚI HẠN & GIẢ ĐỊNH)

1. Chưa kiểm thử tương tác upload/restore nhị phân thực tế với Supabase Storage và Docker PostgreSQL do dịch vụ Docker cục bộ chưa kích hoạt trong phiên này.
2. Bài test `test/next-app-shell.test.ts` hiện tại đang fail độc lập từ trước do lệch chuỗi `title` metadata; đây là vấn đề baseline có sẵn, không phải do báo cáo audit gây ra.

---

## 4. REVIEW SUMMARY & VERDICT

**VERDICT**: **REQUEST_CHANGES**

### Findings (Chi tiết các điểm cần hoàn thiện)

#### [Major] Finding 1: Chuẩn hóa đường dẫn tệp (Loại bỏ tiền tố `src/` và thư mục phân nhánh con)
- **Vấn đề**: Toàn bộ đường dẫn file trong `UI_UX_AUDIT_REPORT.md` và `REMEDIATION_PLAN.md` đang dùng tiền tố `src/` và chia thư mục `components/pcn/`, `components/pgd/`, `components/pgdcn/`.
- **Thực tế**: Dự án dùng cấu trúc phẳng:
  - `index.css` (ở root)
  - `app/layout.tsx` (ở `app/`)
  - `components/*.tsx` (95 files nằm phẳng trong `components/`)
  - `utils/*.ts` (ở `utils/`)
- **Yêu cầu khắc phục**: Sửa toàn bộ đường dẫn trong cả 2 tài liệu về đường dẫn chính xác của repo để các agent thực thi kế tiếp không bị nhầm lẫn.

#### [Major] Finding 2: Bổ sung "Ràng buộc kiểm thử hồi quy (Test Guardrails)" vào Remediation Plan
- **Vấn đề**: Kế hoạch đề xuất tái cấu trúc `PcnSampleFlowView`, `index.css` (.pgdcn-toolbar-nowrap), `PgdIntakeSampleTable` nhưng chưa lưu ý việc test suite sử dụng regex kiểm tra tĩnh mã nguồn.
- **Rủi ro**: Dễ làm fail các test: `test/pcn-sample-flow.test.ts`, `test/toolbar-single-row-ui.test.ts`, `test/pgd-intake-sample-ui.test.ts`.
- **Yêu cầu khắc phục**: Thêm một mục "Ràng buộc kỹ thuật khi refactor (Test Preservation Constraints)" trong `REMEDIATION_PLAN.md` với các chỉ dẫn cụ thể:
  1. Trong `PcnSampleFlowView.tsx`: Giữ nguyên các biến `selectedDossier`, `availableFields`, `expandedLotIds`, `busyRouteId`, `itemSnapshots` và các thuộc tính `aria-expanded`, `aria-controls`.
  2. Trong `index.css`: Giữ nguyên cú pháp khai báo gốc của `.pgdcn-toolbar-nowrap` để khớp regex `test/toolbar-single-row-ui.test.ts`, và thực hiện override responsive qua media query bổ sung.
  3. Trong `PgdIntakeSampleTable.tsx`: Giữ nguyên các text marker `catalogOptionId`, `Mẫu khác`, `Tên/mô tả mẫu`, `mobile-scroll-x`.

#### [Minor] Finding 3: Khớp số liệu thống kê trong Executive Summary
- **Vấn đề**: Executive Summary ghi 51 điểm; thực tế bảng thống kê có 52 điểm (D: 12, P: 14, G: 8, K: 8, A: 10).
- **Yêu cầu khắc phục**: Cập nhật lại số tổng 52 điểm trong Executive Summary của `UI_UX_AUDIT_REPORT.md`.

---

## 5. ADVERSARIAL CHALLENGE REPORT (PHẢN BIỆN ĐỐI KHÁNG)

**Đánh giá rủi ro tổng thể**: **MEDIUM** (Kế hoạch logic tốt, nhưng rủi ro nằm ở việc phá vỡ test tĩnh và lệch đường dẫn).

### Thử thách 1: Tính khả thi của Card Flow PCN (`PcnSampleFlowView`)
- **Giả định**: Chuyển bảng `<table>` 980px thành danh sách Card Flow có thể thực hiện tự do về mặt JSX.
- **Kịch bản gãy**: Test suite `test/pcn-sample-flow.test.ts` chứa hơn 15 phép so khớp regex trên file mã nguồn, kiểm tra từng dòng gán biến, điều kiện `quantity > 1`, xử lý `busyRouteId`, và cơ chế mở rộng `expandedLotIds`.
- **Biện pháp đối phó**: Thay vì viết lại component từ đầu dưới dạng cấu trúc hoàn toàn mới, cần giữ nguyên khung logic và state management hiện tại, chỉ thay thế khối markup table hàng dọc (`<tr><td>`) thành layout card và responsive arrow stepper.

### Thử thách 2: Xung đột giữa `design.md` và `test/toolbar-single-row-ui.test.ts`
- **Giả định**: Chuyển `.pgdcn-toolbar-nowrap` sang media query desktop sẽ giải quyết triệt để lỗi tràn mobile.
- **Kịch bản gãy**: Bài test `test/toolbar-single-row-ui.test.ts` assert thẳng: `assert.match(css, /\.pgdcn-toolbar-nowrap\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*nowrap;[\s\S]*overflow-x:\s*auto;/);`. Nếu dọn rule này vào `@media (min-width: 768px)`, regex có thể không khớp do khoảng trắng hoặc cấu trúc lồng.
- **Biện pháp đối phó**: Giữ nguyên rule khai báo CSS gốc ở cấp độ root của stylesheet, sau đó bổ sung rule override riêng ở `@media (max-width: 767px) { .pgdcn-toolbar-nowrap { flex-wrap: wrap !important; } }`.

### Thử thách 3: Mở rộng `PgdcnBadge` và kiểu dữ liệu `PgdcnStatusTone`
- **Giả định**: Thêm các màu `cyan`, `indigo`, `purple` vào `PgdcnBadge` mà không ảnh hưởng hệ thống.
- **Kịch bản gãy**: `PgdcnUiPrimitives.tsx` import `type PgdcnStatusTone` từ `utils/pgdcnDashboard.ts`. Nếu chỉ cập nhật component mà không cập nhật union type trong `utils/pgdcnDashboard.ts`, TypeScript compiler (`npm run typecheck`) sẽ báo lỗi gãy type definition.
- **Biện pháp đối phó**: Ghi rõ trong Kế hoạch Giai đoạn 1: Mở rộng đồng thời union type `PgdcnStatusTone` trong `utils/pgdcnDashboard.ts` đi kèm với object class map trong `components/PgdcnUiPrimitives.tsx`.

---

## 6. VERIFICATION METHOD (PHƯƠNG PHÁP KIỂM TRA ĐỘC LẬP)

Để kiểm chứng các nhận định trong báo cáo thẩm định này, thực hiện các bước sau:
1. **Kiểm tra đường dẫn tệp thực tế**:
   - `ls index.css` (thành công) vs `ls src/index.css` (báo lỗi không tìm thấy đường dẫn).
   - `ls components/PcnSampleFlowView.tsx` (thành công) vs `ls src/components/pcn/PcnSampleFlowView.tsx` (báo lỗi).
2. **Kiểm tra các bài test regex hiện hành**:
   - `node --test test/toolbar-single-row-ui.test.ts`
   - `node --test test/pcn-sample-flow.test.ts`
   - `node --test test/pgd-intake-sample-ui.test.ts`
   - Đọc các dòng test để xác nhận các regex assertion trên mã nguồn.
3. **Kiểm tra baseline test suite**:
   - `npm run typecheck`
   - `npm run test:pcn`

---
*Báo cáo thẩm định hoàn tất bởi Reviewer 1 vào lúc 2026-09-28T15:05:00Z.*
