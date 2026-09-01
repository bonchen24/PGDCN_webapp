# PCN UI Scrollbar and Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa vùng cuộn cho mọi page/modal PCN và thay các control danh mục phù hợp bằng select/combobox accessible mà không thay đổi payload nghiệp vụ.

**Architecture:** Giữ shell `main` là chủ sở hữu cuộn dọc cấp trang, dùng token CSS chung cho scrollbar/gutter, và dùng một `PcnCatalogCombobox` nhỏ cho danh mục dài. Modal giữ cấu trúc panel flex với header/footer cố định và body cuộn độc lập; các enum nhỏ vẫn dùng native `<select>`.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS v4, `lucide-react`, Node `node:test`, browser local runtime.

**Spec:** `docs/superpowers/specs/2026-09-01-pcn-ui-scrollbar-dropdown-design.md` và contract đã cập nhật trong `design.md` mục 0.3/5.3.

## Global Constraints

- Thay đổi chỉ thuộc UI/layout/accessibility và cách chọn giá trị; không thay đổi schema, API boundary, persistence, lifecycle, RBAC, format xuất file hoặc dữ liệu nghiệp vụ.
- Shell `main` là chủ sở hữu cuộn dọc cấp trang; page PCN giữ `pcn-page-surface min-w-0 min-h-full`.
- Modal dùng `min-h-0`, `max-h` theo viewport, header/footer `shrink-0`, body `mobile-scroll-y` và không để panel `overflow-hidden` nếu không có body scroll thay thế.
- Tập enum nhỏ dùng native `<select>`; danh mục dài dùng searchable combobox; chọn nhiều giữ checkbox/chip group.
- Không dùng `datalist` thay cho dropdown PCN và không tự phát minh catalog mới.
- Giữ vùng chạm mobile khoảng 44px và `aria-label`/`title` cho icon-only control.
- Không chỉnh schema, server boundary, tích hợp phòng thử, audit, lifecycle hoặc định dạng DOCX/PDF.
- Bảo toàn các thay đổi chưa commit hiện có trong worktree; chỉ stage file thuộc task đang làm.

### Task 1: Tạo test contract UI để khóa yêu cầu trước khi sửa

**Files:**
- Create: `test/pcn-ui-contract.test.ts`
- Test: `test/pcn-ui-contract.test.ts`

**Interfaces:**
- Consumes: source text của các PCN page/modal hiện có.
- Produces: các assertion tĩnh để task CSS/component sau phải làm cho pass.

- [ ] **Step 1: Viết test fail cho page/modal scroll contract**

Tạo test dùng `node:test`, `node:assert/strict`, `node:fs`, `node:path`, `node:url`. Resolve root từ `import.meta.url`, sau đó đọc:

```ts
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
```

Thêm các test:

```ts
test('PCN shell owns page scroll and reserves scrollbar gutter', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  const css = read('index.css');
  assert.match(workspace, /<main[^>]*mobile-scroll-y[^>]*overflow-x-hidden[^>]*overflow-y-auto/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
});

test('all PCN modal source files declare a viewport bound and scrollable body', () => {
  const files = [
    'components/PcnDossierDetailView.tsx',
    'components/PcnDocumentOutputModal.tsx',
    'components/PcnLabRequestView.tsx',
    'components/PcnIssuanceView.tsx',
    'components/PcnOperationalFormModal.tsx',
    'components/PcnSampleHandoverModal.tsx',
    'components/PcnTemplateSettingsModal.tsx',
    'components/PcnPersonalSettingsPanel.tsx',
    'components/PcnDossierFilePreview.tsx',
    'components/PcnLabRequestDetailModal.tsx',
    'components/PcnResultDetailModal.tsx',
  ];
  for (const file of files) {
    const source = read(file);
    assert.match(source, /max-h-\[/, file);
    assert.match(source, /mobile-scroll-y|overflow-auto/, file);
  }
});
```

Thêm assertion riêng cho nhánh read-only của `PcnApprovalModal` bằng cách lấy đoạn từ `if (current && !canAct)` tới `return` regular branch, rồi yêu cầu đoạn đó có `max-h-[...]`, `min-h-0` và `mobile-scroll-y`. Thêm assertion cho `PcnSignerDelegationPanel` yêu cầu modal có `max-h-[...]`, `min-h-0` và `mobile-scroll-y`.

