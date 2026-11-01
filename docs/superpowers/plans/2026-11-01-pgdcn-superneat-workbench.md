# PGDCN Superneat Workbench Implementation Plan

> **For agentic workers:** Execute wave by wave with `superpowers:executing-plans`. The Codex coordinator invokes AGY for each atomic implementation task, reviews every diff, and runs the scoped checks before starting the next wave.

**Goal:** Deliver the approved Superneat Enterprise Workbench across all authorized PGDCN destinations while preserving business flows, permissions, stored data, APIs, and audit behavior.

**Architecture:** Reuse the existing PGDCN shell, UI primitives, dossier workspaces, queues, and domain stores. Apply one light, compact shared visual system and route-aware navigation; keep PCN and PGD workflows, ownership, and permissions separate. Add only read-only projections and side peek behavior where the existing canonical route and data permit it.

**Tech Stack:** Next.js 16.4, React 19, TypeScript, Tailwind CSS 4, Zustand, Node test runner, Playwright.

**Spec:** `design.md` sections 0.2, 0A.4, 5A.42, and 5A.43, plus the approved task context package dated 2026-11-01.

## Global Constraints

- Preserve the 13 authorized destinations and server-side RBAC; do not add a market development route or duplicate shared pages inside PCN/PGD navigation.
- Keep PCN and PGD data, permissions, state transitions, audit, approval, and canonical routes separate.
- Preserve the six dashboard KPI projections, single actionable dossier row, PCN card-driven proposals, PGD 12-task rail, and immutable PCN workflow snapshots.
- A checklist, document generation, upload, AI review, or side peek never confirms evidence or changes business state; only existing authorized server actions do.
- Add no database schema or backend changes, heavy UI dependencies, production deployment, or production database operation.
- Use 14–16px body text, readable labels, subdued borders, domain colors distinct from status colors, accessible focus, reduced motion, and touch targets of at least 44px on mobile.
- Prevent body horizontal overflow at 320, 375, 390, 430, 768, 1280, and 1440px.
- Keep existing unrelated working-tree changes out of this branch and commit only task files after verification.

---

### Task 1: Shell, Sidebar, and Navigation (Wave P0-1)

**Files:** `components/PgdcnSidebar.tsx`, `components/PgdcnAppShell.tsx`, `app/pgdcn/page.tsx`, `app/pgdcn/pcn/page.tsx`, `app/pgdcn/pgd/page.tsx`, navigation helpers under `utils/`, and focused PGDCN navigation/shell tests under `test/`.

- [x] Inventory all 13 authorized destinations, their current route mapping, scope visibility, and exact labels.
- [x] Add failing tests for exact labels, active route state, browser Back/Forward, focus restoration, and notification closure on navigation.
- [x] Update the shell and sidebar to the light Superneat visual contract while retaining grouped collapsible navigation, PCN/PGD domain colors, mobile drawer dismissal, and current RBAC.
- [x] Persist destination state in supported URL state and restore the active view on direct load and browser history navigation.
- [x] Run shell/navigation tests and typecheck; inspect the desktop and mobile result before proceeding.

### Task 2: Dashboard and Work Queues (Wave P0-2)

**Files:** `components/PgdcnDashboardView.tsx`, `components/PcnDossierQueueView.tsx`, `components/PgdDossierQueueView.tsx`, dashboard projections in `utils/`, shared UI primitives, and focused dashboard/queue tests.

- [x] Confirm the dashboard still exposes exactly the six approved KPIs in order and respects department scopes.
- [x] Add failing tests for compact priority items, due/current-step/owner/missing-evidence/next-action context, and no duplicate dossier action rows.
- [x] Refine dashboard pipeline, milestones, notification feed, and responsive queues; retain PCN proposal cards and PGD list/table behavior.
- [x] Add read-only desktop side peek/mobile sheet only where existing queue projections support it; verify opening the canonical dossier preserves filters and scroll context.
- [x] Run dashboard, queue, projection, typecheck, and targeted viewport checks.

