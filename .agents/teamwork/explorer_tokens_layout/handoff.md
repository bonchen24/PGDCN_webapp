# HANDOFF REPORT — EXPLORER 1: DESIGN TOKENS, TYPOGRAPHY & RESPONSIVE LAYOUT (R1 & R3)

**Từ**: Explorer 1 (`teamwork_preview_explorer`)  
**Tới**: Orchestrator (`92df2c9d-db73-4bf8-8a0e-f0ad87a92c30`)  
**Workspace**: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_tokens_layout`  
**File chi tiết**: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_tokens_layout\audit_findings.md`

---

## 1. Observation

Đã trực tiếp kiểm tra mã nguồn đối chiếu với `design.md` Mục 2 (Dòng 545–586), Mục 5 (Dòng 1017–1134), Phụ lục 5A (Dòng 1512–1570). Các quan sát trực tiếp cụ thể gồm:

1. **Thiếu biến CSS `:root` trong `src/index.css:19–50`**:
   - Selector tham chiếu `var(--status-waiting-bg)`, `var(--status-inlab-bg)`, `var(--tester-1-bg)` đến `var(--tester-8-bg)`.
   - Tìm kiếm pattern `--status-waiting-bg` hoặc `--tester-` trong toàn bộ `src/index.css` cho kết quả: biến không hề được định nghĩa trong khối `:root`.

2. **Thiếu DOM container trong `src/app/layout.tsx`**:
   - File `layout.tsx` chỉ render `<body className="...">...{children}...</body>`.
   - Không tồn tại phần tử `<div id="root">` và `<div id="portrait-only-message">`.
   - CSS rule tại `src/index.css:87`: `#root { zoom: 1; }` và `src/index.css:327–370` (`@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse) { #root { display: none !important; } #portrait-only-message { display: flex !important; } }`) trở thành vô hiệu vì thiếu selector target.

3. **Sai lệch layout do `.mobile-safe-bottom`**:
   - `src/components/pgdcn/PgdcnAppShell.tsx:384`: Nút mobile menu Header gắn class `mobile-safe-bottom` và `pgdcn-mobile-nav`.
   - `src/index.css:376`: `.mobile-safe-bottom { padding-bottom: 72px; }` nằm ngoài media query, tác động lên mọi kích thước màn hình kể cả desktop.

4. **Toolbar không wrap trên di động**:
   - `src/index.css:169–174`: `.pgdcn-toolbar-nowrap { display: flex; flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; }` cố định trên mọi breakpoint, vi phạm quy định co giãn 1 cột trên mobile tại Mục 5.2.1.3.

5. **Phân mảnh Badge Tokens**:
   - `src/components/pgdcn/PgdcnUiPrimitives.tsx:64–76`: `PgdcnBadge` chỉ có 5 tone cơ bản `bg-*-50`.
   - `src/components/pcn/PcnDossierGroupCard.tsx:44–68`: Tự khai báo `statusClasses` ad-hoc với `bg-emerald-100`, `bg-amber-100`, v.v.
   - Thiếu các token chuẩn quy định tại Mục 2.2: cyan (`SAMPLES_RECEIVED`), indigo (`SCHEDULED`), purple animate-pulse (`TESTING`), orange (`RESULTS_SUBMITTED`), teal (`COMPLETED`).

6. **Sử dụng thẻ bị cấm**:
   - `src/components/pgd/PgdIntakeSampleTable.tsx:64 & 83`: Sử dụng thẻ `<datalist id="...">` cho gợi ý quy cách mẫu và đơn vị tính, vi phạm lệnh cấm tại Mục 5.3.

7. **Sai lệch kích thước chữ trong `src/index.css:118–146`**:
   - `.text-xs` có `font-size: calc(0.75rem * 0.9)` (10.8px, lệch chuẩn 11px / 0.6875rem), `line-height: 1.25` (lệch chuẩn 1.2).
   - `.text-base` có `font-size: calc(0.875rem * 0.9)` (12.6px, lệch chuẩn 13px / 0.8125rem).

8. **Hardcoded Hex và Inline Style**:
   - `src/components/pcn/PcnUserKpiTable.tsx:13–19` và `src/utils/activityLogKpi.ts:26–30`: Hardcoded `#059669`, `#2563eb`, `#d97706`, `#7c3aed`, `#94a3b8` và gán qua `style={{ backgroundColor: item.color }}`.
   - `src/components/pcn/PcnWorkspace.tsx:144`: Sử dụng `gray-*` thay vì Slate chuẩn.

9. **Trạng thái kiểm tra hệ thống**:
   - `npm run typecheck`: Exit code 0, không có lỗi TypeScript.
   - `npm run test:pcn`: 934 tests passed, 0 failed.

---

## 2. Logic Chain

