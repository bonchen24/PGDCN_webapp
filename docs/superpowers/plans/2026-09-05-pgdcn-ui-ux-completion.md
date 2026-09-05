# PGDCN UI/UX Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the shared PGDCN shell, AI assistant states and PCN/PGD workspace presentation without changing domain data, workflow or RBAC contracts.

**Architecture:** Keep `PgdcnAppShell` as the owner of navigation/session state and keep PCN/PGD components as separate domain surfaces. Add one small pure UI-error mapping utility for the PCN assistant, then apply shared presentation primitives and existing CSS contracts to the shell, assistant and dossier/list surfaces. All server APIs and persisted data remain unchanged.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript 5.8, Tailwind CSS, lucide-react, Node test runner via tsx, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-05-pgdcn-ui-ux-completion-design.md`

## Global Constraints

- `design.md` section `5.2.1.3` is the source-of-truth UI/UX contract.
- PCN and PGD data, statuses, callbacks, lifecycle steps and RBAC remain separate.
- Do not add database collections, schema fields, migrations or business endpoints.
- Keep the original Desktop PGD folder read-only and untouched.
- Preserve unrelated dirty worktree changes; stage only files belonging to this plan.
- Use `ddt-compact`, `pcn-page-surface`, `mobile-scroll-y`, `mobile-scroll-x`, `mobile-safe-bottom`, `mobile-touch-target` and `min-w-0`.
- Every production code change follows TDD: write a failing focused test, run it, implement the minimum, run it again.

---

### Task 1: Add a typed assistant error/state presentation contract

**Files:**
- Create: `utils/pcnAssistantUi.ts`
- Create: `test/pcn-assistant-ui-contract.test.ts`
- Extend: `test/pcn-approval-assistant-ui.test.ts`

**Interfaces:**
- Consumes: the existing assistant stream `code` and `message` values from `PcnAssistantView`.
- Produces: `PcnAssistantErrorKind`, `PcnAssistantErrorView` and `classifyPcnAssistantError(input)` for UI-only rendering.

- [ ] **Step 1: Write the failing tests**

Add tests for the stable mappings:

```ts
test('classifies missing private storage as an administrator action', () => {
  assert.deepEqual(classifyPcnAssistantError({ code: 'PCN_APPROVAL_ASSISTANT_FAILED', message: 'PCN file storage is not configured. Set SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY.' }), {
    kind: 'STORAGE_CONFIG',
    title: 'Chưa sẵn sàng đọc file private',
    action: 'Quản trị viên cần kiểm tra cấu hình Storage Supabase.',
  });
});

test('classifies empty DOCX text and keeps the file name', () => {
  const result = classifyPcnAssistantError({ code: 'PADDLE_OCR_EMPTY', message: 'Dừng phiên AI: Tài liệu Dấu mềm.docx không có nội dung để kiểm tra.' });
  assert.equal(result.kind, 'EMPTY_DOCUMENT');
  assert.match(result.detail || '', /Dấu mềm\.docx/);
  assert.equal(result.action, 'Mở file bằng chứng để kiểm tra nội dung.');
});

