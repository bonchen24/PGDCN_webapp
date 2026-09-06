# Sổ tổng hợp Cell-Grid PCN/PGD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Replace the PCN and PGD operations projections with two independent, spreadsheet-like **Sổ tổng hợp** pages that expose dossier fields as cells and save only whitelisted metadata through existing domain APIs.

**Architecture:** Add one domain-neutral `PgdcnDossierSummaryGrid` component that owns cell editing, keyboard behavior, column layout persistence, filtering, pagination and CSV export. Keep PCN and PGD row builders and mutation adapters separate: PCN maps proposal fields to the proposal API and dossier metadata to the dossier API; PGD maps request fields to the request/owner APIs. No new collection or generic cell endpoint is added.

**Tech Stack:** React 18, Next.js App Router, TypeScript, Zustand, lucide-react, existing `mergeColumnConfig` persistence helper, node:test contract/unit tests.

**Spec:** `docs/superpowers/specs/2026-09-06-so-tong-hop-cell-grid-design.md`

## Global Constraints

- PCN and PGD registers remain separate projections and never merge domain data.
- Only existing PCN proposal/dossier and PGD request/owner whitelist boundaries may mutate data.
- Workflow status, identifiers, field/profile, history, audit, documents, samples, lab state, results and issuance data are read-only cells.
- Missing values display `Chưa cập nhật` in the grid and export as empty CSV cells.
- Column layouts persist by `domain + username`; a default layout must never overwrite a loaded user layout.
- The grid must work on desktop and mobile with an independently scrollable wide table.

---

### Task 1: Lock the row and cell contracts with failing tests

**Files:**
- Create: `test/summary-register-grid.test.ts`
- Create: `utils/pgdSummaryRegister.ts`
- Modify: `utils/pcnOperationsRegister.ts`

**Interfaces:**
- Produce `SummaryCellValue = string | number | boolean | null | undefined` and a shared `SummaryGridRow`/`SummaryGridColumn` contract used by the grid and both adapters.
- Produce `buildPgdSummaryRegisterRows(input)` and `getPgdSummaryCellUpdate(request, columnId, value)`.
- Produce `getPcnSummaryCellUpdate(proposal, dossier, columnId, value)` in `utils/pcnOperationsRegister.ts`.

- [ ] **Step 1: Write failing tests for domain row construction and mapping**

```ts
test('PGD summary flattens registry, customer and product fields without losing dossier identity', () => {
  const rows = buildPgdSummaryRegisterRows({ requests: [requestFixture], assignments: [], samples: [], labRequests: [], labResults: [], reports: [], certificates: [] });
  assert.equal(rows[0].id, requestFixture.id);
  assert.equal(rows[0].cells.customerName, 'Công ty Mẫu');
  assert.equal(rows[0].cells.productGrade, 'SS400');
  assert.equal(rows[0].cells.contractNumber, 'HD-01');
});

test('PGD cell mapping merges nested values and routes owner through the owner boundary', () => {
  assert.deepEqual(getPgdSummaryCellUpdate(requestFixture, 'customerName', 'Công ty Mới'), {
    kind: 'request',
    patch: { customerSnapshot: { ...requestFixture.customerSnapshot, name: 'Công ty Mới' } },
  });
  assert.deepEqual(getPgdSummaryCellUpdate(requestFixture, 'ownerUsername', 'owner-2'), {
    kind: 'owner',
    ownerUsername: 'owner-2',
  });
});

test('PCN cell mapping separates proposal input from dossier metadata', () => {
  assert.deepEqual(getPcnSummaryCellUpdate(proposalFixture, dossierFixture, 'model', 'Model 2'), { target: 'proposal', updates: { model: 'Model 2' } });
  assert.deepEqual(getPcnSummaryCellUpdate(proposalFixture, dossierFixture, 'targetDate', '2026-09-30'), { target: 'dossier', updates: { targetDate: '2026-09-30' } });
});
```

- [ ] **Step 2: Run the focused test and confirm the expected missing-contract failure**

Run: `node --test test/summary-register-grid.test.ts`

Expected: FAIL because the new row builders and cell mapping functions do not exist yet.

- [ ] **Step 3: Implement the minimal row/cell contract and adapters**

Use `SummaryCellValue` for scalar cells, preserve `id`/`requestCode`/`dossierCode`, flatten only supported scalar nested fields, and map editable PGD fields to `PgdInspectionRequestEditPatch` shapes while returning an owner mutation for `ownerUsername`. Add the PCN mapping function alongside the existing PCN row builder so existing register filtering/CSV behavior remains covered.

- [ ] **Step 4: Run the focused tests and confirm they pass**