- [ ] **Step 2: Viết test fail cho dropdown contract**

Trong cùng file thêm:

```ts
test('proposal customer field uses a dropdown component instead of datalist', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  assert.doesNotMatch(workspace, /<datalist[^>]*pcn-customer-options/);
  assert.match(workspace, /PcnCatalogCombobox/);
});

test('lab request laboratory field uses the configured catalog control', () => {
  const source = read('components/PcnLabRequestView.tsx');
  assert.match(source, /PCN_SAMPLE_LAB_OPTIONS/);
  assert.match(source, /Phòng thử nghiệm nhận[^]*<select/);
});
```

- [ ] **Step 3: Chạy riêng test để xác nhận baseline fail**

Run: `node --test test/pcn-ui-contract.test.ts`

Expected: FAIL vì `PcnApprovalModal` read-only branch, `PcnSignerDelegationPanel`, customer `datalist` và CSS gutter chưa đáp ứng contract.

- [ ] **Step 4: Commit test contract**

```bash
git add test/pcn-ui-contract.test.ts
git commit -m "test: lock PCN UI scroll and dropdown contracts"
```

### Task 2: Hoàn thiện token CSS và contract cuộn cấp shell/page

**Files:**
- Modify: `index.css:275-335`
- Modify: `components/PcnWorkspace.tsx:805-815`
- Test: `test/pcn-ui-contract.test.ts`

**Interfaces:**
- Consumes: `mobile-scroll-x`, `mobile-scroll-y`, `pcn-page-surface`, `mobile-safe-bottom` hiện có.
- Produces: class contract dùng chung; không tạo API runtime mới.

- [ ] **Step 1: Bổ sung token CSS cho gutter và scrollbar PCN**

Trong `index.css`, tạo custom property trong `@layer components`:

```css
:root {
  --pcn-scrollbar-thumb: #94a3b8;
  --pcn-scrollbar-track: transparent;
}
```

Áp dụng `scrollbar-gutter: stable` cho `.mobile-scroll-y` và các surface `.pcn-compact .overflow-y-auto`. Dùng property mới cho `scrollbar-color` và `::-webkit-scrollbar-thumb`; giữ `overflow-x: hidden` trên vùng dọc và momentum scrolling. Không chỉnh `body` thành vùng scroll mới.

- [ ] **Step 2: Kiểm tra shell main giữ đúng owner scroll**

Giữ `main` trong `PcnWorkspace` là:

```tsx
<main className="min-h-0 min-w-0 flex-1 mobile-scroll-y overflow-x-hidden overflow-y-auto">
  {content}
</main>
```

Chỉ bổ sung `scrollbar-gutter` qua CSS; không thêm `h-full overflow-y-auto` cho từng page. Kiểm tra các page hiện có vẫn có `pcn-page-surface min-w-0` và bottom padding ở mobile.

- [ ] **Step 3: Chạy test contract**

Run: `node --test test/pcn-ui-contract.test.ts`

Expected: assertion CSS/page pass; modal/dropdown assertions vẫn fail cho các task chưa làm.

- [ ] **Step 4: Commit CSS contract**

```bash
git add index.css components/PcnWorkspace.tsx
git commit -m "fix: stabilize PCN page scrollbar contract"
```

### Task 3: Xây searchable catalog combobox accessible dùng chung

**Files:**
- Create: `components/PcnCatalogCombobox.tsx`
- Modify: `test/pcn-ui-contract.test.ts`
- Test: `test/pcn-ui-contract.test.ts`

**Interfaces:**
- Consumes: option code/label từ PCN snapshot/config.
- Produces: `PcnCatalogOption` và `PcnCatalogCombobox` cho các danh mục dài.

Định nghĩa interface ổn định:

```ts
export type PcnCatalogOption = {
  value: string;
  label: string;
  searchText?: string;
  description?: string;
  disabled?: boolean;
};

export type PcnCatalogComboboxProps = {
  id: string;
  label: string;
  value: string;
  options: readonly PcnCatalogOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  unmatchedOption?: PcnCatalogOption;
};
```

