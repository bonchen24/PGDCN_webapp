# PCN management and drafting workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development for independent implementation tasks and superpowers:verification-before-completion before claiming completion.

**Goal:** Restore the PCN management projections requested by the department and add an independent form/template drafting workspace without reintroducing retired DDT/Haimy/historical logic.

**Architecture:** Keep the dossier card and existing PCN API as the source of truth. Add read-only projections for the operations register and PYC/sample tracking, a deterministic snapshot assistant, and a separate persisted draft workspace that references optional proposal/dossier context and generates checked-in PCN templates through private file assets.

**Tech Stack:** Next.js App Router, React, TypeScript, existing PCN store/API boundary, self-hosted Supabase/Postgres, private Storage, checked-in DOCX template pack, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-pcn-management-drafting-design.md`

## Global constraints

- Read and obey the active PCN sections of `design.md` before coding.
- Keep the existing working tree and do not create a branch or restore deleted legacy surfaces.
- Preserve the five-step sequential gate; projections never bypass it.
- Keep PYC terminology only for outbound requests to laboratories; customer intake remains `Đề nghị`.
- Keep the customer list and separate PCN user/department role model.
- Do not store Desktop paths or use the research folders at runtime.

## Tasks

### 1. Align the active product contract

- Update `design.md` sections 0.3, 0.4, 0.6 and the five-step section to make the four requested operational surfaces active.
- Define projection/read-only rules, draft persistence and independent generation boundaries.
- Add types for draft workspaces and compact management projections only where existing types are insufficient.

### 2. Build management projections

- Add/update the active `Sổ điều hành` view using the existing operations-register utility and five-step labels.
- Add `PYC & luân chuyển mẫu` view with summary cells for PYC, lot and lab-route state.
- Add navigation labels/icons and route-less workspace section handling.
- Keep mutations in dossier detail; open from projections into the correct dossier region.

### 3. Build drafting workspace

- Add draft form metadata and validation utilities with tests.
- Add server persistence endpoints for draft create/update/read and independent generation.
- Resolve proposal/dossier source context server-side and render DOCX/PDF with the checked-in PCN templates.
- Add a compact UI for source lookup, form entry, save/reopen and output generation.

### 4. Build the progress assistant

- Add a pure utility that produces explainable recommendations from the current snapshot.
- Add a compact assistant view with query/filter, severity, dossier link and next action.
- Keep it read-only and exclude external services, credentials and legacy agent endpoints.

### 5. Verify and review

- Add/update unit and source-contract tests for navigation, projections, drafts, generation and retired-surface exclusions.
- Run `npm run lint`, `npm test`, `npm run build` and `git diff --check`.
- Review the diff for accidental legacy imports or Desktop/runtime references.