### Task 3: Canonical Dossier Workbench (Wave P0-3)

**Files:** `components/PcnDossierDetailView.tsx`, `components/PcnDossierFlow.tsx`, `components/PcnDossierNodeWorkPanel.tsx`, `components/PgdDossierBusinessWorkspace.tsx`, `components/PgdDossierFlow.tsx`, `components/PgdDossierStepWorkPanel.tsx`, shared dossier primitives, and focused dossier/document workflow tests.

- [x] Trace the existing canonical PCN dossier and PGD PYC routes, workflow access, checklist classification, and document confirmation boundaries.
- [x] Add failing tests for workflow navigation without state mutation, locked steps, document status distinctions, and current-node versus dossier-wide missing evidence counts.
- [x] Refine shared workbench anatomy while preserving PCN snapshot topology/branching and the PGD 12-job rail derived from the existing five-stage state.
- [x] Keep peek panels read-only and direct all mutations through the existing authorized workflow/document actions.
- [x] Run focused PCN/PGD dossier and document tests plus typecheck.

### Task 4: Data Registers and Sample Management (Wave P1-4)

**Files:** `components/PgdcnDossierSummaryGrid.tsx`, `components/PcnWorkspace.tsx`, `components/PgdWorkspace.tsx`, PCN/PGD operations and sample views, relevant projection helpers, and focused register/sample tests.

- [x] Map editable metadata to existing whitelists and server authorization; treat all workflow/lifecycle/result/issuance fields as read-only projections.
- [x] Add failing tests for compact responsive columns, accessible search/sort/filter controls, and separate sample/model/route/status/PYC/KQTN identity.
- [x] Refine register density and sample/model disclosure without changing persistence or adding saved-filter storage.
- [x] Run register, sample, permissions, and viewport checks.

### Task 5: Drafting and Template Management (Wave P1-5)

**Files:** `components/PgdcnUnifiedDraftingView.tsx`, `components/PgdcnDossierTemplateManagementView.tsx`, existing domain drafting/template components and helpers, and focused drafting/template tests.

- [x] Trace DOCX source loading, draft return context, external evidence upload, and authorized confirm-and-attach operations for both domains.
- [x] Add failing tests for domain separation, desktop/mobile sequencing, existing source-context autofill, and generation/upload versus confirmation state.
- [x] Refine the shared drafting workspace and keep workflow-template management separate from domain DOCX template settings.
- [x] Run focused drafting, template, route-context, permissions, and typecheck checks.

### Task 6: Shared Destinations (Wave P2-6)

**Files:** `components/PgdcnCustomersView.tsx`, `components/PgdcnAssistantView.tsx`, `components/ActivityLogView.tsx`, `components/PgdcnSystemSettingsView.tsx`, shared UI primitives, and focused tests for each surface.

- [x] Verify customer import preview, validation, export scope, AI advisory behavior, activity filtering, and admin/manager settings permissions before visual changes.
- [x] Add focused tests for compact responsive presentation, 11 independent PGD AI criteria with evidence links, safe error messages, and role-limited settings.
- [x] Refine these destinations using shared empty/loading/error/success states and the compact light visual system.
- [x] Run the affected page tests, accessibility checks, and typecheck.

### Task 7: Cross-Wave Verification and Delivery

**Files:** task-scoped UI tests, Playwright capture scripts or fixtures as needed, screenshots under `docs/ux-audit/artifacts/superneat/2026-11-01/`, and the targeted persistent UI contract in `design.md`.

- [x] Exercise the three critical journeys with synthetic or mocked data only; assert no API mutation from peek or AI review.
- [x] Capture reviewed desktop and mobile screenshots and verify no horizontal overflow at every required viewport, keyboard/focus behavior, and readable labels.
- [x] Run `npm run typecheck`, `npm test`, and `npm run build`; report exact outcomes and limitations.
- [x] Inspect the final diff, scan for destructive SQL, stage only scoped files, and create a conventional commit on `task/c2c/pgdcn-superneat-ui-20261101`.
- [x] Do not deploy or run migrations.