Run: `node --test test/summary-register-grid.test.ts`

Expected: PASS for row identity, nested-field flattening and PCN/PGD mutation mapping.

---

### Task 2: Build the reusable Cell-Grid interaction component

**Files:**
- Create: `components/PgdcnDossierSummaryGrid.tsx`
- Modify: `utils/columnConfigPersistence.ts` only if the shared component needs a typed helper extension
- Modify: `test/summary-register-grid.test.ts`

**Interfaces:**
- Consume `SummaryGridRow`, `SummaryGridColumn`, `currentUsername`, `domain`, `canEdit`, `onOpenRow` and `onCommitCell`.
- Produce a rendered table with `data-testid="dossier-summary-grid"`, editable cell inputs/selects, per-row saving state, pagination, CSV export, column configuration and domain-scoped persistence.

- [ ] **Step 1: Add failing source-contract tests for the grid behavior**

```ts
test('shared summary grid exposes spreadsheet controls and domain-scoped persistence', () => {
  const source = read('components/PgdcnDossierSummaryGrid.tsx');
  assert.match(source, /data-testid="dossier-summary-grid"/);
  assert.match(source, /mergeColumnConfig\(columns, parsed\)/);
  assert.match(source, /summary_grid_cols/);
  assert.match(source, /onDoubleClick/);
  assert.match(source, /onKeyDown/);
  assert.match(source, /Escape/);
  assert.match(source, /Tab/);
});
```

- [ ] **Step 2: Run the test to verify it fails because the component is absent**

Run: `node --test test/summary-register-grid.test.ts`

Expected: FAIL on the missing component source/contract.

- [ ] **Step 3: Implement the minimal shared grid**

Implement these behaviors:

```ts
type SummaryGridColumn = {
  id: string;
  label: string;
  width: number;
  visible: boolean;
  editable?: boolean;
  inputType?: 'text' | 'number' | 'date';
  options?: Array<{ value: string; label: string }>;
};

type SummaryGridRow = {
  id: string;
  cells: Record<string, SummaryCellValue>;
  searchText?: string;
};

type Props = {
  domain: 'PCN' | 'PGD';
  columns: SummaryGridColumn[];
  rows: SummaryGridRow[];
  currentUsername?: string;
  canEdit: boolean;
  onOpenRow: (rowId: string) => void;
  onCommitCell: (rowId: string, columnId: string, value: string) => Promise<void>;
};
```

Use `localStorage` key `summary_grid_cols_${domain}_${username}` only after the active username has been loaded. Preserve saved order/width/visibility with `mergeColumnConfig`, keep newly added defaults, and provide reset-columns. Start edits on double-click or Enter; commit on Enter, blur or Tab; cancel on Escape; never call `onCommitCell` on each keystroke. Show a saving marker on the row and leave the server snapshot untouched on rejection. Render `Chưa cập nhật` for empty display values while keeping empty strings for CSV. Keep the identity columns sticky, wrap the table in horizontal scroll, and expose aria labels for search/filter/configuration/actions.

- [ ] **Step 4: Run the focused tests and then typecheck the component**

