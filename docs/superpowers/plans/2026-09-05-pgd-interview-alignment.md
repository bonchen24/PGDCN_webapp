# PGD interview alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align PGD intake, catalog, workflow, approval, result, retention, and document surfaces with the 20/08/2026 interview while preserving existing PGD records and the read-only Desktop source boundary.

**Architecture:** Keep the existing PGD domain and five-station PCN-style workspace. Extend the domain with stable application profile identifiers, intake snapshots, SLA/priority and retention metadata; keep legacy catalog IDs/statuses readable. Treat the existing `TECHNICAL_REVIEW` and `LEADERSHIP_APPROVAL` statuses as the two approval steps, with server-side sequencing and no browser-trusted completion flags.

**Tech Stack:** TypeScript, React, Next/Express server routes, Zustand PGD store, Node `node:test`, existing PostgreSQL `app_documents` boundary.

**Spec:** `design.md` sections 0A.1–0A.9, updated from `C:/Users/HungX/Desktop/Bản câu hỏi/CauHoi_PhongVan_PGD.docx`.

## Global Constraints

- Do not read, watch, import, delete, or mutate the Desktop/UNC PGD source folder at runtime.
- Preserve existing PGD identifiers and statuses; new profile IDs are application routing IDs, not official PGD product codes.
- Enforce all validation, approval ordering, permissions, and evidence gates on the server as well as in the UI.
- Keep template placeholder/cell management out of the user-facing DOCX settings surface; templates remain the source of placeholder definitions.
- Use soft or immutable business history for samples, results, approvals, retention, and audit; never physically delete those records as part of this alignment.

---

### Task 1: Add interview-aligned domain contracts and catalog profiles

**Files:**
- Modify: `utils/pgdDomain.ts`
- Test: `test/pgd-interview-alignment.test.ts`
- Modify: `test/pcn-pgd-domain.test.ts`

**Interfaces:**
- Produce `PgdInspectionProfileCode`, `PgdPriority`, `PgdInvoiceStatus`, `PgdRetentionPolicy`, `PGD_APPROVAL_CHAIN`, `PGD_RETENTION_POLICY`, and catalog `profileCode`/`slaDays` fields.
- Preserve `DEFAULT_PGD_CATALOG` legacy IDs while adding profiles for quantity/weight, condition/origin, steel TT58, steel Cao Bang, machinery/line, machinery manufacturing/Thai Nguyen, outside column braces, coal, and general goods.

- [ ] **Step 1: Write the failing tests**

Add tests that assert the active catalog exposes every interview profile, each active item has a non-empty SLA/profile, the standard options include QCVN/JIS/ASTM/GB/T where applicable, retention defaults are 3 months/1 year/10 years, and the two approval roles are ordered technical then leadership.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-interview-alignment.test.ts`

Expected: FAIL because the new profile fields/catalog entries/retention and approval constants do not exist.

- [ ] **Step 3: Implement the minimal domain contracts**

Extend `PgdCatalogItem`, add the interview profile union and catalog entries, add `priority`, `urgentReason`, `pricingSnapshot`, `invoiceStatus`, and `receivedByUsername` to the request input, set retention metadata when splitting a retained sample, and expose the two-step approval chain.

- [ ] **Step 4: Run focused domain tests**

Run the same command and then `npm test -- --test-name-pattern "PGD"`.

Expected: the new tests and existing PGD domain tests pass; update only stale assertions that assumed the catalog had exactly six items.

- [ ] **Step 5: Refactor without changing behavior**

Use shared constants for profile labels and SLA/retention values so UI and server validation do not duplicate interview rules.

### Task 2: Strengthen intake validation and source/requester separation

**Files:**
- Modify: `utils/pgdDomain.ts`
- Modify: `components/PgdWorkspace.tsx`
- Test: `test/pgd-interview-alignment.test.ts`

**Interfaces:**
- `validatePgdIntake(input)` rejects missing requester address, contact person, or phone, while `receivedByUsername` identifies the authenticated receiver separately.
- Intake UI renders requester fields, priority/reason, profile-driven standards, and a clear document checklist without replacing requester data with the current user.

- [ ] **Step 1: Add failing validation/UI contract tests**

Assert a valid request with requester name/address/contact/phone passes, each missing requester field is reported by its own field key, and the workspace source no longer constructs `requester` from `currentUser.name`.

- [ ] **Step 2: Run the tests and verify the expected failures**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-interview-alignment.test.ts test/pgd-register-ui.test.ts`

