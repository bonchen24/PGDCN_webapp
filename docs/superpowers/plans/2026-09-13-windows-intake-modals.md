# Windows Intake Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Make PCN proposal intake and PGD PYC intake compact, accessible Windows-style modals with required-field markers, drag/drop OCR input, and an in-modal PGD sample summary/editor.

**Architecture:** Add one local `PgdcnWindowsWorkflowModal` presentation primitive for title bar, minimize/restore, focus, scroll, and footer behavior. Keep existing PCN/PGD form state and business mutations in their workspaces, but extend the PGD intake boundary to accept validated sample drafts and persist them with the newly created request. Use an editable catalog combobox for PGD sample names with a catalog snapshot plus custom label.

**Tech Stack:** Next.js/React, TypeScript, Tailwind utility classes, lucide-react, Node `node:test` source-contract tests, existing PGD/PCN API and domain policies.

**Spec:** `design.md` sections 4, 0A.8, 0A.9, 10, 11 and the dated intake-modal requirements added for this request.

## Global Constraints

- `design.md` is the single source of truth and is updated before code changes.
- Modal panels keep `header/footer shrink-0`, body `min-h-0 mobile-scroll-y`, and no page-level horizontal overflow.
- Required fields are marked with a red `*`, use native/semantic required state, and report errors at the field.
- OCR/file input only hydrates an uncommitted draft; the user confirms recognized values before saving.
- PGD remains isolated from PCN collections, routes, templates, and APIs.
- Existing unrelated working-tree changes are preserved.

---

### Task 1: Update the authoritative UI/data specification

**Files:**
- Modify: `design.md` sections 4.1 and 0A.8/0A.9

**Interfaces:**
- Produces the modal contract, required-field matrix, OCR draft contract, PGD sample draft fields, and editable sample-name catalog rule used by later tasks.

- [ ] **Step 1: Add the compact Windows-modal anatomy.**

Document the title bar, minimize/restore launcher, focus behavior, independent body scroll, sticky footer, mobile behavior, and minimum touch/focus requirements for both PCN and PGD intake.

- [ ] **Step 2: Add the required-field matrix.**

Document PCN base fields, PGD base fields, conditional steel/machinery/coal fields, red-star behavior, and the contact-or-tax-id alternative.

- [ ] **Step 3: Add the PGD sample table and editable catalog rule.**

Document row fields, duplicate/quantity rules, catalog code + label snapshot, custom sample labels, and request/sample linkage.

- [ ] **Step 4: Add the dropzone/OCR behavior.**

Document supported file types, paste/camera behavior, draft-only hydration, user confirmation, and failure states.

- [ ] **Step 5: Review the edited sections.**

Run: `git diff --check`

Expected: no whitespace errors.

---

### Task 2: Add the shared Windows workflow modal primitive

**Files:**
- Create: `components/PgdcnWindowsWorkflowModal.tsx`
- Test: `test/pgdcn-windows-workflow-modal.test.ts`

**Interfaces:**
- Produces `PgdcnWindowsWorkflowModal` props: `open`, `title`, `eyebrow`, `description`, `accent`, `testId`, `titleId`, `onClose`, `onMinimize`, `onRestore`, `minimized`, `busy`, `children`, `footer`.

- [ ] **Step 1: Write source-contract tests.**

Assert the primitive exposes `role="dialog"`, `aria-modal`, title labelling, red/blue accent variants, `header shrink-0`, `body mobile-scroll-y min-h-0`, fixed footer slot, minimize/restore labels, Escape/focus handling markers, and a launcher test id.

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `node --test test/pgdcn-windows-workflow-modal.test.ts`

Expected: FAIL because the component and its contract do not exist.

- [ ] **Step 3: Implement the minimal primitive.**

Use a fixed scrim, `min-h-0` panel, compact Windows-like title bar, independent body scroll, footer slot, `aria-busy` support, Escape close when not busy, initial focus, focus restoration, and a bottom-right minimized launcher that does not unmount children/state.

- [ ] **Step 4: Run the focused test.**

Run: `node --test test/pgdcn-windows-workflow-modal.test.ts`

Expected: PASS.

---

### Task 3: Normalize required-field markers and validation contracts