1. Từ **Observation 1**: Do thiếu khai báo biến CSS trong `:root`, trình duyệt gán giá trị mặc định (transparent), làm mất màu nhận diện trạng thái mẫu và phân nhóm KTV khi render các class `.bg-status-*` và `.bg-tester-*`.
2. Từ **Observation 2**: Vì `src/app/layout.tsx` không có `#root` và `#portrait-only-message`, các quy tắc CSS khóa xoay màn hình ngang trên mobile không có DOM target để ẩn ứng dụng và hiển thị thông báo yêu cầu quay dọc, phá vỡ tính năng Mobile Portrait Lock bắt buộc của PWA tại Mục 5.2.1.4.
3. Từ **Observation 3**: Khi `.mobile-safe-bottom` nằm ngoài media query và được gán nhầm vào Header button, Header 52px bị padding thêm 72px và các giao diện Desktop bị đẩy một khoảng trống vô lý 72px ở đáy màn hình.
4. Từ **Observation 4**: Quy tắc `.pgdcn-toolbar-nowrap` ép `nowrap` ở mọi breakpoint khiến giao diện di động bị tràn thanh ngang thay vì xếp dọc 1 cột theo nguyên tắc ergonomics Mục 5.2.1.3.
5. Từ **Observation 5 & 8**: Việc phân mảnh token và dùng inline style/hardcoded hex dẫn đến việc không thể quản lý theme tập trung và phá vỡ quy chuẩn Design System của `design.md`.
6. Từ **Observation 6**: Sử dụng `<datalist>` gây lỗi hiển thị và không kích hoạt được bàn phím ảo thích hợp trên iOS/Android WebViews, dẫn đến việc Mục 5.3 liệt kê thẻ này vào danh mục cấm.
7. Từ **Observation 9**: Toàn bộ 934 bài kiểm thử hiện tại đang pass 100%, chứng minh logic nghiệp vụ vận hành ổn định; các lỗi trên hoàn toàn là sai lệch về presentation, layout contracts, tokens và CSS scopes.

---

## 3. Caveats

1. **Phạm vi kiểm tra**: Chỉ tập trung vào R1 (Design Tokens, Typography) và R3 (Layout & Responsive) theo Mục 2 và Mục 5/5A của `design.md`. Không đi sâu vào logic phân tích KQTN hay engine xuất file DOCX (thuộc R2, R4 của các agent khác).
2. **Quy tắc Read-Only**: Tuyệt đối không thay đổi mã nguồn trong phiên điều tra này. Mọi giải pháp khắc phục đều được đặc tả dưới dạng khuyến nghị triển khai có định vị file/line rõ ràng.
3. **Màn hình thực tế**: Rà soát qua phân tích tĩnh mã nguồn và chạy test suite; chưa kiểm thử trực tiếp trên thiết bị vật lý iOS Safari/Android Chrome (sẽ cần verify sau khi implementer áp dụng patch).

---

## 4. Conclusion

Mã nguồn hiện tại có logic nghiệp vụ vững chắc (test suite 934/934 pass, typecheck sạch), tuy nhiên tồn tại **19 điểm sai lệch kỹ thuật** so với quy chuẩn thiết kế `design.md`, trong đó có **6 lỗi nghiêm trọng (High)** ảnh hưởng trực tiếp đến hệ thống CSS Tokens, tính năng Mobile Portrait Lock và bố cục giao diện Desktop/Mobile.

Toàn bộ chi tiết kỹ thuật, vị trí dòng code, hậu quả và giải pháp khắc phục từng điểm đã được lập bảng đầy đủ trong tài liệu:
`e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_tokens_layout\audit_findings.md`.

---

## 5. Verification Method

Người tiếp nhận hoặc Orchestrator có thể độc lập xác minh các phát hiện bằng các bước sau:

1. **Xác minh biến CSS thiếu trong `:root`**:
   ```powershell
   Select-String -Path "src/index.css" -Pattern "--status-waiting-bg"
   # Kết quả: Chỉ thấy dòng 19 sử dụng var(--status-waiting-bg), không thấy dòng khai báo giá trị trong :root.
   ```
2. **Xác minh thiếu container `#root` trong layout**:
   ```powershell
   Select-String -Path "src/app/layout.tsx" -Pattern "id=\"root\""
   # Kết quả: Không tìm thấy kết quả nào.
   ```
3. **Xác minh thẻ `<datalist>` bị cấm**:
   ```powershell
   Select-String -Path "src/components/pgd/PgdIntakeSampleTable.tsx" -Pattern "<datalist"
   # Kết quả: Tìm thấy ở dòng 64 và dòng 83.
   ```
4. **Xác minh test suite nền tảng không bị gãy**:
   ```powershell
   npm run typecheck
   npm run test:pcn
   ```
   Điều kiện bất biến: Mọi bản vá sau này bắt buộc phải duy trì 0 type errors và 934/934 tests passed.
