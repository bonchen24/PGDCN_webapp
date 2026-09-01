# PCN Operational Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured, persisted input forms for PCN station documents inside the dossier card, so users can complete operational records before generating DOCX/PDF.

**Architecture:** Store the form snapshots on `CertificationDossier.operationalForms`, update them through the existing dossier mutation boundary, and project them into the canonical document context. Render one station form modal/panel from the existing dossier document workspace; do not add top-level routes or legacy modules.

**Tech Stack:** Next.js App Router, React, TypeScript, Zustand, Express API, PostgreSQL JSONB, existing PCN DOCX/PDF generation.

**Spec:** `design.md`, sections 0.1–0.4, 4.6, 6–9.

## Global Constraints

- PCN input starts with `Đề nghị`; PYC exists only for outbound laboratory requests.
- KQTN is received as a scan from the laboratory; OCR is a confirmable draft and PCN never generates KQTN.
- Keep the five dossier work regions and existing compact card/modal UI; do not create separate pages.
- Persist operational data in the PCN database and keep file bytes in the private PCN Storage bucket.
- Every mutation uses the existing PCN API/session/RBAC/audit boundaries.
- DOCX source templates remain checked-in PCN assets; Desktop/source folders are never runtime dependencies.

---

### Task 1: Define and validate operational form snapshots

**Files:**
- Create: `utils/pcnOperationalForms.ts`
- Modify: `types.ts`
- Modify: `design.md`
- Test: `test/pcn-operational-forms.test.ts`

**Interfaces:**
- `PcnOperationalForms` contains optional snapshots for assignment, evaluation plan, field inspection, sample taking/coding, evaluation report, and contract.
- `validatePcnOperationalForm(kind, value)` returns structured field errors without mutating input.
- `mergePcnOperationalForm(current, kind, value)` returns a normalized immutable snapshot.

- [x] Write failing tests for normalization, required fields, QC20-safe sample data, and unknown form kinds.
- [x] Run `npm test -- test/pcn-operational-forms.test.ts` and confirm it fails because the module/types do not exist.
- [x] Add the type definitions and minimal validation/normalization functions.
- [x] Run the focused test until it passes.
- [x] Update `design.md` with the operational form ownership and persistence contract.

### Task 2: Persist form snapshots through the PCN dossier boundary

**Files:**
- Modify: `utils/pcnDossierApi.ts`
- Modify: `store-pcn.ts`
- Modify: `server.ts`
- Modify: `sql/pcn-schema.sql`
- Test: `test/pcn-operational-form-api.test.ts`

**Interfaces:**
- `PcnDossierUpdateInput.operationalForms` accepts one normalized patch or the full normalized snapshot according to the existing JSON document contract.
- `PUT /api/pcn/dossiers/:id` validates the patch, persists it in `certificationDossiers.data`, and records changed form keys in audit.

- [x] Write failing API/store contract tests for accepted form patches, invalid required fields, and viewer rejection.
- [x] Run the focused test and confirm the new contract fails.
- [x] Extend the existing dossier update allow-list and server validation without weakening status-transition guards.
- [x] Extend the client store update payload and database schema documentation/bootstrap where needed.
- [x] Run focused API/store tests and the existing dossier tests.

### Task 3: Project structured data into document generation

**Files:**
- Modify: `utils/pcnDocumentGeneration.ts`
- Modify: `utils/pcnOperationalTemplateGeneration.ts`
- Modify: `components/PcnDocumentGenerationPanel.tsx`
- Test: `test/pcn-operational-form-generation.test.ts`

- [x] Write failing tests proving the assignment/plan/inspection/sampling/coding/evaluation fields appear in the context and placeholder values.
- [x] Run the focused test and confirm it fails.
- [x] Add the operational-form projection and generation mappings.
- [x] Keep KQTN scan/reference-only and reject any attempt to generate a KQTN document.
- [x] Run focused generation tests and the existing template-pack tests.

### Task 4: Add the in-card station form UI

**Files:**
- Create: `components/PcnOperationalFormModal.tsx`
- Modify: `components/PcnDossierDetailView.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Test: `test/pcn-operational-form-ui.test.ts`

- [x] Write failing source-contract tests for opening each form from the dossier card, field labels, save/cancel behavior, and no new top-level navigation item.
- [x] Run the focused test and confirm it fails.
- [x] Implement one reusable modal with station-specific sections and accessible labels.
- [x] Wire save through `onUpdateDossier`, show validation errors, and expose generation only after save.
- [x] Run focused UI tests and full lint/test/build.

### Task 5: Final verification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-31-pcn-operational-forms.md`

- [x] Run `npm run lint`.
- [x] Run `npm test`.
- [x] Run `npm run build` sequentially after lint/tests.
- [x] Run `git diff --check` and inspect the changed-file list.
- [x] Mark completed tasks in this plan only when command evidence is available.
