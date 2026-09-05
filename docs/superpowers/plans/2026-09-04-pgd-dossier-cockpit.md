# PGD Dossier Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến PGD thành workspace vận hành theo từng PYC, trong đó bốn trạm Hiện trường, PTN, Báo cáo và Soạn thảo đều có bộ chọn hồ sơ, form nghiệp vụ và trạng thái lưu thực; Cài đặt DOCX là modal độc lập.

**Architecture:** Giữ `PgdInspectionRequest` và các collection PGD hiện có làm nguồn dữ liệu duy nhất. Tạo một shell trạm dùng chung để chọn đúng PYC, hiển thị snapshot/workflow và ủy quyền nội dung cho các panel theo trạm; card hồ sơ đầy đủ vẫn là bề mặt thao tác chuẩn và tái sử dụng các panel này. Quản trị template DOCX được chuyển khỏi settings chung sang modal cục bộ của workspace Soạn thảo.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Zustand, Tailwind CSS, `lucide-react`, Node `node:test` contract tests, DOCX generation hiện có qua `docxtemplater`/`PgdTableFieldEditor`.

**Spec:** `docs/superpowers/specs/2026-09-04-pgd-dossier-cockpit-design.md` và các mục `0A.3–0A.9` trong `design.md`.

## Global Constraints

- Mỗi PYC là một bộ hồ sơ PGD duy nhất; các trang trạm chỉ là workspace/projection dẫn về cùng hồ sơ, không tạo collection dữ liệu riêng.
- Mọi record/tài liệu mới mang `domain=pgd` và đi qua boundary `/api/pgd/*`.
- `QC20` không xuất hiện trong catalog, bộ lọc hay form PGD; runtime mở đủ `GĐ-THEP-KG`, `GĐ-THEP-TT58`, `GĐ-MAY-01`, `GĐ-THAN-01`, `GĐ-NGOAI-01` và `GĐ-HH-01`.
- Không có runtime watcher/import/scan folder; không đọc Desktop/UNC trong runtime.
- Không hiển thị các trường phí thử nghiệm, khách hàng trả trước, còn lại, báo giá hoặc thanh toán.
- Template DOCX chỉ được quản lý trong modal **Cài đặt DOCX** của workspace Soạn thảo; **Cài đặt hệ thống** chỉ quản lý nhân sự và cấu hình dùng chung.
- Sau `SIGNED`, `RESULT_RETURNED` hoặc `ARCHIVED`, các form và template snapshot bị khóa theo policy server hiện có.
- Giữ thay đổi người dùng đang có trong working tree; chỉ sửa các file được nêu ở từng task và không reset/checkout file khác.

---

### Task 1: Chuẩn hóa navigation và modal Cài đặt DOCX

**Files:**
- Create: `components/PgdDocxSettingsModal.tsx`
- Modify: `components/PgdDocumentGenerationPanel.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PgdSidebar.tsx`
- Modify: `components/PgdcnAppShell.tsx`
- Modify: `components/PgdcnSystemSettingsView.tsx`
- Test: `test/pgd-drafting-navigation.test.ts`
- Test: `test/pgdcn-docx-settings-navigation.test.ts`

**Interfaces:**
- `PgdDocxSettingsModalProps = { open: boolean; onClose: () => void; templates: PgdDocumentTemplate[]; canMutate: boolean }`.
- `PgdDocxSettingsModal` renders `PgdTemplateSettingsWorkspace` inside `role="dialog"`, with no route navigation.
- `PgdTemplateWorkspace` and `PgdDocumentGenerationPanel` receive `onOpenSettings?: () => void` and only invoke it locally.
- `PgdcnSystemSettingsViewProps` no longer contains `pgdTemplates`; `PgdcnAppShell` no longer passes `pgd.documentTemplates` to system settings.
- `PgdSection` contains only `dashboard | requests | preparation | field | labs | results | templates`; `intake` is a compatibility input that opens the request modal, not a sidebar item.

- [x] **Step 1: Write the failing navigation tests**