test('uses a safe retry message for unknown assistant failures', () => {
  const result = classifyPcnAssistantError({ message: 'unexpected upstream error' });
  assert.equal(result.kind, 'UNKNOWN');
  assert.equal(result.action, 'Thử lại phiên hỗ trợ.');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --experimental-strip-types --test test/pcn-assistant-ui-contract.test.ts`

Expected: FAIL because `utils/pcnAssistantUi.ts` and `classifyPcnAssistantError` do not exist.

- [ ] **Step 3: Implement the minimal pure mapping**

Implement `classifyPcnAssistantError` with exact kinds `STORAGE_CONFIG`, `EMPTY_DOCUMENT`, `OCR_UNAVAILABLE`, `SERVICE` and `UNKNOWN`. Match codes first, then normalized message patterns. Return a stable Vietnamese `title`, `action`, and optional `detail`; never include secret values in the returned primary copy.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --experimental-strip-types --test test/pcn-assistant-ui-contract.test.ts`

Expected: PASS with all three assertions.

- [ ] **Step 5: Extend the existing assistant UI contract test**

Assert that `PcnAssistantView.tsx` imports the mapper and contains `role="status"`, `role="alert"`, `STORAGE_CONFIG`, `EMPTY_DOCUMENT`, `Mở hồ sơ` and `Mở file` markers. Run: `node --experimental-strip-types --test test/pcn-approval-assistant-ui.test.ts` and verify RED until the component is updated in Task 3; keep the test change staged for that task.

---

### Task 2: Finish shared shell and Tổng quan presentation

**Files:**
- Modify: `components/PgdcnAppShell.tsx`
- Modify: `components/PgdcnSidebar.tsx`
- Modify: `components/PgdcnDashboardView.tsx`
- Extend: `test/pgdcn-shell-ui.test.ts`
- Extend: `test/pgdcn-common-structure.test.ts`

**Interfaces:**
- Consumes: existing `PgdcnNavigationTarget`, department scopes, dashboard projection and notification callbacks.
- Produces: the same navigation targets and callbacks with clearer labels, active state, responsive states and no new route.

- [ ] **Step 1: Write failing shell/UI contract assertions**

Extend tests to require:

```ts
assert.match(shellSource, /department-dashboard/);
assert.match(shellSource, /Tổng quan phòng/);
assert.match(sidebarSource, /aria-current/);
assert.match(sidebarSource, /aria-expanded/);
assert.match(dashboardSource, /mobile-scroll-y|mobile-scroll-x/);
assert.match(dashboardSource, /focus:ring/);
```

Add a dashboard assertion that empty queues and empty domain panels include a visible next-step copy, not only a blank container.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --experimental-strip-types --test test/pgdcn-shell-ui.test.ts test/pgdcn-common-structure.test.ts`

Expected: FAIL on each newly requested marker that is not already present.

- [ ] **Step 3: Implement the minimum shared-shell presentation changes**

In `PgdcnAppShell`, keep `department-dashboard` as the default for an absent `initialDomain`, expose the active section label in the header, and keep deep-link initialization unchanged. In `PgdcnSidebar`, preserve scope filtering while adding explicit `aria-expanded` values for both domain groups and an accessible label when collapsed. In `PgdcnDashboardView`, retain the six KPI labels/test ids and tighten the action queue, pipeline, milestone and notification states with `min-w-0`, focus rings, readable empty-state actions and the existing compact/mobile classes.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `node --experimental-strip-types --test test/pgdcn-shell-ui.test.ts test/pgdcn-common-structure.test.ts test/pgdcn-dashboard.test.ts`

Expected: PASS with the existing dashboard projection behavior unchanged.

---

### Task 3: Implement the Trợ lý AI stateful UX

**Files:**
- Modify: `components/PcnAssistantView.tsx`
- Modify: `components/PgdcnAssistantView.tsx`
- Modify: `test/pcn-approval-assistant-ui.test.ts`
- Modify: `test/pgdcn-assistant-ui.test.ts`

**Interfaces:**
- Consumes: existing candidates endpoint, NDJSON review stream, `onOpenDossier`, `getPcnFileUrl` and local PGD review data.
- Produces: the same API requests/callbacks plus explicit UI state, progress and actionable errors.

- [ ] **Step 1: Write failing UI contract assertions**

Add assertions for the component source to include:

```ts
for (const marker of ['Đang tải danh sách hồ sơ', 'Đã chọn:', 'Đang đánh giá tiêu chí', 'Tiêu chí đã hoàn tất', 'Mở hồ sơ', 'Mở file', 'role="status"', 'role="alert"']) {
  assert.ok(source.includes(marker), `Missing assistant UX marker: ${marker}`);
}
```

Add an assertion that the component renders an error title/action from `classifyPcnAssistantError` and does not render the raw configuration sentence as its only error label.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --experimental-strip-types --test test/pcn-approval-assistant-ui.test.ts test/pgdcn-assistant-ui.test.ts`

Expected: FAIL on the new progress/error markers.

- [ ] **Step 3: Implement the PCN assistant state model**

Add `assistantViewState`, `currentCriterion`, `completedCriterionCount`, `runErrorView` and `runErrorDetail` state. Update NDJSON consumption so `criterion_started` updates the current title/index, `criterion_result` increments the visible completed set, `run_completed` is the only event that enters `completed`, and `run_error` enters `error` without clearing received criteria. Render:

1. a compact selected-dossier summary;
2. a progress bar with text `Đang đánh giá tiêu chí X/11` and `Tiêu chí đã hoàn tất: Y/11`;
3. an error card using `classifyPcnAssistantError`, with `role="alert"`, a safe primary message, optional admin detail and buttons to open the dossier/evidence or retry;
4. result cards and export actions only when the run actually completed.

Use `aria-live="polite"` for progress and `aria-live="assertive"` for errors. Keep all fetch URLs, payloads and domain boundaries unchanged.

- [ ] **Step 4: Align the PGD assistant surface**

Update `PgdcnAssistantView`/`PgdAssistantPanel` to reuse the same card anatomy: header, read-only explanation, status badge with text, evidence action, empty state and mobile grid. Keep the PGD rules local and do not call PCN endpoints.

- [ ] **Step 5: Run focused assistant tests and verify GREEN**

Run: `node --experimental-strip-types --test test/pcn-assistant-ui-contract.test.ts test/pcn-approval-assistant-ui.test.ts test/pgdcn-assistant-ui.test.ts test/pgdcn-assistant-contract.test.ts`

Expected: PASS and no change to assistant API contract tests.

---

### Task 4: Unify workspace and dossier visual primitives

**Files:**
- Create: `components/PgdcnUiPrimitives.tsx`
- Modify: `components/PcnOperationsRegisterView.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PcnDossierDetailView.tsx`
- Modify: `components/PgdDossierOperationsPanel.tsx`
- Extend: `test/pgdcn-ui-ux-contract.test.ts`

**Interfaces:**
- Consumes: existing labels, status values, callbacks and domain-specific workflow arrays.
- Produces: presentation-only `PgdcnPageHeader`, `PgdcnToolbar`, `PgdcnStatusBadge`, `PgdcnWorkflowRail` and `PgdcnStatePanel` components.

- [ ] **Step 1: Write failing primitive and integration assertions**

Create `test/pgdcn-ui-ux-contract.test.ts` with assertions that the primitive file contains semantic headings, `min-w-0`, `mobile-touch-target`, `aria-current`, and that each target surface imports or renders the required primitive marker. Add a source assertion that the dossier detail includes a horizontally scrollable workflow rail.

- [ ] **Step 2: Run the focused contract test and verify RED**

Run: `node --experimental-strip-types --test test/pgdcn-ui-ux-contract.test.ts`

Expected: FAIL because the primitives and integration markers do not exist.

- [ ] **Step 3: Implement the primitives**

Implement presentation-only components with typed props:

```ts
export function PgdcnPageHeader(props: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }): JSX.Element;
export function PgdcnToolbar(props: { children: React.ReactNode; actions?: React.ReactNode }): JSX.Element;
export function PgdcnStatusBadge(props: { label: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'critical' }): JSX.Element;
export function PgdcnWorkflowRail(props: { steps: readonly { id: string; label: string; state: 'complete' | 'current' | 'upcoming' | 'blocked' }[] }): JSX.Element;
export function PgdcnStatePanel(props: { tone: 'loading' | 'empty' | 'error' | 'success'; title: string; description: string; action?: React.ReactNode }): JSX.Element;
```

Use text plus icon/tone, visible focus states, `aria-current="step"` for the current workflow step, `mobile-scroll-x` for the rail and `min-w-0` on all flexible children.

- [ ] **Step 4: Integrate without changing domain behavior**

Use the primitives in the PCN operations register toolbar, PGD workspace/list empty/error states, PCN dossier header/step rail and PGD dossier operations header. Keep existing mutation callbacks, status labels, selected IDs, modal boundaries and server permission checks unchanged. Hide non-applicable fields; do not replace them with disabled inputs.

- [ ] **Step 5: Run the focused contract and type checks**

Run: `node --experimental-strip-types --test test/pgdcn-ui-ux-contract.test.ts test/pgdcn-shell-ui.test.ts test/pgdcn-common-structure.test.ts`; then run `npm run lint` as the repository's TypeScript check.

Expected: focused tests pass and TypeScript exits with code 0.

---

### Task 5: Full verification, Docker rebuild and visual smoke test

**Files:**
- Modify only files already listed in Tasks 1–4 if verification exposes a defect.

- [ ] **Step 1: Run the full PCN test suite**

Run: `npm test`

Expected: exit code 0 with no failed tests.

- [ ] **Step 2: Run production static checks**

Run: `npm run lint`; `npm run build`; `git diff --check`.

Expected: each command exits 0; build produces the Next production output.

- [ ] **Step 3: Rebuild Docker on port 2357**

Run from `E:\CODING\PCN_webapp`:

```powershell
docker compose --env-file .env --env-file 'E:\CODING\TVCI_APP\supabase-docker\.env' -f docker-compose.pcn.yml up --build -d
```

Verify with:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:2357/api/health
docker ps --filter name=pcn_webapp-webapp
```

Expected: health status 200 and the container is Up with `2357:2357` published.

- [ ] **Step 4: Perform visual smoke checks at required widths**

Open `http://localhost:2357/pgdcn/pgd?codex=20260905` with the test account already configured in the local browser. Check the shared sidebar, Tổng quan, Trợ lý AI, PCN/PGD list and one dossier at widths 320, 375, 390, 430 and desktop. Verify no page-level horizontal overflow, visible focus, readable empty/error states, and a horizontally scrollable step rail where needed.

- [ ] **Step 5: Review the final diff and stage only feature files**

Run: `git status --short` and `git diff --stat -- <files listed in Tasks 1–4>`. Do not stage the existing unrelated modified PCN files, generated `dist` artifacts, temporary files or the original PGD source folder.