Run: `node --test test/summary-register-grid.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: TypeScript has no new errors from the grid component.

---

### Task 3: Replace the PCN operations view with Sổ tổng hợp PCN

**Files:**
- Modify: `components/PcnOperationsRegisterView.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PgdcnSidebar.tsx`
- Modify: `components/PcnSidebar.tsx`
- Modify: `components/PgdcnAppShell.tsx`
- Modify: `test/summary-register-grid.test.ts`

**Interfaces:**
- Consume the shared grid and `getPcnSummaryCellUpdate`.
- Use `usePcnStore` callbacks passed from `PcnWorkspace` for proposal/dossier updates.
- Preserve `onOpenDossier(dossier, 'documents')` for canonical dossier navigation.

- [ ] **Step 1: Add failing PCN view contract tests**

```ts
test('PCN operations branch is named Sổ tổng hợp and uses the shared grid', () => {
  const view = read('components/PcnOperationsRegisterView.tsx');
  const workspace = read('components/PcnWorkspace.tsx');
  const sidebar = read('components/PgdcnSidebar.tsx');
  assert.match(view, /Sổ tổng hợp/);
  assert.match(view, /PgdcnDossierSummaryGrid/);
  assert.match(workspace, /onUpdateProposal=/);
  assert.match(sidebar, /operations', label: 'Sổ tổng hợp'/);
  assert.doesNotMatch(view, /Sổ điều hành/);
});
```

- [ ] **Step 2: Run the test and confirm the current PCN view fails the new contract**

Run: `node --test test/summary-register-grid.test.ts`

Expected: FAIL because the current title is Sổ điều hành and the old table is still rendered.

- [ ] **Step 3: Implement the PCN adapter and mutation callback**

Define PCN columns for identity, customer/proposal input, dossier metadata, workflow/read-only projections, sample/lab/result/issuance projections and completion. Build rows from `buildPcnOperationsRegisterRows`. On commit, use the mapping target: call `onUpdateProposal` for proposal/customer fields and `onUpdateDossier` for owner/evaluator/reviewer/dates/method. Use active PCN users as select options for people fields and keep identifiers, field codes and status read-only.

- [ ] **Step 4: Replace the old PCN table and labels**

Render `PgdcnDossierSummaryGrid` with PCN-specific filters and export data. Update the active shell label, legacy PCN sidebar label and navigation header mapping to **Sổ tổng hợp**. Keep CSV export scoped to visible columns and current filtered rows.

- [ ] **Step 5: Run focused PCN tests and verify green**

Run: `node --test test/summary-register-grid.test.ts test/pgd-pcn-navigation.test.ts test/column-config-persistence.test.ts`

Expected: PASS.

---

### Task 4: Replace the PGD operations projection with Sổ tổng hợp PGD

**Files:**
- Create: `components/PgdSummaryRegisterView.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PgdcnSidebar.tsx`
- Modify: `components/PgdSidebar.tsx`
- Modify: `components/PgdcnAppShell.tsx`
- Modify: `test/summary-register-grid.test.ts`
- Modify: `test/pgd-pcn-navigation.test.ts`

**Interfaces:**
- Consume `buildPgdSummaryRegisterRows`, `getPgdSummaryCellUpdate` and `PgdcnDossierSummaryGrid`.
- Consume `pgd.updateRequest` and `pgd.assignOwner` from the existing Zustand store.
- Preserve `openRequest(requestId)` as the canonical PGD dossier workspace entry.

- [ ] **Step 1: Add failing PGD view contract tests**

```ts
test('PGD operations branch is named Sổ tổng hợp and has a separate PGD grid persistence key', () => {
  const view = read('components/PgdSummaryRegisterView.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  const sidebar = read('components/PgdcnSidebar.tsx');
  assert.match(view, /Sổ tổng hợp/);
  assert.match(view, /domain="PGD"/);
  assert.match(view, /getPgdSummaryCellUpdate/);
  assert.match(workspace, /PgdSummaryRegisterView/);
  assert.match(sidebar, /operations', label: 'Sổ tổng hợp'/);
});
```

- [ ] **Step 2: Run the test and confirm it fails because PGD still renders cards**

Run: `node --test test/summary-register-grid.test.ts test/pgd-pcn-navigation.test.ts`

Expected: FAIL because the operations projection currently maps `RequestCard` instead of a summary grid.

- [ ] **Step 3: Implement the PGD row adapter and inline commit handler**

Build rows from requests plus related PGD entities, flattening registry/customer/requester/product/lot/quantity/weight/scope/location/schedule/standards/method/priority/owner/status and linked counts. Use `getPgdSummaryCellUpdate` to merge nested object values. Route `ownerUsername` to `pgd.assignOwner`; route all other editable fields to `pgd.updateRequest`. Keep request code, product group/catalog profile, lifecycle status and linked evidence projections read-only. Provide active PGD users as select options where the user list is available.

- [ ] **Step 4: Replace `operationProjection` and update PGD labels**

Render `PgdSummaryRegisterView` for `activeSection === 'operations'`, pass the PGD-only request graph and current filters, and leave the existing `requests` page as the intake/PYC page. Update shared and legacy PGD labels, aria/title text and navigation mappings to **Sổ tổng hợp**.

- [ ] **Step 5: Run focused PGD tests and verify green**

Run: `node --test test/summary-register-grid.test.ts test/pgd-pcn-navigation.test.ts test/pgd-table-fields.test.ts`

Expected: PASS.

---

### Task 5: Full verification and cleanup

**Files:**
- Modify: only files from Tasks 1–4 if verification exposes a real defect

- [ ] **Step 1: Run the focused contract/unit suite**

Run: `node --test test/summary-register-grid.test.ts test/pgd-pcn-navigation.test.ts test/column-config-persistence.test.ts test/pgd-table-fields.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run TypeScript verification**

Run: `npm run typecheck`

Expected: exit code 0.

- [ ] **Step 3: Run the complete PCN test runner**

Run: `npm test`

Expected: exit code 0 and no new failures.

- [ ] **Step 4: Check formatting and inspect the final diff**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only the approved design/spec/plan and implementation files are changed; pre-existing `design.md` changes remain intact.