- [ ] **Step 1: Ghi assertion source cho accessibility contract**

Thêm test kiểm tra component có `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `role="listbox"`, `role="option"`, xử lý `Escape`, `ArrowDown`, `Enter`, và vùng list có `max-h` + `overflow-y-auto`.

- [ ] **Step 2: Implement component tối thiểu**

Component phải:

1. Hiển thị label và input với value label của option đang chọn.
2. Khi focus/click mở list; khi gõ lọc theo `label`, `value`, `searchText`, `description` không phân biệt hoa thường.
3. Chọn option gọi `onChange(option.value)`, đóng list và trả focus về input.
4. `Escape` đóng list, `ArrowDown` mở list, `Enter` chọn option đầu tiên khi list mở.
5. Có nút mở/đóng và nút xóa giá trị với `aria-label`, vùng chạm tối thiểu 44px trên mobile.
6. Khi `unmatchedOption` tồn tại và value không thuộc option chuẩn, hiển thị option đó với nhãn “Giá trị hiện tại cần rà soát”, không xóa value.
7. Popup dùng `absolute z-50 max-h-64 overflow-y-auto mobile-scroll-y`, nằm trong wrapper `relative`, không khóa scroll body.

Không cho phép Enter tạo option mới; danh mục PCN chỉ chọn giá trị đã có hoặc giữ unmatched legacy option.

- [ ] **Step 3: Chạy test source contract**

Run: `node --test test/pcn-ui-contract.test.ts`

Expected: combobox accessibility assertions pass; integration assertions cho `PcnWorkspace` còn fail.

- [ ] **Step 4: Commit combobox**

```bash
git add components/PcnCatalogCombobox.tsx test/pcn-ui-contract.test.ts
git commit -m "feat: add accessible PCN catalog combobox"
```

### Task 4: Tích hợp dropdown cho Đề nghị, PYC và các option hiện có

**Files:**
- Modify: `components/PcnWorkspace.tsx:1-560`
- Modify: `components/PcnLabRequestView.tsx:1-285`
- Modify: `components/PcnSampleFlowView.tsx:190-290` (chỉ khi field đã có catalog)
- Modify: `components/PcnDraftingWorkspaceView.tsx:1-120` (chỉ rà soát source/kind đã có)
- Modify: `components/PcnUserManagementView.tsx:225-255` (chỉ rà soát, không đổi control đã đúng)
- Test: `test/pcn-ui-contract.test.ts`

**Interfaces:**
- Consumes: `PcnCatalogCombobox`, `PcnCatalogOption`, `customers`, `PCN_SAMPLE_LAB_OPTIONS`, field/role/options hiện có.
- Produces: cùng `PcnProposalForm`, `OutboundLabRequest` và các payload hiện tại; chỉ thay cách chọn UI.

- [ ] **Step 1: Tạo option khách hàng từ snapshot PCN**

Trong `ProposalView`, tạo option theo:

```ts
const customerOptions = customers.map((customer) => ({
  value: customer.customerCode || customer.name,
  label: [customer.customerCode, customer.name].filter(Boolean).join(' — '),
  searchText: [customer.customerCode, customer.name, customer.taxId, customer.contactPerson].filter(Boolean).join(' '),
}));
```

Giữ handler auto-fill hiện tại: khi chọn option, tìm customer theo `customerCode || name`, set `customerId`, `customerName`, `address`, `contactPerson`, `taxId`, `phone`, `email`. Nếu đang sửa snapshot không còn trong catalog, truyền `unmatchedOption` với value hiện tại và giữ nguyên các trường snapshot.

- [ ] **Step 2: Thay `datalist` khách hàng bằng `PcnCatalogCombobox`**

Thay block `<input list="pcn-customer-options">...</datalist>` bằng:

```tsx
<PcnCatalogCombobox
  id="pcn-customer"
  label="Khách hàng *"
  value={form.customerId || form.customerName}
  options={customerOptions}
  unmatchedOption={legacyCustomerOption}
  onChange={handleCustomerSelection}
  required
  invalid={Boolean(validationErrors['customerSnapshot.name'])}
  placeholder="Tìm mã hoặc tên khách hàng..."
