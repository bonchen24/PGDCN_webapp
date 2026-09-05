# PGDCN shared dashboard redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the shared PGDCN dashboard as an action-first Operations cockpit for PCN and PGD without merging their data or workflows.

**Architecture:** Keep `PgdcnAppShell` as the owner of shared navigation, session scope and notification state. Extend the pure `getPgdcnDashboardProjection` read model with pipeline summaries, prioritized attention rows and upcoming milestones, then render those projections in a responsive `PgdcnDashboardView`; domain cards and rows continue to navigate into the existing PCN/PGD workspaces.

**Tech Stack:** Next.js App Router, React 18, TypeScript 5.8, Tailwind CSS, lucide-react, Node test runner via tsx.

**Spec:** `docs/superpowers/specs/2026-09-03-pgdcn-shared-dashboard-redesign-design.md`

## Global Constraints

- `design.md` is the single source of truth for the dashboard UI contract and must be followed.
- PCN and PGD collections, types, status enums, lifecycle rules and canonical cards remain separate.
- Dashboard data is read-only projection data; no new collection, schema field, mutation endpoint or workflow transition is allowed.
- Header/dashboard action area contains no AI or activity-log action; those routes remain accessible from the shared sidebar.
- PCN keeps emerald accents, PGD keeps blue accents; status cannot be communicated by color alone.
- Preserve `data-testid="pgdcn-dashboard-kpi-grid"` and `data-testid="pgdcn-dashboard-notifications"`.
- Use `pcn-page-surface`, `ddt-compact`, `mobile-scroll-y`, `mobile-safe-bottom`, `mobile-touch-target` and `min-w-0` contracts.
- Preserve unrelated user changes in the dirty worktree; stage/commit only files belonging to this feature when Git writes are needed.

---

### Task 1: Extend and test the shared dashboard projection

**Files:**
- Modify: `utils/pgdcnDashboard.ts`
- Create: `test/pgdcn-dashboard.test.ts`

**Interfaces:**
- Consumes: `DepartmentScope`, `CertificationDossier`-compatible snapshots, `PgdInspectionRequest`-compatible snapshots.
- Produces: `PgdcnDashboardProjection` with existing `kpis` plus `domainSummaries`, `attention` and `upcoming` arrays consumed by `PgdcnDashboardView`.

- [ ] **Step 1: Write failing projection tests**

Create fixtures with PCN statuses `AWAITING_DOCUMENTS`, `WAITING_APPROVAL`, `ARCHIVED` and `ON_HOLD`, plus PGD statuses `CAPABILITY_REVIEW`, `WAITING_LAB_RESULTS`, `RESULT_RETURNED` and an invalid date. Assert the projection contract below:

```ts
test('projects scope-correct domain summaries, attention ordering and milestones', () => {
  const result = getPgdcnDashboardProjection({
    scopes: ['PCN', 'PGD'],
    pcnDossiers: [
      { id: 'pcn-overdue', dossierCode: 'HS-PCN-001', status: 'AWAITING_DOCUMENTS', targetDate: '2026-09-01' },
      { id: 'pcn-approval', dossierCode: 'HS-PCN-002', status: 'WAITING_APPROVAL', targetDate: '2026-09-10' },
      { id: 'pcn-archived', dossierCode: 'HS-PCN-003', status: 'ARCHIVED', targetDate: '2026-08-01' },
    ],
    pgdRequests: [
      { id: 'pgd-lab', requestCode: 'PYC-PGD-001', status: 'WAITING_LAB_RESULTS', inspectionScheduledAt: '2026-09-06T09:00:00+07:00' },
      { id: 'pgd-capability', requestCode: 'PYC-PGD-002', status: 'CAPABILITY_REVIEW', inspectionScheduledAt: 'not-a-date' },
    ],
    now: new Date('2026-09-03T08:00:00+07:00'),
  });

  assert.deepEqual(result.kpis, {
    pcnDossiers: 3,
    pgdRequests: 2,
    pcnWork: 2,
    pgdWork: 2,
    aiCandidates: 1,
    attention: 3,
  });
  assert.equal(result.attention[0].id, 'pcn-overdue');
  assert.equal(result.attention[0].reason, 'OVERDUE');
  assert.equal(result.attention[0].statusLabel, 'Chờ bổ sung hồ sơ');
  assert.deepEqual(result.upcoming.map(item => item.id), ['pgd-lab', 'pcn-approval']);
  assert.equal(result.domainSummaries.find(item => item.domain === 'PCN')?.bottleneckLabel, 'Chờ bổ sung hồ sơ');
});

test('does not expose or count an unauthorized domain', () => {
  const result = getPgdcnDashboardProjection({
    scopes: ['PCN'],
    pcnDossiers: [{ id: 'pcn-1', status: 'TECHNICAL_REVIEW' }],
    pgdRequests: [{ id: 'pgd-1', status: 'FIELD_INSPECTION' }],
  });

  assert.equal(result.kpis.pcnDossiers, 1);
  assert.equal(result.kpis.pgdRequests, 0);
  assert.deepEqual(result.domainSummaries.map(item => item.domain), ['PCN']);
  assert.equal(result.attention.every(item => item.domain === 'PCN'), true);
  assert.equal(result.upcoming.every(item => item.domain === 'PCN'), true);
});

test('pipeline segments reconcile with the loaded source total including unknown statuses', () => {
  const result = getPgdcnDashboardProjection({
    scopes: ['PGD'],
    pcnDossiers: [],
    pgdRequests: [
      { id: 'pgd-1', status: 'FIELD_INSPECTION' },
      { id: 'pgd-2', status: 'ON_HOLD' },
    ],
  });
  const summary = result.domainSummaries[0];
  assert.equal(summary.total, 2);
  assert.equal(summary.segments.reduce((sum, segment) => sum + segment.count, 0), 2);
  assert.equal(summary.segments.some(segment => segment.key === 'OTHER'), true);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dashboard.test.ts`

