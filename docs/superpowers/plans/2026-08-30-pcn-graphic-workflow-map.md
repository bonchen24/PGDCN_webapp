# PCN Graphic Workflow Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible PCN dossier-station UI with a compact graphic workflow whose nodes, cards, warnings, and detail navigation are derived from the existing PCN state machine and real dossier snapshot.

**Architecture:** Keep `utils/pcnWorkflow.ts` as the transition authority and `utils/pcnDossierPipeline.ts` as the compatibility adapter for status-to-document routing. Add one pure workflow-map projection and one reusable graphic component. Reuse the existing dossier cards, completeness projection, activity history, detail region selector, upload boundary, and issuance boundaries; do not add a workflow table, duplicate state, route, or API.

**Tech Stack:** Next.js App Router, React 18, TypeScript strict mode, Tailwind CSS, lucide-react, Node test runner through the repository `tsx` test script.

**Spec:** `docs/superpowers/specs/2026-08-30-pcn-graphic-workflow-map-design.md`; authoritative project rules are in `design.md` sections 0.1–0.4, 2, 5, 6 and 7.

## Global Constraints

- The real status and transition source remains `utils/pcnWorkflow.ts`; no second state machine.
- `PcnPipelineStationKey`/catalog may remain as an internal compatibility adapter, but the UI must not present “Trạm 1/2…”, station columns, or a station form.
- PostgreSQL PCN and the current client snapshot remain the source of truth; no mock dossier data, workflow collection, or migration.
- The dashboard renders one canonical dossier-card list at a time; selecting a graphic node filters that list and never duplicates cards.
- All existing server-side authorization, private file boundaries, audit, idempotency, issuance restrictions, and callback contracts remain unchanged.
- The primary graphic uses desktop horizontal flow with a bounded scroll region and a mobile vertical/scrollable fallback; every node keeps a touch target of at least 44px.
- No timer or animation may change business state; animation is limited to a visual current/attention treatment.

---

### Task 1: Add the deterministic workflow-map projection

**Files:**
- Create: `utils/pcnWorkflowMap.ts`
- Test: `test/pcn-workflow-map.test.ts`

**Interfaces:**
- Consumes: `CertificationDossier`, `CertificationProposal`, `PcnDossierDocument`, `PcnDocumentRequirement`, `ActivityLog`, `PcnPipelineStation`, `PCN_PIPELINE_STATIONS`, `buildPcnDossierCompleteness`, and `buildPcnWorkQueueRows`.
- Produces:
  - `PcnWorkflowNodeState = 'COMPLETED' | 'CURRENT' | 'FUTURE' | 'EXCEPTION'`.
  - `PcnWorkflowNode` with `key`, `number`, `title`, `description`, `actionLabel`, `statuses`, `state`, `count`, `overdueCount`, `missingDocumentCount`, `returned`, `blocked`, and optional `currentStatus`.
  - `PcnWorkflowMapProjection` with `nodes`, `currentNodeKey`, `currentNode`, `selected/aggregate counts`, and `hasReturned`.
  - `buildPcnWorkflowOverview(input)` for the filtered dashboard snapshot.
  - `buildPcnDossierWorkflowMap(input)` for one dossier and its activity history.

- [ ] **Step 1: Write the failing projection tests**

  Add real-data-shaped fixtures and assert the desired behavior:

  ```ts
  test('maps a corrective-action dossier to the current return node and preserves visited history', () => {
    const result = buildPcnDossierWorkflowMap({
      dossier: { ...dossier, status: 'CORRECTIVE_ACTION' },
      activityLogs: [
        statusLog('AWAITING_RESULTS', '2026-08-01T00:00:00.000Z'),
        statusLog('CORRECTIVE_ACTION', '2026-08-03T00:00:00.000Z'),
      ],
      requirements,
      documents,
      now: '2026-08-04T00:00:00.000Z',
    });

    assert.equal(result.currentNodeKey, 'CORRECTION');
    assert.equal(result.currentNode.state, 'CURRENT');
    assert.equal(result.currentNode.returned, true);
    assert.equal(result.nodes.find((node) => node.key === 'RESULTS')?.state, 'COMPLETED');
    assert.equal(result.nodes.find((node) => node.key === 'APPROVAL')?.state, 'FUTURE');
  });

  test('marks on-hold as blocked exception without inventing a primary step', () => {
    const result = buildPcnDossierWorkflowMap({
      dossier: { ...dossier, status: 'ON_HOLD', exceptionReason: 'Chờ đối chiếu nguồn' },
      activityLogs: [], requirements, documents,
    });

    assert.equal(result.currentNodeKey, 'EXCEPTIONS');
    assert.equal(result.currentNode.state, 'EXCEPTION');
    assert.equal(result.currentNode.blocked, true);
    assert.equal(result.currentNode.returned, false);
  });

  test('counts overdue and missing-document dossiers by workflow node', () => {
    const result = buildPcnWorkflowOverview({
      dossiers: [{ ...dossier, targetDate: '2026-08-01' }],
      proposals: [proposal], requirements, documents,
      now: '2026-08-30T00:00:00.000Z',
    });

    const node = result.nodes.find((item) => item.key === 'DOCUMENTS');
    assert.equal(node?.count, 1);
    assert.equal(node?.overdueCount, 1);
    assert.equal(node?.missingDocumentCount, 1);
  });
  ```