/>
```

Giữ `Field` error hiện tại ở cạnh control nếu `Field` wrapper cần tiếp tục render lỗi; không để người dùng gõ tên tự do để tạo khách hàng ngoài danh mục. Nút thêm khách hàng vẫn đi qua màn hình Danh sách khách hàng, không thêm mutation mới trong combobox.

- [ ] **Step 3: Chuẩn hóa field enum trong form Đề nghị**

Giữ native select cho `channel` và `qc20Scope.lotDefinition`; giữ checkbox/chip group cho `fieldCodes` vì đây là chọn nhiều. Không đổi input của mã Đề nghị, tên sản phẩm, model, nhãn hiệu, nhà sản xuất, địa chỉ, tiêu chuẩn, thông số hoặc ghi chú vì chưa có catalog PCN được định nghĩa.

- [ ] **Step 4: Dùng catalog phòng thử trong PYC**

Import `PCN_SAMPLE_LAB_OPTIONS` trong `PcnLabRequestView`. Thay input `laboratoryName` bằng native select hiển thị option từ `PCN_SAMPLE_LAB_OPTIONS`, nhưng khi route đã chọn thì tiếp tục set `laboratoryName` bằng `route.labName` hiện tại để giữ payload. Nếu giá trị dữ liệu cũ không khớp option, thêm option disabled/read-only “Giá trị hiện tại cần rà soát” và không xóa nó.

Không đổi `OutboundLabRequest.laboratoryName` thành `labCode`; đây là UI-only mapping.

- [ ] **Step 5: Rà soát các page còn lại theo nguyên tắc catalog**

Giữ các select đã có ở user management, issuance, drafting, dossier, result và sample route. Chỉ thay input nếu option đã có thật trong `types.ts`, snapshot hoặc settings. Không biến mã lô, model, mã mẫu, tiêu chuẩn, ghi chú, địa chỉ, người giao/nhận hoặc mô tả thành select khi chưa có catalog.

- [ ] **Step 6: Chạy test và typecheck**

Run: `node --test test/pcn-ui-contract.test.ts`

Expected: customer no longer uses `datalist`; PYC laboratory field uses configured select; tests pass except modal assertions chưa hoàn tất nếu Task 5 chưa chạy.

Run: `npm run lint`

Expected: TypeScript compile succeeds.

- [ ] **Step 7: Commit dropdown integration**

```bash
git add components/PcnWorkspace.tsx components/PcnLabRequestView.tsx components/PcnSampleFlowView.tsx components/PcnDraftingWorkspaceView.tsx components/PcnUserManagementView.tsx test/pcn-ui-contract.test.ts
git commit -m "fix: use PCN catalog controls for common fields"
```

### Task 5: Migrate every PCN modal branch to fixed-header/footer + scroll body

**Files:**
- Modify: `components/PcnApprovalModal.tsx:55-78`
- Modify: `components/PcnSignerDelegationPanel.tsx:111-112`
- Modify: `components/PcnTemplateSettingsModal.tsx:35-65` (add `min-h-0`/flex panel if required by audit)
- Modify: `components/PcnPersonalSettingsPanel.tsx:104-170` (split header/body/footer if required by audit)
- Modify: any file from the modal list in Task 1 that fails the contract test
- Test: `test/pcn-ui-contract.test.ts`

**Interfaces:**
- Consumes: `mobile-scroll-y`, `max-h` and mobile bottom-sheet layout already used by existing PCN modals.
- Produces: consistent modal DOM/layout; handlers, labels, payloads and business actions remain unchanged.

- [ ] **Step 1: Fix read-only Approval branch**

Replace the read-only panel shape with:

```tsx
<section className="flex min-h-0 max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
  <header className="shrink-0 ...">...</header>
  <main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto p-4">
    ...evidence and denial content...
  </main>
</section>
```

Keep the existing `onClose` and `onOpenDossier` handlers. Do not add approval mutations to this branch.

- [ ] **Step 2: Fix signer delegation modal**

Change the inline `<form>` to a flex panel:

```tsx
<form className="flex min-h-0 max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
  <header className="shrink-0 ...">...</header>
  <div className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto p-4">
    ...fields...
  </div>
  <footer className="shrink-0 border-t ...">...buttons...</footer>