```ts
test('DOCX settings is a local modal and not shared system settings', () => {
  const generation = read('components/PgdDocumentGenerationPanel.tsx');
  const modal = read('components/PgdDocxSettingsModal.tsx');
  const system = read('components/PgdcnSystemSettingsView.tsx');
  const shell = read('components/PgdcnAppShell.tsx');
  assert.match(generation, /onOpenSettings/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /PgdTemplateSettingsWorkspace/);
  assert.doesNotMatch(system, /PgdTemplateSettingsWorkspace/);
  assert.doesNotMatch(shell, /pgdTemplates=\{pgd\.documentTemplates\}/);
});

test('PGD sidebar exposes operational stations without settings routes', () => {
  const sidebar = read('components/PgdSidebar.tsx');
  assert.match(sidebar, /preparation/);
  assert.doesNotMatch(sidebar, /settings:|users:|customers:/);
  assert.doesNotMatch(sidebar, /Cài đặt DOCX/);
});
```

- [x] **Step 2: Run the focused tests and confirm failure**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-drafting-navigation.test.ts test/pgdcn-docx-settings-navigation.test.ts`

Expected: FAIL because system settings still renders `PgdTemplateSettingsWorkspace` and PGD still resolves `settings`.

- [x] **Step 3: Implement the local modal and remove DOCX ownership from system settings**

```tsx
export default function PgdDocxSettingsModal({ open, onClose, templates, canMutate }: PgdDocxSettingsModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 md:p-6" role="dialog" aria-modal="true" aria-label="Cài đặt DOCX">
      <section className="my-2 w-full max-w-6xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:my-4">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div><div className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Template DOCX</div><h2 className="mt-0.5 text-sm font-black text-slate-900">Cài đặt DOCX</h2></div>
          <button type="button" aria-label="Đóng Cài đặt DOCX" onClick={onClose}>Đóng</button>
        </header>
        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto"><PgdTemplateSettingsWorkspace templates={templates} canMutate={canMutate} /></div>
      </section>
    </div>
  );
}
```

Change `PgdWorkspace` to hold `docxSettingsOpen` and pass `() => setDocxSettingsOpen(true)` to `PgdTemplateWorkspace`/generation panels. Remove the `activeSection === 'settings'` branch and map `settings` from legacy callers to `templates` without adding a sidebar button. Remove the PGD template section and prop from `PgdcnSystemSettingsView`; keep personnel, PCN configuration, password and role assignment there.

- [x] **Step 4: Replace PGD sidebar items and shared-shell compatibility mapping**

Use this operational list in both legacy and shared navigation:

```ts
const PGD_OPERATIONAL_SECTIONS: PgdSection[] = ['dashboard', 'requests', 'preparation', 'field', 'labs', 'results', 'templates'];
```

Labels must include `Chuẩn bị & Phân công`, `Hiện trường & Lấy mẫu`, `PTN & Kết quả`, `Báo cáo, Chứng thư & Lưu trữ`, and `Soạn thảo tài liệu`. `getSharedTargetForPgdSection` must only redirect `dashboard`, `customers`, `users` and compatibility `intake`; it must not redirect `settings` because settings is no longer a PGD route.

- [x] **Step 5: Run focused tests and typecheck**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-drafting-navigation.test.ts test/pgdcn-docx-settings-navigation.test.ts`

Expected: PASS. Then run: `npm run lint` and expect no TypeScript errors.

- [ ] **Step 6: Commit the isolated task changes**

```bash
git add components/PgdDocxSettingsModal.tsx components/PgdDocumentGenerationPanel.tsx components/PgdWorkspace.tsx components/PgdSidebar.tsx components/PgdcnAppShell.tsx components/PgdcnSystemSettingsView.tsx test/pgd-drafting-navigation.test.ts test/pgdcn-docx-settings-navigation.test.ts
git commit -m "feat: isolate PGD DOCX settings modal"
```

### Task 2: Tạo bộ chọn hồ sơ và khung trạm dùng chung

**Files:**
- Create: `components/PgdDossierSelector.tsx`
- Create: `components/PgdOperationalStationWorkspace.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PgdSidebar.tsx`
- Test: `test/pgd-operational-stations-ui.test.ts`