- [ ] **Step 3: Implement validation and UI wiring**

Add the fields to `IntakeForm`, initialize them empty, bind them in the intake grid, pass the requester snapshot and authenticated receiver separately, and render catalog/profile-specific options from the active catalog.

- [ ] **Step 4: Run the focused tests and typecheck**

Run: `npm test -- --test-name-pattern "PGD|PGD register"` and `npm run lint`.

### Task 3: Implement two-step approval, rework/retest, and retention behavior

**Files:**
- Modify: `utils/pgdDomain.ts`
- Modify: `utils/pgdWorkflow.ts`
- Modify: `server.ts`
- Modify: `components/PgdStationFormsPanel.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Test: `test/pgd-interview-alignment.test.ts`
- Modify: `test/pgd-workflow.test.ts`

**Interfaces:**
- `getPgdApprovalRoleForStatus('TECHNICAL_REVIEW')` returns the technical step and `getPgdApprovalRoleForStatus('LEADERSHIP_APPROVAL')` returns the leadership step.
- The server accepts both roles, normalizes sequence 1/2, requires the technical approval before leadership approval, and only signs the certificate after leadership approval.
- Result review exposes a recheck/retest branch with a reason and audit event; retained samples receive a three-month due date and remain in the sample ledger after destruction.

- [ ] **Step 1: Write failing workflow/server contract tests**

Assert the technical role is no longer rejected, leadership cannot approve without an approved technical step, and a result issue requires a recheck reason before the dossier can return to report preparation.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-interview-alignment.test.ts test/pgd-workflow.test.ts`

- [ ] **Step 3: Implement the server-side approval and result gates**

Update `getPgdApprovalDenial`, `getPgdApprovalRoleForStatus`, the `/api/pgd/approvals` transaction, and the report/result UI. Store both approval records, enforce manifest completeness for both, and create a rework activity entry instead of silently accepting failed/mismatched results.

- [ ] **Step 4: Run focused workflow tests and typecheck**

Run the focused test command and `npm run lint`.

### Task 4: Align result/document surfaces with BM-GĐ-07.19 and flexible profiles

**Files:**
- Modify: `utils/pgdDocumentTemplates.ts`
- Modify: `components/PgdDocumentGenerationPanel.tsx`
- Modify: `components/PgdProductGroupFields.tsx`
- Modify: `components/PgdStationFormsPanel.tsx`
- Test: `test/pgd-interview-alignment.test.ts`
- Modify: `test/pgd-document-templates.test.ts`

**Interfaces:**
- Add the published result template metadata for `BM-GĐ-07.19`, with `DRAFT`/`FINAL` output labeling and required identity/customer/product/inspection/result/conclusion fields.
- The document page lists every active PGD document kind/profile and does not expose placeholder/cell management controls.

- [ ] **Step 1: Add failing template/UI tests**

Assert `BM-GĐ-07.19` is discoverable, draft output is labeled separately from final output, and profile-specific fields do not leak into unrelated product groups.

- [ ] **Step 2: Run the tests to confirm failure**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-interview-alignment.test.ts test/pgd-document-templates.test.ts`

- [ ] **Step 3: Implement the result template and UI projection**

Register the template kind/code, route it through the existing snapshot/generation pipeline, add flexible result sections for the interview profiles, and keep document generation backed by the selected template’s placeholder contract.

- [ ] **Step 4: Run focused template tests and typecheck**

Run the focused test command and `npm run lint`.

### Task 5: Verify the integrated PGD flow

**Files:**
- Modify: `test/pgd-interview-alignment.test.ts` only if a verified regression requires a test correction.

- [ ] **Step 1: Run the full PGD test set**

Run: `npm test`.

- [ ] **Step 2: Run static checks**

Run: `git diff --check` and `npm run lint`.

- [ ] **Step 3: Build the application**

Run: `npm run build`.

- [ ] **Step 4: Confirm source-folder safety**

Run a repository search for Desktop/UNC source access in the changed PGD files and confirm no command or runtime path mutates `C:/Users/HungX/Desktop/Bản câu hỏi` or the PGD source folder.
