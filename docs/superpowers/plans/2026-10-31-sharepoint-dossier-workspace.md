# PGDCN SharePoint-like Dossier Workspace Implementation Plan

> **For agentic workers:** Execute this plan in order and review the diff after each wave. Every new behavior starts with a failing focused test.

**Goal:** Deliver a shared PGDCN dossier workspace that configures dossier checklists separately from DOCX templates, creates PCN/PGD dossiers from published snapshots, and keeps list, document, workflow, review, and audit actions attached to canonical records.

**Architecture:** Extend the existing PCN and PGD workflow-template contracts and canonical record boundaries. Build shared list and workspace surfaces as projections over existing `CertificationDossier` and `PgdInspectionRequest` records; preserve the separate PCN/PGD stores, APIs, private file assets, workflow snapshots, and approval boundaries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL JSONB collections, private Supabase Storage, Node test runner through `npm run test:pcn`.

**Spec:** User-approved Task Context Package; code-level contract in `design.md` §0.2, §0.8, §0.10, §0A.3, and §0A.9.

## Global Constraints

- PCN begins with `CertificationProposal`; create exactly one dossier and checklist in the existing server transaction.
- PGD begins with `PgdInspectionRequest`; keep the PCN and PGD collection, session, RBAC, workflow, and lifecycle boundaries independent.
- Published templates are immutable; revisions affect new dossiers only, and each dossier retains its own template/checklist snapshot.
- Apply conditional requirements only through server allowlists; never evaluate arbitrary user expressions.
- Keep file asset metadata and pointers in PostgreSQL and file bytes in private Storage; preserve checksum, size/type validation, ownership, history, and audit.
- A checklist row is not evidence that a file exists; upload, draft, current file, review, waiver, signature, and lifecycle states remain distinct.
- Keep existing business gates and approval topology; missing checklist evidence must not block draft save, intake, or upload.
- Keep Vietnamese UI, keyboard access, readable mobile layouts, canonical dossier links, and role-scoped server enforcement.
- Do not deploy production containers, run production migrations, or stage unrelated workspace changes.

## Progress snapshot — 2026-10-31

Implemented in this pass: allowlisted requirement policies and immutable checklist snapshots for new PCN/PGD dossiers; visual configuration and preview of requirement class, conditions, source, and cardinality; a shared PCN/PGD dossier list with saved per-user filters and canonical open callbacks; and separate management tabs reusing the existing DOCX library.

Still required for the full approved goal: the three-step create-dossier assistant, unified dossier detail tabs, explicit DOCX-to-requirement administration/mapping, requirement upload/review reconciliation changes, and authenticated UI/API checks. The current local browser check reached the login page but had no session (`/api/auth/pcn-session` returned 401), so those authenticated flows were not exercised.

---

### Wave A: Inventory, acceptance map, and baseline

**Files:**
- Inspect: `components/PgdcnSidebar.tsx`, `components/PgdcnAppShell.tsx`, `components/PgdcnDossierTemplateManagementView.tsx`, `components/PgdcnUnifiedDraftingView.tsx`
- Inspect: `utils/pgdcnDossierTemplate.ts`, `utils/pgdDossier.ts`, `utils/pcnWorkflowTemplate.ts`, `utils/pgdWorkflowTemplate.ts`
- Inspect: PCN/PGD intake, dossier document, workflow template, and DOCX template API routes under `app/api/pcn/` and `app/api/pgd/`
- Baseline tests: `npm run typecheck`, `npm run test:pcn`

- [x] Capture baseline test output and map existing components, API boundaries, and acceptance gaps before editing production code.
- [x] Preserve this inventory in the implementation review; do not duplicate existing catalogs or dossier entities.

### Wave B: Dossier-template requirement policy and DOCX library mapping

**Files:**
- Modify: `types.ts`, `utils/pgdcnDossierTemplate.ts`, `utils/pcnWorkflowTemplate.ts`, `utils/pgdWorkflowTemplate.ts`, `utils/pgdDossier.ts`
- Modify: `components/PgdcnDossierTemplateManagementView.tsx`, `components/PgdcnDossierTemplateInspector.tsx`, `components/PgdcnUnifiedDraftingView.tsx`
- Modify only the existing domain template API boundaries under `app/api/pcn/workflow-templates/`, `app/api/pgd/workflow-templates/`, `app/api/pcn/templates/`, and `app/api/pgd/document-templates/` when validation or persistence is missing.
- Tests: `test/pgdcn-dossier-template-editor-model.test.ts`, `test/pgdcn-dossier-template-management-ui.test.ts`, `test/pcn-workflow-template.test.ts`, `test/pgd-dossier-template-catalog.test.ts`, plus focused tests for new requirement policies.

- [x] Add policy fields for requirement default class, allowlisted `appliesWhen`, source mode, cardinality, and domain scope while retaining stable existing requirement IDs.
- [x] Add the two management tabs: dossier bundle configuration and official DOCX template library; published items stay immutable and revisions retain provenance.
- [x] Validate requirement references, conditional catalog keys, source modes, and cardinality on the server. DOCX-to-requirement mapping administration remains open.
- [x] Add failing tests first, observe the expected failure, implement the minimal change, then run the focused test set.

### Wave C: Three-step create-dossier assistant and snapshots