**Interfaces:**
- `PgdDossierSelectorProps = { requests: PgdInspectionRequest[]; selectedRequestId?: string; onSelect: (requestId: string) => void; group?: PgdInspectionRequestInput['productGroup'] | 'ALL'; onGroupChange?: (group: PgdInspectionRequestInput['productGroup'] | 'ALL') => void; status?: PgdInspectionStatus | 'ALL'; onStatusChange?: (status: PgdInspectionStatus | 'ALL') => void; label?: string }`.
- `PgdOperationalStationWorkspaceProps = { station: PgdOperationalStationKey; requests: PgdInspectionRequest[]; selectedRequestId?: string; onSelectRequest: (requestId: string) => void; onOpenFullDossier: (requestId: string) => void; children: (request: PgdInspectionRequest) => React.ReactNode; getEvidence: (requestId: string) => PgdTransitionContext }`.
- The workspace renders `aria-label="Bộ chọn hồ sơ PGD"`, a selected dossier summary, station title, workflow stepper from `PGD_OPERATIONAL_STATIONS`, and `children(request)` only after a request is selected.

- [x] **Step 1: Write failing selector/station tests**

```ts
test('each operational station has dossier selection and current-dossier workspace contract', () => {
  const workspace = read('components/PgdOperationalStationWorkspace.tsx');
  for (const marker of ['Bộ chọn hồ sơ PGD', 'PgdInspectionRequest', 'PGD_OPERATIONAL_STATIONS', 'Mở hồ sơ đầy đủ']) assert.match(workspace, new RegExp(marker));
  for (const station of ['preparation', 'field', 'labs', 'results']) assert.match(read('components/PgdWorkspace.tsx'), new RegExp(`activeSection === '\${station}'`));
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-operational-stations-ui.test.ts`

Expected: FAIL because the shared selector/workspace files and station branches do not exist.

- [x] **Step 3: Implement selector and station shell**

The selector must filter by request code, registration number, customer, product, lot, location and method. It must display one compact row/card per PYC with status, owner, product group and next station. The shell must keep the selector visible above the form, not hide it inside the full dossier modal.

```tsx
const selectedRequest = requests.find((request) => request.id === selectedRequestId);
return <div className="space-y-3 p-3 md:p-5">
  <PgdDossierSelector requests={requests} selectedRequestId={selectedRequestId} onSelect={onSelectRequest} />
  {selectedRequest ? <>
    <PgdDossierSummary request={selectedRequest} />
    <PgdWorkflowMap status={selectedRequest.status} evidence={getEvidence(selectedRequest.id)} />
    <section aria-label={`Trạm \${getPgdOperationalStationByKey(station).title}`}>{children(selectedRequest)}</section>
    <button type="button" onClick={() => onOpenFullDossier(selectedRequest.id)}>Mở hồ sơ đầy đủ</button>
  </> : <EmptySelection state="Chưa chọn hồ sơ PGD" />}
</div>;
```

Keep `PgdDossierSummary` and `EmptySelection` as private presentational components in this file. If the existing `PgdWorkflowMap` is private to `PgdWorkspace`, move it to the new shell or export it; do not duplicate a second workflow definition.

- [x] **Step 4: Integrate station branches into `PgdWorkspace`**

Keep `requests` as the register page. Render the new shell for `preparation`, `field`, `labs` and `results`, passing a station-specific child panel placeholder that is replaced in Task 3. Keep `templates` as the Soạn thảo page with its own PYC selector. The selected request state must be shared by the current page and full dossier modal.

- [x] **Step 5: Run focused tests and typecheck**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-operational-stations-ui.test.ts test/pgd-register-ui.test.ts` and then `npm run lint`.

Expected: PASS with all station branches present and no new type errors.

- [ ] **Step 6: Commit the isolated task changes**

```bash
git add components/PgdDossierSelector.tsx components/PgdOperationalStationWorkspace.tsx components/PgdWorkspace.tsx components/PgdSidebar.tsx test/pgd-operational-stations-ui.test.ts
git commit -m "feat: add PGD dossier station workspace"
```

### Task 3: Đưa form nguồn vào bốn trạm nghiệp vụ

**Files:**
- Create: `components/PgdPreparationStationPanel.tsx`
- Create: `components/PgdFieldStationPanel.tsx`
- Create: `components/PgdLabStationPanel.tsx`
- Create: `components/PgdResultsStationPanel.tsx`
- Modify: `components/PgdSourceFormsPanel.tsx`
- Modify: `components/PgdCaseEvidencePanel.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Test: `test/pgd-station-forms-ui.test.ts`