- [ ] **Step 2: Run the focused test and verify it fails for the missing projection**

  Run: `npm test -- test/pcn-workflow-map.test.ts`

  Expected: FAIL because `utils/pcnWorkflowMap.ts` and its exported builders do not exist yet, not because of a fixture or assertion error.

- [ ] **Step 3: Implement the minimal pure projection**

  Build the node list from `PCN_PIPELINE_STATIONS` plus the existing exception station. Resolve the current node with `getPcnPipelineStation`. Derive visited nodes only from valid dossier status-change entries in `ActivityLog.changes` and the current status; mark prior visited nodes completed, current status current, and untouched nodes future. Mark `CORRECTIVE_ACTION`/a lower node reached after a higher visited node as `returned`; mark `ON_HOLD` as `blocked`; mark `REJECTED` as returned exception and `CANCELLED` as terminal exception. Calculate overdue through the existing work-queue priority projection and calculate missing documents through `buildPcnDossierCompleteness`; never infer either value from filenames or animation.

- [ ] **Step 4: Run the focused test and verify it passes**

  Run: `npm test -- test/pcn-workflow-map.test.ts`

  Expected: PASS with the three projection behaviors covered.

- [ ] **Step 5: Run related pure PCN tests**

  Run: `npm test -- test/pcn-pipeline.test.ts test/pcn-work-queue.test.ts test/pcn-dossier-inspection.test.ts`

  Expected: existing status, queue, completeness, and document-inspection behavior remains green.

### Task 2: Build the reusable graphic workflow component

**Files:**
- Create: `components/PcnWorkflowMap.tsx`
- Test: `test/pcn-workflow-map-ui.test.ts`

**Interfaces:**
- Consumes: `PcnWorkflowMapProjection` and `PcnWorkflowNode` from `utils/pcnWorkflowMap.ts`.
- Produces: `PcnWorkflowMap` with props `{ projection, mode: 'overview' | 'dossier', selectedNodeKey?, onSelectNode?, className? }`; node clicks call only `onSelectNode(node.key)` and never mutate data.

- [ ] **Step 1: Write the failing UI-contract tests**

  Assert source-level contracts that protect the requested graphic rather than a station board:

  ```ts
  test('renders workflow nodes as accessible graphic buttons', () => {
    const source = fs.readFileSync(new URL('../components/PcnWorkflowMap.tsx', import.meta.url), 'utf8');
    assert.match(source, /aria-label/);
    assert.match(source, /aria-current/);
    assert.match(source, /onSelectNode/);
    assert.match(source, /COMPLETED|CURRENT|FUTURE|EXCEPTION/);
    assert.match(source, /returned|blocked|overdue/i);
    assert.doesNotMatch(source, /StationColumn|Trạm \$\{|Mỗi cột/);
  });
  ```

- [ ] **Step 2: Run the UI-contract test and verify it fails**

  Run: `npm test -- test/pcn-workflow-map-ui.test.ts`

  Expected: FAIL because the component file and graphic contract do not exist.

- [ ] **Step 3: Implement the graphic component**

  Render the ordered main nodes in a bounded horizontal flow with connectors, a compact node number/icon, title, count/status badge, and attention markers. Render the exception node as a visually separate dashed branch. Use token classes for completed/current/future/exception and supplemental overdue/returned/blocked markers; a current node may pulse visually but no timer or state mutation is allowed. Use a scrollable desktop region and a stacked/scrollable mobile layout. Each node must be a real button with `aria-label`, `aria-current` for the current node, and `aria-pressed` for a selected overview node.

- [ ] **Step 4: Run the UI-contract and focused projection tests**

  Run: `npm test -- test/pcn-workflow-map-ui.test.ts test/pcn-workflow-map.test.ts`

  Expected: PASS.

### Task 3: Replace the dashboard station board with workflow graphic plus canonical cards