**Files:**
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PgdProductGroupFields.tsx`
- Modify: `utils/pcnIntakePolicy.ts`
- Modify: `utils/pgdDomain.ts`
- Test: `test/pcn-pgd-required-fields-ui.test.ts`

**Interfaces:**
- Produces reusable `Field` required rendering with a red star and conditional required labels; preserves existing domain validation as server-side authority.

- [ ] **Step 1: Write failing required-field contract tests.**

Assert PCN policy fields, PGD base fields, conditional product-group fields, red-star rendering, `aria-required`/native `required`, and the contact-or-tax-id alternative are represented in source.

- [ ] **Step 2: Run the focused test.**

Run: `node --test test/pcn-pgd-required-fields-ui.test.ts`

Expected: FAIL for the new shared marker/conditional rules.

- [ ] **Step 3: Implement required marker rendering.**

Change both local field wrappers to accept `required?: boolean`, render `<span aria-hidden="true" className="text-rose-600">*</span>`, and keep labels concise. Replace literal stars with semantic props. Mark `catalogItemId`/classification as required, preserve conditional steel/machinery/coal rules, and represent the PCN contact-or-tax-id group as one alternative requirement.

- [ ] **Step 4: Align validation where the UI now blocks.**

Add only the missing client/server policy checks needed by the agreed matrix; do not require optional contact/email/unit/schedule/note fields. Keep custom sample validation separate from request intake validation.

- [ ] **Step 5: Run the focused test.**

Run: `node --test test/pcn-pgd-required-fields-ui.test.ts test/pcn-intake-validation.test.ts test/pcn-pgd-domain.test.ts`

Expected: PASS.

---

### Task 4: Add PGD sample draft model and persistence boundary

**Files:**
- Modify: `utils/pgdDomain.ts`
- Modify: `utils/pgdDossier.ts`
- Modify: `utils/pgdApi.ts`
- Modify: `store-pgd.ts`
- Modify: `server.ts`
- Modify: `types.ts` or PGD schema location if the runtime contract requires a shared type
- Test: `test/pgd-intake-sample-boundary.test.ts`
- Test: `test/pgd-sample-catalog.test.ts`

**Interfaces:**
- Produces `PgdIntakeSampleDraft`, `PgdSampleDraftInput`, `PGD_SAMPLE_TYPE_OPTIONS`, `validatePgdIntakeSampleDraft`, and a transaction-safe create path that returns request + created sample ids.

- [ ] **Step 1: Write failing domain/API tests.**

Cover required sample fields, positive quantity, valid `LAB`/`RETAINED`, required seal number, duplicate sample-code rejection within a request, catalog selection snapshot, custom label preservation, and atomic request/sample linkage.

- [ ] **Step 2: Run the focused tests.**

Run: `node --test test/pgd-intake-sample-boundary.test.ts test/pgd-sample-catalog.test.ts`

Expected: FAIL because the draft contract and create boundary do not exist.

- [ ] **Step 3: Add the draft/catalog contracts.**

Define sample draft fields for code, catalog option id, label snapshot, custom flag, description, quantity, unit, disposition, seal number, sample size, lot quantity/unit, sampled date/location, sampler, laboratory, and note. Seed concise options by PGD group and expose a normalized option lookup; custom labels remain valid.

- [ ] **Step 4: Add validation and request linkage.**

Validate drafts before mutation, normalize codes/labels, reject duplicate codes, and persist the created request plus samples/backlink in one transaction or equivalent idempotent boundary. Keep later split/destroy lifecycle intact.

- [ ] **Step 5: Run the focused tests.**

Run: `node --test test/pgd-intake-sample-boundary.test.ts test/pgd-sample-catalog.test.ts test/pcn-pgd-domain.test.ts`

Expected: PASS.

---

### Task 5: Build the compact editable PGD sample table/form

**Files:**
- Create: `components/PgdIntakeSampleTable.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Test: `test/pgd-intake-sample-ui.test.ts`

**Interfaces:**
- Consumes the sample catalog and draft contract from Task 4.
- Produces `value`, `onChange`, and `disabled` props for a controlled table/editor with `onAdd`, `onUpdate`, `onRemove` behavior.

- [ ] **Step 1: Write failing UI contract tests.**

Assert summary counters, table headers, add/edit/remove actions, editable catalog combobox/custom option, red required markers, row-level errors, mobile overflow containment, and no nested modal.

- [ ] **Step 2: Run the focused test.**

Run: `node --test test/pgd-intake-sample-ui.test.ts`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the compact table/editor.**

Use a collapsible inline editor rather than a nested dialog. Show desktop table and mobile-contained horizontal scroll, summary chips for row/quantity/LAB/retained totals, an editable sample-name combobox with catalog option metadata, a custom-name path, and row-specific validation.

- [ ] **Step 4: Run the focused test.**

Run: `node --test test/pgd-intake-sample-ui.test.ts`

Expected: PASS.

---

### Task 6: Add the shared dropzone/OCR intake surface