**Interfaces:**
- Each panel receives `{ request: PgdInspectionRequest; currentUser: PcnUserAccount; canMutate: boolean; onOpenFullDossier?: () => void }`.
- `PgdPreparationStationPanel` writes `saveAssignment` and `saveInspectionPlan`.
- `PgdFieldStationPanel` writes `saveFieldInspection`, `saveCaseEvent`, `saveFieldActivityLog`, `splitSample`, and renders checklist/sample evidence.
- `PgdLabStationPanel` writes `saveLabRequest` and `saveLabResult`, renders LAB/RETAINED sample rows and missing-result alerts.
- `PgdResultsStationPanel` writes `saveLabResultReview`, `saveReport`, `saveCertificate`, `approveStep`, and renders dossier index/approval state.
- All panels use `getPgdOperationalStepAccess` and `getPgdPostSignatureMutationDenial`; no panel bypasses server-backed mutation methods.

- [x] **Step 1: Write failing form contract tests**

```ts
test('PGD station panels expose source-derived forms and no payment fields', () => {
  const files = ['PgdPreparationStationPanel.tsx', 'PgdFieldStationPanel.tsx', 'PgdLabStationPanel.tsx', 'PgdResultsStationPanel.tsx'];
  const source = files.map((file) => read(`components/\${file}`)).join('\\n');
  for (const marker of ['Kế hoạch & phân công', 'Biên bản kiểm tra tại hiện trường', 'Diễn biến vụ giám định', 'Tách LAB', 'Mẫu lưu', 'Phiếu yêu cầu PTN', 'Tiếp nhận KQTN', 'Đánh giá KQTN', 'Báo cáo giám định', 'Chứng thư giám định', 'Duyệt kỹ thuật']) assert.match(source, new RegExp(marker));
  assert.doesNotMatch(source, /Báo giá|Thanh toán|Phí thử nghiệm|Khách hàng trả trước|Còn lại/);
});

test('PGD station panels keep repeatable tables as structured editors', () => {
  const source = read('components/PgdFieldStationPanel.tsx') + read('components/PgdLabStationPanel.tsx') + read('components/PgdResultsStationPanel.tsx');
  assert.match(source, /PgdTableFieldEditor|Thêm dòng/);
  assert.doesNotMatch(source, /JSON\\.stringify|textarea[^>]+json/i);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-station-forms-ui.test.ts`

Expected: FAIL because the four panel files do not exist.

- [x] **Step 3: Extract preparation forms from the current request card**

Move assignment state/handlers from `PgdRequestDetail` into `PgdPreparationStationPanel`. The panel must show inspector usernames, technical reviewer, approval state, inspection date, activity/schedule and product lines. Use the existing `PgdSourceFormsPanel` plan builder only after the assignment is saved, so the plan snapshot uses the current team.

- [x] **Step 4: Build the field station from the surveyed TT58/BM-GĐ fields**

Render structured inputs for lot observation, packaging, preservation, labeling, dimensions/measurements, nonconformities, customer representative and conclusion. Render `PgdSourceFormsPanel` sections for timeline, morning/afternoon field log, plan-derived evidence and dossier index where appropriate. Render `PgdCaseEvidencePanel` for checklist, document upload, sample register and retained sample lifecycle. Use a repeatable sample-line editor with columns `description`, `lotQuantity`, `quantity`, `sampleSize`, `sampleCode`, `destination`, `sealNumber` and `note` before invoking `splitSample`.

- [x] **Step 5: Build the lab station from TT58 PYC PTN and handover forms**

Render one table row per current sample and separate destination badges `LAB`/`RETAINED`. The handover form must include laboratory name/code, sender, receiver, sent time, sample code, quantity, test items and test methods. The result form must include report number/date, linked lab request and conclusion. Show `role="alert"` when any current `PgdLabRequest` has no `resultId`, or when a result references an unknown request/sample. Exclude every source payment field from JSX and state.

- [x] **Step 6: Build the results station from result review and certificate forms**

Render completeness, conformity, missing items, nonconformities, recommendation and conclusion from `PgdLabResultReview`; render dynamic result cells from the active `PgdResultTemplate` and use `PgdTableFieldEditor` for table cells. Show report/certificate snapshot status, standard snapshot, approval buttons and the dossier index/package controls. Disable result mutations until KQTN exists and disable approval until report/certificate gates pass.

- [x] **Step 7: Integrate the panels and preserve full dossier composition**

