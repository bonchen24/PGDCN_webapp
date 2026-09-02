# Implementation Plan: PGDCN unified shell, dashboard, AI and department activity log

**Goal:** Replace the `/pgdcn/` chooser with one authenticated department shell for Chứng nhận (PCN) and Giám định (PGD), add a read-only department dashboard, extend the AI assistant to both domains, and make `Nhật ký hoạt động` a whole-room audit projection over the PCN and PGD audit sources.

**Architecture:** Keep PCN and PGD stores, collections, lifecycle states, mutation APIs and RBAC boundaries separate. Add a thin shared shell/projection layer that owns navigation and read-only cross-domain views. The shared activity endpoint unions `activityLogs` and `pgdActivityLogs` at read time, normalizes a `domain` field, and never copies data into a third business collection. AI uses a discriminated domain request and domain-specific adapters/checks; it never mutates source records.

**Tech stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Zustand, existing PostgreSQL/API helpers, Node test runner and the repository's `npm run test:pcn`/`npm run lint`/`npm run build` commands.

## 1. Lock contracts and write failing tests first

**Files to add/modify:**

- `types.ts`
- `utils/activityLog.ts`
- `utils/activityLogApi.ts`
- `test/activity-log-domain.test.ts` (new)
- `test/pgdcn-navigation-contract.test.ts` (new)
- `test/pgdcn-assistant-contract.test.ts` (new)

**Steps:**

1. Add the shared domain types and discriminated assistant request/result types from the approved spec without changing existing PCN/PGD record types.
2. Add contract tests for `PCN`/`PGD` activity normalization, legacy-domain inference, deterministic merged ordering, shared navigation scope, and assistant request discrimination.
3. Add tests that assert the shared navigation labels (`Tổng quan phòng`, `Trợ lý AI`, `Nhật ký hoạt động`, `CHỨNG NHẬN (PCN)`, `GIÁM ĐỊNH (PGD)`) and that a one-scope session cannot expose the other domain.
4. Run the focused tests and confirm they fail for the missing implementation. Do not weaken tests to match the current chooser or independent-shell behavior.

## 2. Build the department-wide activity projection and API

**Files to add/modify:**

- `types.ts`
- `utils/activityLog.ts`
- `utils/activityLogApi.ts`
- `server.ts`
- `test/activity-log-api.test.ts`
- `test/activity-log.test.ts`
- `test/activity-log-domain.test.ts`

**Steps:**

1. Extend the activity log projection with `domain: 'PCN' | 'PGD'` and an optional safe navigation target. Keep log writes append-only and preserve current PCN payload compatibility.
2. Normalize PCN records from `activityLogs` and PGD records from `pgdActivityLogs`; infer the domain for legacy rows at read time from source collection/entity type. Do not backfill or rewrite old rows.
3. Update the server activity read boundary to authenticate the shared PGDCN session and require at least one `departmentScope`. Add a domain filter and merge both sources using the stable `(createdAt DESC, domain DESC, id DESC)` ordering and cursor contract.
4. Ensure the response is a redacted audit projection. Only return a source navigation target when the caller has the corresponding domain scope; never allow a browser-supplied domain to authorize source reads.
5. Update summary/KPI aggregation and CSV-facing data to retain the domain column and support `all`/`PCN`/`PGD` filtering. Keep generic PCN mutation/append routes domain-safe and prevent edit/delete routes for activity events.
6. Add/adjust API tests for dual-scope union, single-scope redaction, empty-source behavior, same-timestamp ordering, cursor continuation, legacy inference, and rejection of unauthorized domain navigation.

## 3. Rework the activity log screen for the whole department

**Files to add/modify:**

- `components/ActivityLogView.tsx`
- `components/PcnUserKpiTable.tsx` (only shared presentation adjustments if required)
- `utils/activityLogTime.ts`
- `utils/activityLogKpi.ts`
- `test/activity-log-ui.test.ts`
- `test/pcn-activity-log-ui.test.ts`
- `test/activity-log-kpi.test.ts`

**Steps:**

1. Rename the visible surface to `Nhật ký hoạt động`, while retaining compatibility with the existing PCN entry and existing API client behavior.
2. Add the `Tất cả`/`PCN`/`PGD` domain selector, multi-select actor filter, existing action/entity/search controls and GMT+7 period selector. Omit the old free-form from/to UI.
3. Render a domain badge and safe source label on every row, preserve responsive stacked-bar KPI behavior, and add the `Miền` column to combined CSV export.
4. Hide or disable source-opening actions when the user lacks the row's domain scope; keep audit details readable without exposing unauthorized dossier/file data.
5. Keep the existing mobile scroll and touch behavior, no destructive controls, and no client-side full-log/Zustand cache.
6. Add UI contract tests for labels, filters, domain badges, CSV column, redacted navigation and mobile accessibility markers.

## 4. Introduce the shared PGDCN shell and domain-aware sidebar

**Files to add/modify:**

