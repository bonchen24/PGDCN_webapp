# Native Dossier Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible PCN Archify workflow surface with a full-width native numbered flow and make the PCN management page task-first without changing business contracts.

**Architecture:** `PcnDossierWorkflowPanel` keeps ownership of runtime projection and mutation callbacks, while a new presentational `PcnDossierFlow` renders the horizontal tab rail. `PcnDossierNodeWorkPanel` remains the single node work surface and gains native return/open-document actions. `PcnOperationsRegisterView` composes a new queue view and preserves the existing summary grid as an explicit data mode.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS v4, Lucide React, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-12-native-dossier-flow-design.md` and the native-flow rules in `design.md` sections 0.2.3, 0.8, 0.10, 5.3, and 5A.

## Global Constraints

- The flow is projected from `workflowSnapshot`, `projectPcnWorkflowRuntime`, and `buildPcnDossierNodeWorkProjection`; the client does not create topology or infer task state from visual position.
- All mutations continue through existing server-bound callbacks and RBAC guards; this change introduces no schema, API, persistence, lifecycle, or permission behavior.
- Each active snapshot node is a numbered tab in `sortOrder`; the selected tab exposes only that node's documents and business work.
- Type and status colors are separate, paired with readable labels and Lucide icons, and never serve as the only status signal.
- Mobile uses an internal `mobile-scroll-x` rail; the page must not gain body-level horizontal overflow. Controls target at least 44px and expose visible focus.
- Archify backend/embed files remain for rollback and non-PCN surfaces, but PCN dossier detail/management must not import or render `PcnArchifyWorkflowEmbed`.
- Preserve all pre-existing user changes in the dirty worktree; do not reset, checkout, or broadly reformat unrelated files.

## File map

- Create `components/PcnDossierFlow.tsx`: accessible, presentational numbered rail and selected-step summary.
- Modify `components/PcnDossierWorkflowPanel.tsx`: remove the Archify import/render, project all runtime nodes, and pass selection/action data to the native rail and work panel.
- Modify `components/PcnDossierNodeWorkPanel.tsx`: expose the current document/module and node action buttons, including guarded return UI.
- Verify `components/PcnDossierDetailView.tsx`: its existing workflow-first route already passes the deep-link/callback contract, so no source change is required.
- Create `components/PcnDossierQueueView.tsx`: task-first card list and KPI strip from `PcnOperationsRegisterRow` projections.
- Modify `components/PcnOperationsRegisterView.tsx`: add `QUEUE`/`DATA` mode switch and compose queue cards while leaving the current summary grid untouched in data mode.
- Create `test/pcn-native-dossier-flow-ui.test.ts`: source-level regression contract for native tabs, type/status labels, actions, and mobile containment.
- Modify `test/pcn-archify-embed.test.ts`, `test/pcn-archify-mobile.test.ts`, and `test/pcn-workflow-ui.test.ts`: retain standalone Archify safety contracts but assert PCN dossier panel no longer embeds it and uses the native flow.

### Task 1: Lock the native flow contract with failing tests

**Files:**
- Create: `test/pcn-native-dossier-flow-ui.test.ts`
- Modify: `test/pcn-archify-embed.test.ts`
- Modify: `test/pcn-archify-mobile.test.ts`
- Modify: `test/pcn-workflow-ui.test.ts`

**Interfaces:**
- The new test reads `PcnDossierFlow.tsx`, `PcnDossierWorkflowPanel.tsx`, and `PcnDossierNodeWorkPanel.tsx` as source contracts.
- Existing Archify tests continue to verify the standalone reader/server safety but no longer require it to be imported by the PCN workflow panel.

- [ ] **Step 1: Write the failing test**

Add assertions equivalent to:

```ts
test('native flow is a numbered accessible rail with separate type and status cues', () => {
  assert.match(flowSource, /role="tablist"/);
  assert.match(flowSource, /role="tab"/);
  assert.match(flowSource, /aria-selected/);
  assert.match(flowSource, /aria-current/);
  assert.match(flowSource, /ArrowLeft|ArrowRight/);
  assert.match(flowSource, /DOCUMENT_TASK/);
  assert.match(flowSource, /APPROVAL_TASK/);
  assert.match(flowSource, /PARALLEL_SPLIT|PARALLEL_JOIN/);
  assert.match(flowSource, /mobile-scroll-x/);
  assert.match(flowSource, /FILE|ACTION|APPROVAL|DECISION|PARALLEL|END/);
});