Replace the Task 2 station placeholders with the four panels. Refactor `PgdRequestDetail` to compose the same panels where practical; if a card-only control remains, it must call the same store action and use the same access helper. Do not create a second form contract for the modal.

- [x] **Step 8: Run focused tests and typecheck**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-station-forms-ui.test.ts test/pgd-source-forms-ui.test.ts test/pgd-dossier-operations-ui.test.ts test/pgd-product-group-specifics.test.ts` and then `npm run lint`.

Expected: PASS; source-derived form markers are present, payment fields are absent, and existing dossier operations remain available.

- [ ] **Step 9: Commit the isolated task changes**

```bash
git add components/PgdPreparationStationPanel.tsx components/PgdFieldStationPanel.tsx components/PgdLabStationPanel.tsx components/PgdResultsStationPanel.tsx components/PgdSourceFormsPanel.tsx components/PgdCaseEvidencePanel.tsx components/PgdWorkspace.tsx test/pgd-station-forms-ui.test.ts
git commit -m "feat: add PGD operational station forms"
```

### Task 4: Hoàn thiện Soạn thảo tài liệu, cell và boundary hệ thống

**Files:**
- Modify: `components/PgdDocumentGenerationPanel.tsx`
- Modify: `components/PgdTableFieldEditor.tsx`
- Modify: `components/PgdCellManager.tsx`
- Modify: `utils/pgdDocumentTemplates.ts`
- Modify: `components/PgdWorkspace.tsx`
- Test: `test/pgd-document-templates.test.ts`
- Test: `test/pgd-docx-template-pack.test.ts`
- Test: `test/pgd-drafting-navigation.test.ts`

**Interfaces:**
- `PgdTemplateWorkspace` always renders a PYC selector and passes its local `onOpenSettings` to the modal from Task 1.
- `PgdTableFieldEditor` continues accepting `value: unknown` and returning `Record<string, PgdTableScalar>[]`; it must render table columns from `PgdTemplateCell.tableColumns`.
- `PgdCellManager` remains the template cell admin editor, but is reachable only from the modal/template management flow and respects template version locking.

- [x] **Step 1: Add failing template/cell assertions**

```ts
test('drafting workspace keeps dossier selection and opens local DOCX settings', () => {
  const source = read('components/PgdDocumentGenerationPanel.tsx');
  assert.match(source, /Chọn hồ sơ để soạn tài liệu/);
  assert.match(source, /onOpenSettings/);
  assert.match(source, /PgdTableFieldEditor/);
});

test('PGD templates keep repeatable source-derived tables', () => {
  const source = read('utils/pgdDocumentTemplates.ts');
  for (const key of ['productLines', 'sampleRows', 'handoverRows', 'labResultRows', 'dossierEntries']) assert.match(source, new RegExp(key));
  assert.doesNotMatch(source, /QC20.*productGroup|productGroup.*QC20/);
});
```

- [x] **Step 2: Run focused template tests and confirm failure where applicable**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-document-templates.test.ts test/pgd-docx-template-pack.test.ts test/pgd-drafting-navigation.test.ts`

Expected: any remaining assertions identify missing local-modal wiring or table/cell gaps; do not weaken assertions to make them pass.

- [x] **Step 3: Finish field grouping and table editor behavior**

Group scalar fields by `sectionCode` with headings for identity, customer, product, criteria, sampling, documents, results, approval and signatures. Keep table cells full-width. Ensure add/remove row operations obey `minRows`/`maxRows`, column labels and type mapping. Keep generation payload as structured arrays; never expose raw JSON input.

- [x] **Step 4: Verify template availability and snapshots**

Make the template selector filter by active product group and exclude retired templates. Keep `GĐ-THEP-KG`, `GĐ-THEP-TT58`, `GĐ-MAY-01`, `GĐ-THAN-01`, `GĐ-NGOAI-01` and `GĐ-HH-01` scoped correctly. Ensure generated document metadata retains template id/version, context hash, source pointers and PGD domain; changing a template from the modal creates a new version instead of mutating a published snapshot.