Expected: FAIL because the new `domainSummaries`, `upcoming` and display-label fields are not implemented yet.

- [ ] **Step 3: Implement the pure projection**

In `utils/pgdcnDashboard.ts`:

1. Keep the existing KPI field names and status sets.
2. Add `PgdcnDashboardDomain`, `DashboardAttentionReason`, `PgdcnDashboardPipelineSegment`, `PgdcnDashboardDomainSummary` and `PgdcnDashboardUpcomingItem` types from the spec.
3. Add explicit Vietnamese status-label maps for every PCN/PGD status used by the dashboard, with `UNKNOWN` falling back to `Chưa xác định`.
4. Add fixed pipeline definitions with keys, labels and tones. Include `OTHER` for any non-closed status not matched by a named segment.
5. Filter source arrays by scope before calculating KPI, summaries, attention or upcoming items.
6. Build bottlenecks with the fixed domain-specific priority order from the spec. Use `Không có điểm nghẽn` and count `0` when a domain has no work.
7. Reuse end-of-day date parsing for date-only values. Mark overdue only for valid dates before `now`.
8. Sort attention by overdue before work, then domain status priority, then domain and id. Sort upcoming ascending by parsed date, then domain and id, and cap at five.

Use small pure helpers (`getStatusLabel`, `buildSegments`, `getBottleneck`, `buildAttention`, `buildUpcoming`) so each rule is independently readable and no component performs business counting.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dashboard.test.ts`

Expected: PASS for all projection tests.

- [ ] **Step 5: Commit the projection slice**

```bash
git add utils/pgdcnDashboard.ts test/pgdcn-dashboard.test.ts
git commit -m "feat: extend shared dashboard projection"
```

Only the two listed feature files may be staged by this step.

### Task 2: Rebuild the shared dashboard UI as an Operations cockpit

**Files:**
- Modify: `components/PgdcnDashboardView.tsx`
- Modify: `test/pgdcn-dashboard.test.ts`

**Interfaces:**
- Consumes: `PgdcnDashboardProjection` from Task 1 and shell callbacks.
- Produces: `PgdcnDashboardView` with the command header, six-KPI strip, attention queue, domain pipeline, upcoming milestones and shared notifications.

- [ ] **Step 1: Add UI contract assertions before changing markup**

Extend `test/pgdcn-dashboard.test.ts` with source-contract assertions that read `components/PgdcnDashboardView.tsx` and verify:

```ts
assert.match(source, /data-testid="pgdcn-dashboard-kpi-grid"/);
assert.match(source, /data-testid="pgdcn-dashboard-notifications"/);
assert.match(source, /data-testid="pgdcn-dashboard-attention-queue"/);
assert.match(source, /data-testid="pgdcn-dashboard-domain-cards"/);
assert.match(source, /data-testid="pgdcn-dashboard-upcoming"/);
assert.match(source, /Tạo Đề nghị/);
assert.match(source, /Tiếp nhận PYC/);
assert.doesNotMatch(source, />\s*Trợ lý AI\s*</);
assert.doesNotMatch(source, />\s*Nhật ký hoạt động\s*</);
assert.match(source, /onOpenPcnWorkspace/);
assert.match(source, /onOpenPgdWorkspace/);
```

- [ ] **Step 2: Run the UI contract test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dashboard.test.ts`

Expected: FAIL because the current component still renders the old two-card layout and AI/activity actions.

- [ ] **Step 3: Implement the cockpit components in the dashboard file**

Refactor `PgdcnDashboardView.tsx` into focused local render helpers:

1. `Kpi` keeps the existing six labels, icon tones and test id, with equal-height cards and `min-w-0`.
2. `CommandHeader` renders title `Điều hành phòng`, description, and only scope-authorized `Tạo Đề nghị`/`Tiếp nhận PYC` navigation buttons. It does not render AI/activity actions.
3. `AttentionQueue` renders up to the projected attention rows with overdue-first styling, Vietnamese status/reason copy, optional due label and domain-specific open callback. Empty state says `Không có hồ sơ cần chú ý.`
4. `DomainPipelineCard` renders total/work/attention, bottleneck label/count, accessible status distribution text and CSS bars from segments. Keep PCN/PGD panels visually separate.
5. `UpcomingMilestones` renders the projected five-row maximum and opens the correct domain callback. Empty state says `Chưa có mốc sắp tới.`
6. `SharedNotifications` keeps the existing notification id, domain badge, unread styling and `onSelectNotification` callback. Keep `onOpenNotifications` for `Xem tất cả`.
7. Remove `onOpenAssistant` and `onOpenActivity` from the component prop type and implementation. Keep the dashboard's sidebar routes unchanged elsewhere.
8. Use the responsive layout from the spec: queue/pipeline in a desktop two-column grid; milestones/notifications in a lower two-column grid; stack all blocks on mobile; preserve `mobile-safe-bottom`.

All row buttons must use `mobile-touch-target`, visible text labels, `aria-label` where the row label is truncated, and no hover-only behavior.

- [ ] **Step 4: Run projection and UI contract tests**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dashboard.test.ts`

Expected: PASS for projection behavior and the new component contract assertions.

- [ ] **Step 5: Commit the dashboard UI slice**

```bash
git add components/PgdcnDashboardView.tsx test/pgdcn-dashboard.test.ts
git commit -m "feat: redesign shared dashboard cockpit"
```

Only the listed feature files may be staged by this step.

### Task 3: Wire scope-authorized workspace CTAs through the shared shell

**Files:**
- Modify: `components/PgdcnAppShell.tsx`
- Modify: `test/pgdcn-dashboard.test.ts`

**Interfaces:**
- Consumes: `PgdcnDashboardView` callback contract from Task 2.
- Produces: `onOpenPcnWorkspace` navigating to `{ domain: 'PCN', section: 'proposals' }` and `onOpenPgdWorkspace` navigating to `{ domain: 'PGD', section: 'intake' }`.

- [ ] **Step 1: Add shell wiring assertions**

Extend the source contract test with:

```ts
const shellSource = fs.readFileSync(new URL('../components/PgdcnAppShell.tsx', import.meta.url), 'utf8');
assert.match(shellSource, /onOpenPcnWorkspace=\{\(\) => setActiveTarget\(\{ domain: 'PCN', section: 'proposals' \}\)\}/);
assert.match(shellSource, /onOpenPgdWorkspace=\{\(\) => setActiveTarget\(\{ domain: 'PGD', section: 'intake' \}\)\}/);
assert.doesNotMatch(shellSource, /onOpenAssistant=\{\(\) => navigate/);
assert.doesNotMatch(shellSource, /onOpenActivity=\{\(\) => navigate/);
```

- [ ] **Step 2: Run the wiring assertion to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dashboard.test.ts`

Expected: FAIL because the shell currently passes `onOpenAssistant` and `onOpenActivity` and has no business CTA callbacks.

- [ ] **Step 3: Implement the shell callback wiring**

In `PgdcnAppShell.tsx`:

1. Add `openPcnWorkspace` and `openPgdWorkspace` functions that set the target and close mobile navigation.
2. Pass those callbacks to `PgdcnDashboardView`.
3. Remove only the dashboard props `onOpenAssistant` and `onOpenActivity`; keep their shared target branches, sidebar navigation and notification handlers intact.
4. Do not alter session loading, scope filtering, notification API calls or domain workspace callbacks.

- [ ] **Step 4: Run the focused test and typecheck**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dashboard.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: TypeScript completes without new errors in the dashboard files.

- [ ] **Step 5: Commit the shell wiring slice**

```bash
git add components/PgdcnAppShell.tsx test/pgdcn-dashboard.test.ts
git commit -m "feat: wire shared dashboard workspace actions"
```

Only the listed feature files may be staged by this step.

### Task 4: Run full verification and inspect the responsive result

**Files:**
- Modify: none unless verification exposes a feature regression.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: verified dashboard implementation with no unrelated worktree changes staged.

- [ ] **Step 1: Run the active PCN test suite**

Run: `npm test`

Expected: the active PCN contract suite passes; unrelated pre-existing failures must be reported with their exact command/output.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: Next.js production build completes successfully.

- [ ] **Step 3: Check the final diff for whitespace errors**

Run: `git diff --check`

Expected: no whitespace errors. Confirm `git status --short` shows only the feature files as changes beyond the pre-existing user worktree state.

- [ ] **Step 4: Inspect the rendered dashboard at desktop and mobile widths**

Run the local app using the repository's existing development command: `npm run dev:pcn`.

Open `/pgdcn/` in the local browser and inspect:

- desktop: command header, six equal KPIs, wide attention queue, narrow pipeline cards, lower milestones/notifications;
- mobile widths 320px, 375px, 390px and 430px: two-column KPI strip, stacked action-first sections, no page-level horizontal overflow, 44px-class row actions;
- a PCN-only session: no PGD counts/CTA;
- a PGD-only session: no PCN counts/CTA.

Do not change user data while performing visual QA.

- [ ] **Step 5: Run final focused tests after any verification-only fixes**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-dashboard.test.ts`

Expected: PASS.