</form>
```

Move only the existing field content into the body and the existing Hủy/Lưu buttons into footer. Keep select values and `submit` unchanged.

- [ ] **Step 3: Normalize any remaining modal exceptions found by the test**

For each failing modal, apply the same rules:

```tsx
<div className="fixed inset-0 ...">
  <section className="flex min-h-0 max-h-[94dvh] flex-col overflow-hidden ...">
    <header className="shrink-0 ..." />
    <main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto ..." />
    <footer className="shrink-0 ..." />
  </section>
</div>
```

For read-only modals without footer actions, the body remains the scroll owner and the close control stays in the fixed header. Do not add nested vertical scroll to a page surface unless it is an independent data table/preview.

- [ ] **Step 4: Run contract test and typecheck**

Run: `node --test test/pcn-ui-contract.test.ts`

Expected: PASS for shell, all modal sources, read-only Approval branch, delegation modal and dropdown contract.

Run: `npm run lint`

Expected: PASS with no new TypeScript errors.

- [ ] **Step 5: Commit modal contract**

```bash
git add components/PcnApprovalModal.tsx components/PcnSignerDelegationPanel.tsx components/PcnTemplateSettingsModal.tsx components/PcnPersonalSettingsPanel.tsx test/pcn-ui-contract.test.ts
git commit -m "fix: make PCN modal bodies independently scrollable"
```

### Task 6: Browser verification and full regression checks

**Files:**
- Modify: only files required by verification findings.
- Test: `test/pcn-ui-contract.test.ts` and existing PCN suite.

**Interfaces:**
- Consumes: completed shell/modal/dropdown implementation.
- Produces: verified responsive/accessibility behavior and a clean handoff report.

- [ ] **Step 1: Start the PCN runtime**

Run: `npm run dev:pcn`

Expected: server reports the local PCN URL and remains running for browser checks.

- [ ] **Step 2: Verify desktop shell and page scroll**

Open the local PCN URL. After authentication is available, check Dashboard, Đề nghị, PYC & luân chuyển mẫu, Sổ điều hành, Soạn thảo, Nhân sự and Cài đặt. Confirm the page scrollbar belongs to shell `main`, the last content is reachable, and no horizontal overflow reaches `body`.

- [ ] **Step 3: Verify modal scroll and footer reachability**

Open a long operational form, approval read-only branch, signer delegation modal, dossier detail, document output, file preview and result/lab detail. Confirm header/close stays visible, body scroll reaches the end, footer buttons remain clickable, and 320px viewport does not clip the action row.

- [ ] **Step 4: Verify dropdown behavior**

Check customer combobox by click, typing, ArrowDown, Enter, Escape, clear and no-result state. Confirm selecting a customer fills the existing snapshot fields. Check laboratory select, field/status/role/outcome selects, and any unmatched legacy option. Confirm no PCN runtime customer `datalist` remains.

- [ ] **Step 5: Verify required viewports**

Use viewport widths 320, 375, 390, 430 and a desktop width. At each width check modal scroll, page bottom padding, mobile nav, touch target size, dropdown popup visibility and horizontal table/workflow scroll.

- [ ] **Step 6: Run automated checks**

Run:

```bash
node --test test/pcn-ui-contract.test.ts
npm run test:pcn
npm run lint
git diff --check
```

Expected: all commands pass; any pre-existing unrelated failures are recorded separately and not masked.

- [ ] **Step 7: Inspect final diff and status**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

Confirm only intended UI files and test/plan/spec changes are present; do not stage or revert the existing unrelated worktree changes.

## Traceability

| Spec requirement | Plan task |
| --- | --- |
| Shell owns page scroll and no page overflow | Tasks 1–2 |
| Scrollbar thumb/gutter contract | Task 2 |
| Modal body scroll in every render branch | Tasks 1 and 5 |
| Native select for bounded enums | Task 4 |
| Searchable customer/catalog dropdown | Tasks 3–4 |
| Legacy unmatched value preservation | Tasks 3–4 |
| Mobile 320–430px and desktop verification | Task 6 |
| No schema/API/business logic changes | Global Constraints, Tasks 4–5 |
