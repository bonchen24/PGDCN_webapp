# Superneat Document Workspace Implementation Plan

> Execution is authorized by the user. Codex coordinates AGY CLI rounds, reviews each diff and commit, and continues through fixes and verification without another approval pause.

**Goal:** Deliver the daily PCN and PGD dossier workspace with compact queues, actionable dossier detail, contextual document drafting, and a revision-safe dossier-template manager.

**Architecture:** Keep PCN and PGD records, routes, permissions, workflow engines, and audit boundaries separate. Extend the existing canonical dossier and template snapshots; display the seven dossier stages as requirement groups without changing PCN QC4/QC9 proposal entry or PGD QC20 workflow gates. Use the native stage editor and existing document APIs; no Archify work is in scope.

**Tech Stack:** Next.js App Router 16, React, TypeScript, existing CSS utility classes, Node test runner, and Playwright.

**Spec:** design.md sections 0.2.3–0.2.4, 0A.2–0A.9, 0.10, 4.7, 5A.10/12/13/18/22/23/26/28/30/31/42/43, plus the user's acceptance criteria.

## Global Constraints

- Treat the business dossier workspace as the product; do not center it on file browsing.
- Preserve PCN CertificationProposal and QC4/QC9 boundaries, PGD QC20 routing, domain RBAC, audit provenance, and immutable workflow snapshots.
- Do not make KPI status a prerequisite for ordinary dossier work.
- Do not edit .env.example, secrets, or sensitive runtime configuration.
- Do not run Archify, change Archify files, or include Archify tests in verification.
- Do not migrate or write production data and do not deploy production.
- Preserve unrelated dirty files in the root checkout and other agent worktrees.

---

### Task 1: Integrate the approved dossier-workspace commits

**Files:** Changes are limited to the files in the selected commits from the dossier workspace, document-stage builder, pending-confirmation slice, and the user-named PCN/PGD polish commit. Do not select Archify or unrelated root-work changes.

- [ ] Create the isolated task worktree from local master and keep the release worktree untouched.
- [ ] Integrate 5f9307e, 765df81, 869cedb, fc91633, 6caa1f8, 9d49bf8, and ef006df in dependency order.
- [ ] Review the staged diff and commit ancestry; confirm no Archify path or sensitive config changed.
- [ ] Run typecheck and focused template/dossier tests to identify integration regressions.

### Task 2: Complete the daily dossier queue and workspace

**Files:** components/PcnDossierQueueView.tsx, components/PgdDossierQueueView.tsx, components/PcnDossierDetailView.tsx, components/PcnDossierNodeWorkPanel.tsx, components/PcnDossierWorkflowPanel.tsx, components/PgdWorkspace.tsx, components/PgdDossierStepWorkPanel.tsx, components/PgdcnDossierDocumentActionTable.tsx, and their existing projection helpers.

- [ ] Verify the queue exposes search, filters, sorting, dossier code, customer, owner, stage, progress, document state, and next action from real records.
- [ ] Verify each dossier opens with its current step, native horizontal workflow rail, stage checklist, owner, and contextual next action.
- [ ] Show required/optional, missing/uploaded/pending-confirmation/attached/waived states with actions allowed by existing permissions.
- [ ] Add or update focused tests before changing behavior; run the exact queue/detail tests after implementation.

### Task 3: Complete contextual document work and navigation

**Files:** components/PcnDraftingWorkspaceView.tsx, components/PgdDraftingWorkspaceView.tsx, document work panels, existing PCN/PGD document confirmation routes, draftingNavigation, and focused document tests.

- [ ] Verify dossier, requirement, node/station, and return context survive navigation in both directions.
- [ ] Verify preview and DOCX drafting use the selected dossier and the correct domain template.
- [ ] Keep generated/uploaded files pending until the authorized confirmation action; verify audit, provenance, version, and server-side role checks.
- [ ] Exercise missing, upload, pending, confirmed, waived, and read-only role states with focused tests and browser journeys.

### Task 4: Complete the seven-stage dossier-template manager

**Files:** components/PgdcnDossierTemplateManagementView.tsx, components/PgdcnDossierTemplateStageBuilder.tsx, components/PgdcnDossierTemplateEditor.tsx, components/PgdcnDossierTemplateInspector.tsx, utils/pgdcnDossierTemplate.ts, the existing PCN/PGD workflow-template routes, and template tests.

- [ ] Let an authorized manager create a template, add or reorder dossier stages, attach default/catalog or additional requirements, and set owner, applicability, source, and required/optional policy.
- [ ] Keep each requirement within its PCN or PGD catalog and preserve QC4/QC9 versus QC20 scope.
- [ ] Save drafts, publish validated revisions, and retire with a reason through existing domain APIs and audit boundaries.
- [ ] Verify new dossiers capture immutable topology and requirement-policy snapshots when the template changes later.
- [ ] Exercise keyboard operation, touch controls, and mobile layout; run focused template-model, API, editor, and snapshot tests.

### Task 5: Verify browser behavior and release readiness

**Files:** Only focused application tests or browser fixtures needed to verify the above work; screenshots stay in task-scoped QA output.

- [ ] Capture desktop and mobile screenshots of the actual PCN and PGD queue/detail and template-management journeys.
- [ ] Verify no body-level horizontal overflow, usable keyboard focus, and touch targets at narrow widths.
- [ ] Run application-focused tests, typecheck, runtime smoke, and production build. Exclude Archify suites.
- [ ] Review the final diff, run git diff --check, commit the implementation rounds, and integrate the verified task branch into local master.
- [ ] Report the exact production-container status; do not deploy.