test('PCN dossier workflow no longer renders the Archify embed', () => {
  assert.doesNotMatch(workflowSource, /PcnArchifyWorkflowEmbed/);
  assert.match(workflowSource, /PcnDossierFlow/);
  assert.match(workflowSource, /PcnDossierNodeWorkPanel/);
});

test('node work exposes guarded action affordances', () => {
  assert.match(nodeWorkSource, /Bắt đầu xử lý/);
  assert.match(nodeWorkSource, /Hoàn tất bước|Tiếp tục/);
  assert.match(nodeWorkSource, /Trả về/);
  assert.match(nodeWorkSource, /Mở toàn bộ tài liệu/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pcn-native-dossier-flow-ui.test.ts`

Expected: FAIL because `PcnDossierFlow.tsx` does not exist and the workflow panel still imports/renders the Archify embed.

- [ ] **Step 3: Update obsolete Archify UI expectations**

Change only the PCN parent-panel assertions in the two existing UI contract tests. Keep assertions for iframe preflight, light surface, standalone renderer, server routes, and PGD compatibility because those files are intentionally retained outside this PCN UI slice.

- [ ] **Step 4: Run the updated contracts**

Run: `node --test test/pcn-native-dossier-flow-ui.test.ts test/pcn-archify-embed.test.ts test/pcn-archify-mobile.test.ts`

Expected: the new test remains FAIL until implementation; the retained Archify tests pass.

### Task 2: Build the native horizontal flow component

**Files:**
- Create: `components/PcnDossierFlow.tsx`
- Test: `test/pcn-native-dossier-flow-ui.test.ts`

**Interfaces:**

```ts
interface PcnDossierFlowProps {
  nodes: PcnWorkflowRuntimeNode[];
  projections: Record<string, PcnDossierNodeWorkProjection | undefined>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}
```

The component must sort the already-projected runtime nodes by their supplied array order, render one `button` tab per node, and keep selection controlled by the parent.

- [ ] **Step 1: Implement the minimal rail**

Use Lucide icons and explicit maps for node type/status. Render `role="tablist"` inside a `mobile-scroll-x` wrapper. Each tab includes `aria-selected`, `aria-controls="pcn-node-panel-${node.id}"`, `aria-posinset`, `aria-setsize`, a visible number, type label, node label, document progress, and status label. Locked nodes render `disabled` and are visually muted.

- [ ] **Step 2: Add keyboard navigation**

Keep a roving `tabIndex`: selected tab gets `0`, other selectable tabs get `-1`, and ArrowLeft/ArrowRight/Home/End move focus and call `onSelectNode` without changing URL or runtime state. Ignore disabled locked tabs while searching for the next selectable node.

- [ ] **Step 3: Add selected-step context**

Below the rail render a compact summary containing current step, count of resolved documents, blocked reason/suggestions when available, and a visible legend for `FILE`, `ACTION`, `APPROVAL`, `DECISION/PARALLEL`, and `END`. Keep all layout containers `min-w-0`; do not add a second page scroll.

- [ ] **Step 4: Run the focused contract**

Run: `node --test test/pcn-native-dossier-flow-ui.test.ts`

Expected: PASS for the rail contract.

### Task 3: Wire runtime projection and node actions

**Files:**
- Modify: `components/PcnDossierWorkflowPanel.tsx`
- Modify: `components/PcnDossierNodeWorkPanel.tsx`
- Test: `test/pcn-native-dossier-flow-ui.test.ts`

**Interfaces:**

- `PcnDossierWorkflowPanel` continues to accept all existing props and callbacks.
- Add optional node-panel props:

```ts
returnTargets?: Array<{ id: string; label: string }>;
onReturnTask?: (taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
onOpenDocuments?: () => void;
```

- [ ] **Step 1: Project every selectable node**

In `PcnDossierWorkflowPanel`, remove `PcnArchifyWorkflowEmbed`, build a `Record<string, PcnDossierNodeWorkProjection | undefined>` with the same `buildPcnDossierNodeBusinessFacts` inputs for each runtime node, and select the initial node from `initialNodeId` or the first active/completed node. Preserve the existing “cannot select locked” guard and the `usePcnStore` fallback for generate/remove.

- [ ] **Step 2: Render native flow full width**

Render `PcnDossierFlow` followed by one full-width `PcnDossierNodeWorkPanel`; do not use the former two-column grid or iframe. Add `id="pcn-node-panel-${selectedProjection.nodeId}"` to the work panel so the selected tab's `aria-controls` resolves.

- [ ] **Step 3: Add visible node action group**

In `PcnDossierNodeWorkPanel`, keep existing upload/create/view/waiver buttons and add a clear action footer. `Bắt đầu xử lý` is available for `READY`/`RETURNED`; `Hoàn tất bước` is available only when `projection.canContinue`; `Trả về` opens an inline form with a required target and reason and calls `onReturnTask`. Use the existing `busyKey` guard and preserve focus after completion/error.

- [ ] **Step 4: Add the document/module affordance**

At the document section heading add `Mở toàn bộ tài liệu` when `onOpenDocuments` exists. It is a secondary action; the node list remains scoped to the selected node.

- [ ] **Step 5: Verify detail deep links**

Confirm `PcnDossierDetailView` still passes `initialNodeId`, `initialTab`, workflow-first behavior, and existing region callbacks. The existing wrapper already keeps `h-full min-h-0`/`pcn-dossier-focus-scroll`; do not edit it unless a verification failure proves it necessary.

- [ ] **Step 6: Run focused workflow tests**

Run: `node --test test/pcn-native-dossier-flow-ui.test.ts test/pcn-dossier-workflow-first.test.ts test/pcn-workflow-ui.test.ts test/pcn-archify-mobile.test.ts`

Expected: PASS with no Archify import in the PCN workflow panel and native action affordances present.

### Task 4: Convert management to a queue-first surface

**Files:**
- Create: `components/PcnDossierQueueView.tsx`
- Modify: `components/PcnOperationsRegisterView.tsx`
- Test: `test/pcn-native-dossier-flow-ui.test.ts`

**Interfaces:**

```ts
interface PcnDossierQueueViewProps {
  rows: PcnOperationsRegisterRow[];
  onOpenDossier: (dossierId: string) => void;
}
```

- [ ] **Step 1: Add queue contract assertions**

Assert that the management source imports the queue, has `QUEUE`/`DATA` mode state, exposes `Hàng đợi hồ sơ` and `Sổ dữ liệu`, and keeps `PgdcnDossierSummaryGrid` in the DATA branch.

- [ ] **Step 2: Implement queue cards**

Render a responsive KPI strip (`Tổng hồ sơ`, `Cần xử lý`, `Còn thiếu tài liệu`, `Chưa phân công`) and one card per filtered row. Each card shows dossier/registration code, customer/product, current step, completion percentage with numerator/denominator, missing count, owner, status, and a single primary `Mở hồ sơ` button. Use `mobile-touch-target`, `min-w-0`, semantic status labels, and no duplicate mutation path.

- [ ] **Step 3: Add mode switch without duplicating filters**

Keep the existing search/filter controls owned by `PgdcnDossierSummaryGrid` for DATA mode. For QUEUE mode, add a compact queue search input and reuse the same `filterRows` predicate; changing mode must not discard filter state. Keep the existing inline-edit, export, column configuration, and pagination behavior inside DATA mode.

- [ ] **Step 4: Compose and verify**

Render QUEUE by default and DATA only after the user selects `Sổ dữ liệu`. Run: `node --test test/pcn-native-dossier-flow-ui.test.ts test/summary-register-grid.test.ts test/pcn-work-queue.test.ts`

Expected: PASS; the queue is the default entry surface and the old grid remains available.

### Task 5: Run full verification and visual smoke checks

**Files:**
- Modify only files already listed above if verification finds a real issue.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: exit 0 with no new TypeScript errors.

- [ ] **Step 2: Run the full PCN suite**

Run: `npm test`

Expected: all existing PCN tests plus the native-flow contracts pass. Archify projection/server tests remain green because their backend files were intentionally retained.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 4: Check diff hygiene**

Run: `git diff --check`

Expected: no whitespace errors. Review `git diff --stat` and `git status --short` to ensure only the planned files and pre-existing user changes are present.

- [ ] **Step 5: Perform browser smoke check**

Open the local PCN page and verify: desktop full-width rail, numbered tabs, visible document/node buttons, no iframe, selected-step switching, and mobile rail containment at 390px. If authentication blocks the route, use source/test evidence and report the limitation instead of changing auth or seed data.