**Files:**
- Create: `components/PgdcnNewDossierWizard.tsx` and a small pure helper in `utils/pgdcnNewDossierWizard.ts` if the flow needs testable normalization.
- Modify: `components/PgdcnAppShell.tsx`, `components/PcnWorkspace.tsx`, and `components/PgdWorkspace.tsx` only to mount the wizard and refresh existing stores.
- Reuse: `app/api/pcn/intake/route.ts`, `app/api/pgd/requests/route.ts`, existing published workflow-template selectors, and their transaction boundaries.
- Tests: focused wizard tests, `test/pcn-dossier-api-contract.test.ts`, `test/pgd-workflow-template-api-contract.test.ts`, and route tests for snapshot/idempotency.

- [ ] Add step-one domain/template/scope selection, step-two customer and confirmed extracted context, and step-three owner/checklist preview.
- [ ] Submit through current PCN/PGD intake endpoints; include an idempotency key and published template identity, and let the server select and freeze the canonical snapshot.
- [ ] Permit saving without a complete checklist, approval, signature, or laboratory result.
- [ ] Prove retries do not create a second proposal/dossier or request; add tests before changing the endpoints.

### Wave D: Shared dossier list and canonical workspace

**Files:**
- Create: `components/PgdcnDossierLibraryView.tsx` as a read-only projection with saved user views.
- Modify: `components/PgdcnSidebar.tsx`, `components/PgdcnAppShell.tsx`, `components/PcnDossierDetailView.tsx`, `components/PcnDossierBusinessWorkspace.tsx`, and `components/PgdDossierBusinessWorkspace.tsx`.
- Reuse canonical routes: `/pgdcn/pcn/dossiers/[dossierId]` and `/pgdcn/pgd/dossiers/[requestId]`.
- Tests: new list/filter/canonical-navigation tests, `test/pcn-dossier-route.test.ts`, `test/pgdcn-aligned-dossier-ui.test.ts`, and existing mobile detail tests.

- [x] Add a shared dossier list with filters (PCN/PGD, mine, waiting review) and per-user saved views without creating a dossier entity.
- [ ] Add the dossier header and `Thông tin`, `Tài liệu`, `Công việc`, and `Lịch sử` sections while retaining native workflow/task projections and domain-specific mutations.
- [x] Keep the shared list as a desktop table and mobile sequential cards with long text wrapping.
- [ ] Add tests first for projection scope, filter persistence, canonical link identity, and tab behavior.

### Wave E: Requirement status, upload, review, and permissions

**Files:**
- Modify only existing requirement/document projection and API boundaries in `utils/pgdDossier.ts`, PCN dossier document helpers, `app/api/pcn/dossiers/[dossierId]/documents/`, `app/api/pcn/files/`, and `app/api/pgd/requests/[requestId]/dossier-documents/`.
- Modify: `components/PcnDossierNodeWorkPanel.tsx`, `components/PgdDossierStepWorkPanel.tsx`, and the shared library/workspace components from Wave D.
- Tests: `test/pcn-dossier-documents.test.ts`, `test/pgd-dossier-operations.test.ts`, existing file/template tests, and new permission/state projection tests.

- [ ] Project file/checklist/review/lifecycle states separately, including conditional-not-applicable, waiver with reason/audit, returned-for-correction, and locked signed/issued documents.
- [ ] Make requirement uploads idempotent and ownership/scope checked; preserve old versions and signed assets.
- [ ] Keep library uploads unclassified until an authorized user attaches them to a requirement or creates a free-additional requirement.
- [ ] Reuse generated DOCX attach paths so app-generated output is confirmed and linked without upload again.
- [ ] Verify save/upload remains available when unrelated KPI, notifications, or incomplete future checklist items fail.

### Wave F: Regression, design contract, and task commit

**Files:**
- Modify: only the relevant existing sections of `design.md` (§0.2, §0.8, §0.10, §0A.3, §0A.9); label superseded UI guidance and retain unchanged business contracts.
- Review: all task-owned source/test changes and `git status --short` in the isolated worktree.

- [x] Run `npm run typecheck`, `npm run test:pcn`, and all focused new/affected tests after the last source edit: typecheck passed; `test:pcn` passed 962/962 (6 skipped); focused suite passed 60/60.
- [x] Run UI/API smoke checks against a local PGDCN instance where available; record exact paths and actions exercised. Do not claim an unrun browser/API check. `/` rendered the login page with HTTP 200; `/api/auth/pcn-session` returned 401, so authenticated dossier screens and mutation APIs could not be exercised.
- [ ] Check mobile widths, keyboard/focus, Vietnamese validation, viewer read-only behavior, canonical links, and role-specific API rejection.
- [x] Scan task SQL/diffs for destructive statements; stage only task-owned files, commit with `feat: add shared PGDCN dossier workspace`, and report remaining gaps with evidence. No SQL files changed; detailed source/diff review remains part of the commit step.

#### Implementation review status

This task branch contains a tested incremental slice: the canonical dossier list, separate bundle/DOCX-library tabs, requirement policy snapshots and template editing for allowlisted applicability/source/cardinality, and PGD workflow selection/snapshot at request creation. The following requested outcomes remain unimplemented and this branch must not be described as a complete V2 delivery: the three-step create assistant, a shared detail workspace with four unified tabs, DOCX-to-requirement mapping administration, free-additional user-created rows, and the end-to-end library upload/classification/review/version reconciliation flow. The unauthenticated local smoke run also could not verify authenticated UI mutations or role-specific rejection.