- `components/PgdcnAppShell.tsx` (new)
- `components/PgdcnSidebar.tsx` (new)
- `components/PcnAppShell.tsx`
- `components/PgdAppShell.tsx`
- `components/PcnWorkspace.tsx`
- `components/PgdWorkspace.tsx`
- `components/PcnSidebar.tsx`
- `components/PgdSidebar.tsx`
- `app/pgdcn/page.tsx`
- `app/pgdcn/pcn/page.tsx`
- `app/pgdcn/pgd/page.tsx`
- `test/pgdcn-navigation-contract.test.ts`
- existing PCN/PGD UI contract tests that assert shell entrypoints

**Steps:**

1. Extract shared service-worker/session/chrome responsibilities into `PgdcnAppShell`; keep the existing domain workspaces usable in embedded mode.
2. Replace the chooser at `/pgdcn/` with the shared shell defaulting to `Tổng quan phòng`; make compatibility routes select the corresponding initial domain without creating another chrome implementation.
3. Build one sidebar with department identity, shared entries, PCN group, PGD group, user identity and logout. Use emerald for PCN, blue for PGD, preserve collapsed rail/tooltips, `aria-current`, `aria-expanded`, mobile touch targets and scope-based menu visibility.
4. Adapt `PcnWorkspace` and `PgdWorkspace` so embedded mode receives selected section and callbacks from the shared shell, while their domain data stores and mutations remain local to their boundaries.
5. Preserve single-scope behavior: a PCN-only session cannot load PGD bootstrap/data; a PGD-only session cannot load PCN bootstrap/data; direct compatibility routes do not bypass server checks.
6. Run the focused navigation/RBAC tests and verify the old chooser no longer renders as the canonical signed-in entry.

## 5. Add the read-only department dashboard

**Files to add/modify:**

- `components/PgdcnDashboardView.tsx` (new)
- `components/PgdcnAppShell.tsx`
- `utils/pgdcnDashboard.ts` (new, pure projection helpers)
- `test/pgdcn-dashboard.test.ts` (new)
- `test/pcn-dashboard-layout.test.ts`

**Steps:**

1. Implement pure scope-aware projection helpers for the six KPI cards: PCN dossiers, PGD requests, PCN work, PGD work, AI candidates and overdue/attention items.
2. Render two domain cards and one compact tagged `Việc cần chú ý` list. Each action must route to the canonical PCN dossier or PGD request surface and never create a merged record.
3. Add a secondary action to open `Nhật ký hoạt động` without changing the selected domain.
4. Preserve the existing PCN six-column dashboard contract inside PCN and keep PGD's operational dashboard available inside PGD.
5. Enforce `min-w-0`, mobile two-column KPI layout, local overflow boundaries and visible status text/icon markers.
6. Test dual-scope projection, one-scope filtering, navigation callbacks and responsive/accessibility markers.

## 6. Generalize the AI assistant to PCN and PGD

**Files to add/modify:**

- `components/PgdcnAssistantView.tsx` (new shared workbench)
- `components/PcnAssistantView.tsx`
- `utils/pcnApprovalAssistant.ts` or the existing PCN assistant helper boundary
- `utils/pgdAssistant.ts` (new pure PGD checks)
- `server.ts` and/or existing domain assistant API handlers
- `components/PgdcnAppShell.tsx`
- `test/pcn-approval-assistant.test.ts`
- `test/pcn-approval-assistant-ui.test.ts`
- `test/pgdcn-assistant-contract.test.ts`
- `test/pgd-assistant.test.ts` (new)

**Steps:**

1. Create the shared assistant workbench with a PCN/PGD selector, domain-specific candidate search, status copy and typed finding display.
2. Refactor PCN candidate/review calls behind the discriminated adapter; build the PCN field selector from the active catalog and cover QC4, QC9 and QC20. Preserve the QC20 confirmation-gated `WARNING`/`NOT_EVALUABLE` behavior.
3. Implement pure PGD checks for the five stations: intake/capability, assignment, field/sample, laboratory/results and report/approval/return. Keep payment informational and non-blocking.
4. Add PGD candidate/review server handling that resolves the request and related snapshots from allowlisted PGD collections, validates `domain = pgd` provenance and enforces scope from the session rather than the payload.
5. Use one evidence/result presentation for both domains, show missing evidence separately from failed evidence, and prevent status/approval/file mutation. AI/OCR/private-asset failures become explicit `NOT_EVALUABLE`/error findings.
6. Add tests for PCN field catalog/QC20, all five PGD stations, provenance rejection, domain isolation, stream/error states and no-mutation behavior.

## 7. Integrate, verify and hand off safely

**Files to review:** all files changed in tasks 1–6; do not stage unrelated existing changes, generated `dist` output, attachments or `tmp/`.

**Steps:**

1. Run focused contract tests for activity, navigation, dashboard and assistant behavior; fix only regressions caused by this implementation.
2. Run `npm test`, `npm run lint`, `npm run build` and `git diff --check`.
3. Inspect the final diff for accidental cross-domain imports, direct browser access to PGD/PCN collections, unauthorized activity navigation, duplicate shell chrome and mobile overflow regressions.
4. Run the verification-before-completion checklist and report any pre-existing warnings separately from new failures.
5. Create implementation commits that include only the new shared-shell/activity/assistant changes and their tests; preserve the user's unrelated worktree modifications.

