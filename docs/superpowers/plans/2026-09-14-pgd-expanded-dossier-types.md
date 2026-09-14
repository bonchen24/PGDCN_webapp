# PGD Expanded Dossier Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every active PGD dossier profile discoverable and filterable as a clear “Loại hồ sơ” across intake, queue, selector, and summary register while preserving the existing five-step workflow.

**Architecture:** Reuse the existing PGD catalog as the source of truth. Add one shared display helper for catalog code/name labels, pass the catalog into PGD projections, and filter by `catalogItemId`; do not create new collections, routes, or workflow branches.

**Tech Stack:** TypeScript, React/Next.js, Zustand, Node test runner, Tailwind utility classes.

**Spec:** `design.md` section 0A.4, expanded dossier type bullet.

## Global Constraints

- `design.md` remains the single source of truth for PGD catalog and UI behavior.
- QC20 remains a PGD group and uses `GĐ-THEP-KG`; it must not re-enter PCN fields or routes.
- Runtime must not read/import Desktop or UNC source folders.
- Vietnamese labels, compact one-row filters, accessible labels, and icon/vector UI remain mandatory.
- Existing PGD request data and five workflow stations remain backward compatible.

### Task 1: Lock the catalog display contract with tests

**Files:**
- Modify: `test/pgd-rebuild-profile.test.ts`
- Create: `test/pgd-expanded-dossier-types.test.ts`

- [x] **Step 1: Write failing tests** for a shared catalog display label and the six source-aligned profile codes.
- [x] **Step 2: Run the focused tests and verify they fail because the display helper and UI contract are missing.
- [x] **Step 3: Keep the test assertions limited to code/name resolution and visible profile identifiers.

### Task 2: Add the shared catalog label helper

**Files:**
- Modify: `utils/pgdDomain.ts`
- Test: `test/pgd-expanded-dossier-types.test.ts`

- [x] **Step 1: Add `getPgdCatalogItemLabel(catalogItemId, catalog)` returning `Mã · Tên loại hồ sơ`, with a safe fallback to the raw id.
- [x] **Step 2: Re-run the focused domain tests and verify they pass.
- [x] **Step 3: Preserve legacy catalog rows by resolving against `mergePgdCatalogDefaults` before displaying labels.

### Task 3: Expose the type in all PGD projections

**Files:**
- Modify: `components/PgdDossierQueueView.tsx`
- Modify: `components/PgdDossierSelector.tsx`
- Modify: `components/PgdSummaryRegisterView.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Test: `test/pgd-expanded-dossier-types.test.ts`

- [x] **Step 1: Add catalog props and a `catalogItemId` filter to selector/register/queue projections.
- [x] **Step 2: Render the resolved Vietnamese type label beside the request code/product, keeping controls compact and one-row on desktop/mobile.
- [x] **Step 3: Pass the active PGD catalog from `PgdWorkspace` to every projection and filter the request register by exact `catalogItemId`.
- [x] **Step 4: Keep unknown/legacy catalog ids visible using the raw id fallback rather than hiding their dossiers.
- [x] **Step 5: Run focused UI contract tests and verify they pass.

### Task 4: Verify the expanded flow

**Files:**
- Test: `test/pgd-expanded-dossier-types.test.ts`
- Verify: `design.md`, `utils/pgdDomain.ts`, PGD UI projections.

- [x] **Step 1: Run `npm test`.
- [x] **Step 2: Run `npm run typecheck`.
- [x] **Step 3: Run `npm run build`.
- [x] **Step 4: Run `git diff --check` and confirm no Desktop/UNC runtime import was introduced.
- [x] **Step 5: Review the PGD routes in the production build output and report the changed files.