**Files:**
- Create: `components/PgdcnIntakeDropzone.tsx`
- Create: `components/PgdOcrPanel.tsx` if the existing PCN OCR response cannot safely map PGD fields
- Modify: `utils/pcnOcrApi.ts` only if the existing shared contract needs a non-breaking context extension
- Modify: `PcnWorkspace.tsx` and `PgdWorkspace.tsx` integration points
- Test: `test/pgdcn-intake-dropzone.test.ts`

**Interfaces:**
- Produces a keyboard-accessible file dropzone with `onDraftExtracted`, `onFileSelected`, `accept`, `disabled`, and status/error slots.

- [ ] **Step 1: Write failing dropzone tests.**

Assert PDF/DOCX/image accept values, drag/drop, click selection, paste/camera affordances, keyboard activation, draft-only confirmation copy, status/live-region markers, and PCN/PGD field mappings.

- [ ] **Step 2: Run the focused test.**

Run: `node --test test/pgdcn-intake-dropzone.test.ts`

Expected: FAIL for the shared dropzone contract.

- [ ] **Step 3: Implement the dropzone.**

Reuse `PcnOcrPanel` behavior for PCN where possible; add a domain-safe PGD mapping surface, keep the original file transient until the user confirms fields, clear the file input after selection, and expose errors without closing the modal.

- [ ] **Step 4: Run the focused test.**

Run: `node --test test/pgdcn-intake-dropzone.test.ts test/pgd-pcn-form-modal-ui.test.ts`

Expected: PASS.

---

### Task 7: Integrate both Windows modals and PGD intake persistence

**Files:**
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `test/pgd-pcn-form-modal-ui.test.ts`
- Add/update: `test/pgdcn-windows-intake-integration.test.ts`

**Interfaces:**
- Consumes the modal, required-field, sample table, and dropzone components/contracts from Tasks 2–6.

- [ ] **Step 1: Write failing integration tests.**

Assert PCN and PGD use the shared modal, both have Windows title-bar controls, minimize preserves form state, close/escape/focus behavior, fixed footer, dropzone, required marker, and PGD sample table.

- [ ] **Step 2: Run the focused tests.**

Run: `node --test test/pgd-pcn-form-modal-ui.test.ts test/pgdcn-windows-intake-integration.test.ts`

Expected: FAIL until both workspaces consume the shared primitive and PGD payload carries sample drafts.

- [ ] **Step 3: Replace the existing wrappers.**

Wrap the existing PCN proposal form and PGD intake form in `PgdcnWindowsWorkflowModal`; preserve existing state/reset/submit logic; add minimized launchers, domain accents, compact title bars, and fixed action footers. Keep the form mounted while minimized.

- [ ] **Step 4: Connect PGD sample drafts to create.**

Pass controlled sample drafts through the intake submit payload, use the new server boundary, and close/open the created request only after request and samples are committed. Keep validation errors and the modal open on failure.

- [ ] **Step 5: Run the focused tests.**

Run: `node --test test/pgd-pcn-form-modal-ui.test.ts test/pgdcn-windows-intake-integration.test.ts test/pgd-intake-sample-ui.test.ts test/pgdcn-intake-dropzone.test.ts`

Expected: PASS.

---

### Task 8: Full verification and browser smoke check

**Files:**
- Modify only files required by failing verification output.

- [ ] **Step 1: Run focused regression tests.**

Run: `node --test test/pgdcn-windows-workflow-modal.test.ts test/pcn-pgd-required-fields-ui.test.ts test/pgd-intake-sample-boundary.test.ts test/pgd-sample-catalog.test.ts test/pgd-intake-sample-ui.test.ts test/pgdcn-intake-dropzone.test.ts test/pgd-pcn-form-modal-ui.test.ts test/pgdcn-windows-intake-integration.test.ts`

Expected: all focused tests pass.

- [ ] **Step 2: Run the full suite.**

Run: `npm test`

Expected: exit code 0 with no failed tests.

- [ ] **Step 3: Run typecheck and build.**

Run: `npm run typecheck`

Expected: exit code 0.

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Run whitespace verification.**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Inspect the live browser surface.**

Open the local PGD page, open **Tạo PYC**, verify compact title bar, minimize/restore, dropzone, required red stars, sample table, editable sample-name option, mobile-safe scrolling, and create/error behavior. Open PCN **Tạo Đề nghị** and verify the same shared modal anatomy plus OCR draft confirmation.

- [ ] **Step 6: Report only evidence-backed results.**

Summarize changed files, focused/full test counts, typecheck/build status, and any pre-existing unrelated failures without claiming completion until the commands above have been read.
