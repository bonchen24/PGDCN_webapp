# PCN Dynamic Dossier Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Implement versioned workflow templates per PCN dossier type, snapshot the selected topology when a dossier is created, project parallel/branch/return runtime state, and open every dossier at the canonical standalone route `/pgdcn/pcn/dossiers/[dossierId]`.

**Architecture:** Keep `CertificationDossier.status` and the existing PYC/KQTN/approval/issuance boundaries intact. Add a manager-controlled `pcnWorkflowTemplates` catalog, immutable published revisions, a dossier-owned workflow snapshot, and `pcnDossierWorkflowTasks` for node-level runtime state. The existing five-step/station modules remain adapters for legacy rows and `actionKey` targets; they are not the dynamic workflow model.

**Tech Stack:** Next.js App Router, React/TypeScript, Zustand, Express server in `server.ts`, PostgreSQL JSONB `app_documents`, Node `node:test` contract tests, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-06-pcn-dynamic-dossier-workflow-design.md`; `design.md` sections 0.2.2 and 0.8 are the authoritative amendment for this feature.

## Global Constraints

- Preserve existing PCN boundaries for private files, PYC, KQTN, approval, issuance, audit, and legacy dossiers.
- Published templates are immutable; edits create a new draft revision and publication is manager/admin-only through `isPcnSystemManager` on both client and server.
- Client payloads, query parameters, and selected node ids never authorize access or mutation.
- No file bytes, credentials, or private storage paths enter workflow templates, snapshots, HTML artifacts, or static projections.
- Follow TDD for each production utility/boundary: add a failing focused test, implement the smallest change, rerun the focused test, then run the relevant regression suite.
- Use `apply_patch` for all source/document edits and keep unrelated working-tree changes untouched.

## Task 1: Add the workflow domain model and deterministic pure runtime rules

**Files:** `types.ts`, `utils/pcnWorkflowTemplate.ts`, `utils/pcnWorkflowRuntime.ts`, `test/pcn-workflow-template.test.ts`, `test/pcn-workflow-runtime.test.ts`.

1. Add types for `PcnWorkflowTemplate`, node kinds, transition definitions, snapshot, task status, return policy, and task records. Add optional snapshot/template fields to `CertificationDossier` without changing required legacy fixtures.
2. Write failing tests for: graph validation, allowed condition predicates, deterministic template selection by field/method/dossier type, published immutability, snapshot deep-copy isolation, legacy adapter fallback, predecessor readiness, split/join `ALL`/`ANY`/`QUORUM`, and return target/cycle/stale dependency projection.
3. Implement pure functions with no browser/database imports:
   - `validatePcnWorkflowTemplate`
   - `selectPcnPublishedWorkflowTemplate`
   - `snapshotPcnWorkflowTemplate`
   - `getPcnWorkflowForDossier`
   - `buildPcnWorkflowTaskSeed`
   - `projectPcnWorkflowRuntime`
   - `applyPcnWorkflowReturn`
   - `isPcnWorkflowTransitionAllowed`
4. Use a safe allowlist for conditions (`ALWAYS`, required-document-complete, any-result-returned, result-failed, approval-returned, field/method match); never evaluate arbitrary client code.
5. Run focused tests and `git diff --check` before moving on.

## Task 2: Persist templates and node runtime through dedicated PCN server boundaries

**Files:** `utils/pcnWorkflowTemplateApi.ts`, `utils/pcnWorkflowTaskApi.ts`, `server.ts`, `sql/pcn-schema.sql`, `test/pcn-workflow-api-contract.test.ts`, `test/pcn-workflow-rbac.test.ts`.

1. Add the two new collections to the PCN allowlist/schema comments/index coverage and add append-only/version-aware audit expectations.
2. Write failing API/RBAC contract tests for unauthenticated, viewer, staff, manager, and admin behavior; draft create/update, publish, retire, task start/complete/return, and the published-immutable rule.
3. Add server helpers that load the authenticated PCN actor, use `isPcnSystemManager`, validate templates against current requirements, and return safe runtime projections.
4. Add dedicated routes for template list/create/revision/publish/retire and dossier task list/start/complete/return. Keep generic `/api/db` writes blocked for both workflow collections.
5. Make the intake transaction select one published template, validate applicability, persist dossier template id/version/snapshot and initial tasks atomically/idempotently. If no applicable template exists, return a structured validation error rather than silently using an arbitrary template.
6. Ensure task transitions lock the dossier/task rows, reject topology tampering, calculate stale dependencies from the stored snapshot, and write an activity log with actor, return reason, target node and cycle.
7. Run focused API/RBAC tests plus the existing intake, store-RBAC, and activity-boundary tests.

## Task 3: Load workflow data in the PCN store and keep mutations consistent

**Files:** `store-pcn.ts`, `utils/pcnWorkflowTemplateApi.ts`, `utils/pcnWorkflowTaskApi.ts`, `utils/pcnIntakeApi.ts`, `test/pcn-workflow-store.test.ts`.

1. Write failing store contract tests for loading templates/tasks, resetting them, retaining snapshots after a template revision, and updating runtime tasks only from server responses.
2. Extend the store state/load/reset actions with `workflowTemplates` and `workflowTasks` while preserving legacy fallback behavior for dossiers without snapshots.
3. Add guarded store actions for manager template revision/publish/retire and operator task start/complete/return; viewer remains read-only and staff cannot mutate the template catalog.
4. Update intake response handling so a newly created dossier stores the server snapshot and returned initial task rows; do not fabricate a client snapshot.
5. Run focused tests and the complete existing store/intake/RBAC regressions.

## Task 4: Project and render a dynamic workflow map with compact node panels

**Files:** `utils/pcnWorkflowMap.ts`, `components/PcnWorkflowMap.tsx`, new `components/PcnWorkflowNodePanel.tsx`, `components/PcnDossierWorkflowPanel.tsx`, `test/pcn-workflow-ui.test.ts`, `test/pcn-workflow-map.test.ts`.

1. Add failing pure/UI contract tests proving the map uses snapshot nodes/transitions when present, renders split/join/decision/exception edges, exposes parallel active nodes, displays return target/reason/cycle, and retains the current legacy adapter for old rows.
2. Extend the projection types with node kind, edge, task status, assigned user, requirement summaries, and return metadata. Keep the aggregate dashboard projection compact and dossier projection interactive.
3. Implement the accessible dynamic map with controlled horizontal overflow on desktop and vertical stacking on mobile. Use buttons only for dossier-selectable nodes and preserve `aria-current`, `aria-pressed`, and readable labels.
4. Implement `PcnWorkflowNodePanel` as closed-by-default details with a compact header; expanded content shows only authorized dossier metadata, checklist requirements, current document version metadata, task history, return reason, and action callbacks.
5. Connect `actionKey` to existing module tabs/boundaries without creating generic bypass actions.
6. Run focused UI/projection tests and existing workflow-map, mobile-scroll, dossier-detail, and private-file contract tests.

## Task 5: Convert dossier opening to the canonical standalone route

**Files:** `app/pgdcn/pcn/dossiers/[dossierId]/page.tsx`, `components/PgdcnAppShell.tsx`, `components/PcnWorkspace.tsx`, `components/PcnDossierDetailView.tsx`, `components/PcnDossierDetailPage.tsx` (if extraction is needed), `utils/pcnDossierNavigation.ts`, `test/pcn-dossier-route.test.ts`, `test/pcn-pgd-navigation.test.ts`.

1. Write failing route/UI tests for the canonical pathname, direct refresh/deep link, unknown dossier, `node`/`tab` query handling, and back/fallback navigation.
2. Add a dynamic App Router page that passes only the dossier id/query to a client detail surface. The surface loads the authorized PCN store, shows a not-found state for an absent/filtered dossier, and never places the detail view in a fixed modal overlay.
3. Update every `onOpenDossier` path (dashboard, queue, proposal register, operations, lab, assistant, notifications) to navigate to the encoded dossier URL while preserving node/tab context in query parameters.
4. Keep the shared PGDCN shell usable for the standalone page; make close/back return to `/pgdcn/pcn` or the previous history entry and prevent stale selected-dossier state from reopening an overlay.
5. Preserve existing region modules and mutation callbacks in the standalone page, including the package download and private-file actions.
6. Run route/UI tests plus all existing dossier-detail/navigation regressions.

## Task 6: Add manager/admin workflow-template management to the existing PCN settings surface

**Files:** new `components/PcnWorkflowTemplateManagementView.tsx`, `components/PcnSettingsView.tsx`, `components/PgdcnAppShell.tsx`, `components/PcnWorkspace.tsx`, `components/PcnSidebar.tsx`, `utils/pcnRbac.ts`, `test/pcn-workflow-template-management-ui.test.ts`.

1. Write failing UI/RBAC tests that manager and admin can see the configuration surface, staff/viewer cannot edit it, and published definitions show a revision/publish affordance instead of in-place editing.
2. Add a compact template list/editor for metadata, node rows, transitions, requirement ids, action keys, split/join policy, assignee role, and SLA. The editor is form-based; no free-form WYSIWYG graph is required.
3. Add draft validation feedback, create-revision, publish, retire, and read-only snapshot/version indicators. Disable invalid transitions and requirement ids before submit, while retaining server validation as authoritative.
4. Update navigation visibility to use `isPcnSystemManager` for workflow administration without broadening unrelated user/template/file administration permissions.
5. Run focused UI/RBAC tests and the full existing settings/navigation suite.

## Task 7: Migrate/default-seed compatibility and final verification

**Files:** `sql/pcn-schema.sql`, new migration under `sql/` if required by the project convention, `utils/pcnStandardDossierSeed.ts`, `test/pcn-workflow-migration.test.ts`, docs touched only where the implementation contract requires.

1. Add a deterministic default published template that adapts the current PCN modules and document requirements, including at least one optional parallel branch and a return path, without changing existing dossier/file rows.
2. Add read-only fallback projection tests for legacy dossiers and snapshot immutability tests after publishing a new template revision.
3. Update backup/restore collection allowlists and schema indexes so templates, snapshots, tasks, and task audit data survive operational backup flows.
4. Run the complete fresh verification sequence:
   - `git diff --check`
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - targeted runtime/route smoke check on the configured PCN port 1357 when the local services are available
5. Inspect the final diff for accidental PII/file bytes, confirm branch name, and only then use `superpowers:finishing-a-development-branch` to present integration options.