- [x] **Step 5: Run focused tests and typecheck**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-document-templates.test.ts test/pgd-docx-template-pack.test.ts test/pgd-drafting-navigation.test.ts` and then `npm run lint`.

Expected: PASS with local settings behavior, structured table cells and template lineage assertions.

- [ ] **Step 6: Commit the isolated task changes**

```bash
git add components/PgdDocumentGenerationPanel.tsx components/PgdTableFieldEditor.tsx components/PgdCellManager.tsx utils/pgdDocumentTemplates.ts components/PgdWorkspace.tsx test/pgd-document-templates.test.ts test/pgd-docx-template-pack.test.ts test/pgd-drafting-navigation.test.ts
git commit -m "feat: complete PGD drafting and cell workflow"
```

### Task 5: Regression, runtime boundary and production verification

**Files:**
- Modify: `design.md` only if implementation wording differs from the approved design.
- Modify: `PROJECT_MEMORY.md` with verified implementation and source-audit notes.
- Create: `obsidian-vault/2026-09-04 - PCN_webapp - PGD dossier cockpit implementation.md`
- Test: all existing `test/*.test.ts` included by `npm run test:pcn` and targeted PGD tests.

**Interfaces:**
- No new runtime interface; this task verifies the interfaces from Tasks 1–4.
- Production check uses existing Docker/Next commands and must not read Desktop/UNC.

- [x] **Step 1: Run all active PCN/PGD tests**

Run: `npm run test:pcn`

Expected: PASS with no regressions in shared dashboard, system settings, PCN/PGD separation, template generation, dossier checklist and sample lifecycle.

- [x] **Step 2: Run full TypeScript validation and diff checks**

Run: `npm run lint` and `git diff --check`.

Expected: both exit 0. Confirm with `rg -n "Desktop|UNC|QC20|Báo giá|Thanh toán|Phí thử nghiệm" components utils app` that no new runtime PGD code introduces forbidden source/payment/QC20 references; allowed design/test boundary text may remain.

- [x] **Step 3: Build production**

Run: `npm run build`.

Expected: Next production build completes without type, route or static-generation errors. Do not modify or delete source Desktop/UNC files.

- [ ] **Step 4: Run UI smoke checks**

Open `/pgdcn/pgd` and verify:

1. PGD sidebar shows Hồ sơ PYC, Chuẩn bị & Phân công, Hiện trường & Lấy mẫu, PTN & Kết quả, Báo cáo/Chứng thư and Soạn thảo.
2. Each station page shows the dossier selector and station-specific form after selecting a PYC.
3. Soạn thảo opens Cài đặt DOCX as an in-place modal; shared Cài đặt hệ thống does not show PGD templates.
4. Stainless-steel dossiers are labeled `GĐ-THEP-KG`; general steel/metal dossiers can use `GĐ-THEP-TT58`; machinery, coal, giám định ngoài and other profiles are visible; `QC20` is absent from PGD catalog/menu.
5. A missing lab result produces an alert; no payment fields appear.

> Verification note (2026-09-05): the route was reachable and rendered the protected PCN login surface. The smoke check could not enter the station workspace because no authenticated test session was available; no credentials were guessed or entered.

- [x] **Step 5: Record verified memory/Obsidian summary**

Update `PROJECT_MEMORY.md` and create the Obsidian note with only verified facts: source form structure, implementation route/panel names, template-modal boundary, no payment surface, no Desktop/UNC runtime read, no QC20 in PGD catalog, tests and build result. Do not copy customer names, signatures, historical numbers or source file bytes into memory.

- [ ] **Step 6: Commit only the final implementation/memory files**

```bash
git status --short
git add components/PgdDocxSettingsModal.tsx components/PgdDossierSelector.tsx components/PgdOperationalStationWorkspace.tsx components/PgdPreparationStationPanel.tsx components/PgdFieldStationPanel.tsx components/PgdLabStationPanel.tsx components/PgdResultsStationPanel.tsx components/PgdDocumentGenerationPanel.tsx components/PgdSourceFormsPanel.tsx components/PgdCaseEvidencePanel.tsx components/PgdWorkspace.tsx components/PgdSidebar.tsx components/PgdcnAppShell.tsx components/PgdcnSystemSettingsView.tsx components/PgdTableFieldEditor.tsx components/PgdCellManager.tsx utils/pgdDocumentTemplates.ts design.md PROJECT_MEMORY.md 'obsidian-vault/2026-09-04 - PCN_webapp - PGD dossier cockpit implementation.md'
git commit -m "feat: complete PGD dossier cockpit"
```

Do not stage unrelated pre-existing changes, deleted `dist` artifacts, remote attachments, or historical research files.