**Files:**
- Modify: `components/PcnPipelineBoard.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `test/pcn-pipeline.test.ts`
- Modify: `test/pcn-ui-contract.test.ts`

**Interfaces:**
- Consumes: `buildPcnWorkflowOverview`, `PcnWorkflowMap`, existing `PcnWorkQueueRow` priority, completeness projection, and `onOpenDossier` callback.
- Produces: existing `PcnPipelineBoard` export with the same parent callback contract, but its visible surface is `Bản đồ quy trình` plus one filtered dossier-card grid.

- [ ] **Step 1: Add failing dashboard contract assertions**

  Replace obsolete assertions about station columns with assertions for the new surface:

  ```ts
  test('dashboard exposes a graphic workflow and one card list', () => {
    assert.match(pipelineBoard, /PcnWorkflowMap/);
    assert.match(pipelineBoard, /buildPcnWorkflowOverview/);
    assert.match(pipelineBoard, /Bản đồ quy trình/);
    assert.match(pipelineBoard, /selectedNodeKey/);
    assert.match(pipelineBoard, /onSelectNode/);
    assert.doesNotMatch(pipelineBoard, /function StationColumn/);
    assert.doesNotMatch(pipelineBoard, /Mỗi cột là một trạm/);
  });
  ```

- [ ] **Step 2: Run the dashboard tests and verify the expected old/new contract failure**

  Run: `npm test -- test/pcn-pipeline.test.ts test/pcn-ui-contract.test.ts`

  Expected: FAIL only on the new graphic assertions before implementation; retain failures that identify old station-board assertions for replacement rather than deleting unrelated coverage.

- [ ] **Step 3: Implement the dashboard graphic surface**

  Keep scope and field filtering, derive `visibleDossiers`, build `overviewProjection` from that exact snapshot, and maintain `selectedNodeKey` locally. Selecting a node filters cards by the statuses in that node; selecting the exception node filters `ON_HOLD`/`REJECTED`/`CANCELLED`. Reset a selected node when its node no longer exists after filters change. Keep one `DossierPipelineCard` per dossier and change its visible copy from station/checklist language to “Bước hiện tại”, “Tài liệu tại bước”, and “Ngoại lệ”. Keep the existing detail-tab mapping callback and real completeness/deadline/code-review data. Remove `StationColumn`, per-column requirement catalogs, and the separate exception card lane so cards cannot duplicate.

  Change the Dashboard mode label from `Pipeline` to `Bản đồ quy trình`, make `WORKFLOW` the initial value of the existing single-surface toggle, and retain the `Việc cần làm` queue as the secondary mode. Do not add a sidebar item or route.

- [ ] **Step 4: Run dashboard tests and the full PCN UI contract subset**

  Run: `npm test -- test/pcn-pipeline.test.ts test/pcn-ui-contract.test.ts test/pcn-sidebar-workspaces.test.ts`

  Expected: PASS with no station-column contract remaining and no navigation regression.

### Task 4: Replace the dossier detail station summary with the graphic workflow

**Files:**
- Modify: `components/PcnDossierDetailView.tsx`
- Modify: `test/pcn-dossier-detail.test.ts`
- Modify: `test/pcn-pipeline.test.ts`

**Interfaces:**
- Consumes: `dossierActivityLogs`, existing `completeness`, `requirements`, `dossierDocumentsForCompleteness`, `getPcnDossierStationTab`, existing upload/generation/approval callbacks, and `PcnWorkflowMap`.
- Produces: a detail header containing the dossier graphic, compact owner/deadline/completeness/code-review summary, selected-step document actions, and the existing region selector/tabs unchanged.

- [ ] **Step 1: Add failing detail assertions for the graphic replacement**

  Add assertions such as:

  ```ts
  test('dossier detail uses graphic workflow instead of a station summary', () => {
    const source = fs.readFileSync(detailPath, 'utf8');
    assert.match(source, /PcnWorkflowMap/);
    assert.match(source, /buildPcnDossierWorkflowMap/);
    assert.match(source, /Bước hiện tại/);
    assert.match(source, /onSelectNode/);
    assert.doesNotMatch(source, /<DossierStationSummary/);
    assert.doesNotMatch(source, /Trạm hiện tại/);
  });
  ```

- [ ] **Step 2: Run the detail tests and verify they fail before implementation**

  Run: `npm test -- test/pcn-dossier-detail.test.ts test/pcn-pipeline.test.ts`

  Expected: FAIL because the detail still renders `DossierStationSummary` and does not render the graphic.

- [ ] **Step 3: Implement the detail graphic integration**

  Build `dossierWorkflowProjection` from the exact dossier snapshot and filtered `dossierActivityLogs`. Track a local selected workflow node only for navigation/display. Clicking a primary node calls `setActiveTab(getPcnDossierStationTab(node.key, hasHistoricalReview))`; clicking the exception node opens historical review or documents using the existing mapping. Replace visible “Trạm…” labels with “Bước…”. Keep a compact summary for the selected/current node, owner, target date, completeness score and numerator/denominator, missing documents, exception reason and PCN code review. Keep upload next to the selected step’s requirements with the same `onUploadDocument` callback and private boundary. Keep the visual checklist and full document-version region, but group copy under workflow steps rather than presenting a station form. Preserve all existing footer status buttons and issuance-module routing; no new transition handler is allowed.

- [ ] **Step 4: Run detail and document/issuance tests**

  Run: `npm test -- test/pcn-dossier-detail.test.ts test/pcn-dossier-documents.test.ts test/pcn-issuance-boundary.test.ts test/pcn-approval-evidence.test.ts`

  Expected: PASS; status changes, upload, generation, approval, private file links, and activity history remain covered.

### Task 5: Update design-contract tests and remove obsolete visible station copy

**Files:**
- Modify: `test/pcn-pipeline.test.ts`
- Modify: `test/pcn-dossier-detail.test.ts`
- Modify: `test/pcn-ui-contract.test.ts`
- Modify: `components/PcnPipelineBoard.tsx`
- Modify: `components/PcnDossierDetailView.tsx`

**Interfaces:**
- Consumes: the projection/component contracts from Tasks 1–4.
- Produces: regression coverage proving the graphic is canonical and the old station board/summary is no longer rendered.

- [ ] **Step 1: Search for remaining user-visible station UI**

  Run: `rg -n "Mỗi cột là một trạm|Trạm hiện tại|Checklist trạm|Tài liệu còn thiếu tại trạm|Hồ sơ cần làm tại trạm|<DossierStationSummary|function StationColumn" components test`

  Expected: no matches in active PCN UI; internal adapter names such as `getPcnPipelineStation` may remain in pure routing code and test fixtures.

- [ ] **Step 2: Add/adjust meaningful regression assertions**

  Assert the new graphic map appears in Dashboard and detail, the dashboard has a single dossier-card rendering path, the exception node is represented in the graphic, and old station-column/summary components are absent from rendered paths. Keep assertions for real status mapping, checklist validity, field scope, deadline, permissions, and existing detail tabs.

- [ ] **Step 3: Run the focused regression suite**

  Run: `npm test -- test/pcn-workflow-map.test.ts test/pcn-workflow-map-ui.test.ts test/pcn-pipeline.test.ts test/pcn-dossier-detail.test.ts test/pcn-ui-contract.test.ts`

  Expected: PASS.

### Task 6: Full verification and visual runtime check

**Files:**
- No new files; inspect all changed files and generated test output.

**Interfaces:**
- Consumes: completed pure projection, graphic component, dashboard, detail integration, and existing PCN server/runtime.
- Produces: verified implementation at the existing development port `1357` with no schema/API changes.

- [ ] **Step 1: Run formatting/diff safety checks**

  Run: `git diff --check`

  Expected: no whitespace errors.

- [ ] **Step 2: Run the complete test suite**

  Run: `npm test`

  Expected: all repository tests pass, including PCN, DDT legacy, auth, file, issuance, and activity tests.

- [ ] **Step 3: Run typecheck/lint and production build**

  Run: `npm run lint`

  Expected: TypeScript exits 0 without disabling strictness or adding broad `any`.

  Run: `npm run build`

  Expected: Next.js production build exits 0.

- [ ] **Step 4: Verify the existing server remains on port 1357**

  Run: `netstat -ano | Select-String ':1357'` and `Invoke-WebRequest -UseBasicParsing http://127.0.0.1:1357/api/health`

  Expected: a listener exists on `1357` and `/api/health` returns HTTP 200; do not edit `.env` or start a second server on another port.

- [ ] **Step 5: Inspect the rendered workflow in the local app**

  Use the in-app browser at `http://127.0.0.1:1357`, open Dashboard → `Bản đồ quy trình`, click a node, open a dossier card, click several workflow nodes, verify mobile-width wrapping/scrolling, and verify viewer/read-only behavior. Confirm that the visible interface has graphic nodes and cards, not station columns or a station summary block.

- [ ] **Step 6: Review final scope**

  Run: `git status --short` and `git diff --stat`

  Expected: only the documented design/spec/plan, workflow projection/component, dashboard/detail integrations, and focused tests are changed; no `.env`, schema migration, unrelated DDT module, or generated binary is modified.
