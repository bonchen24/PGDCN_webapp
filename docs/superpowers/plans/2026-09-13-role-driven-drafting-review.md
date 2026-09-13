# Role-driven source-to-dossier drafting and review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PGD and PCN dossiers start from a Phiếu yêu cầu/Đề nghị, draft the required documents inside the app for each step/node, and pass an explicit multi-role review gate before completion.

**Architecture:** Keep PGD and PCN stores, APIs, RBAC, provenance, and lifecycle boundaries separate. Reuse the existing three-column drafting workspaces and native dossier flows, adding context handoff from the active step/node and an explicit confirm-to-checklist action. Upload remains an external-evidence action; generated drafts are not complete until the current version is confirmed into the dossier checklist.

**Tech Stack:** Next.js, React, TypeScript, Zustand, Express/pg server routes, Tailwind utility classes, Node built-in tests.

**Spec:** `design.md` sections 0, 0A, 4.7, 6–7, 9 and 11.

## Global Constraints

- `design.md` remains the single source of truth and is updated before implementation.
- PGD starts from a new `PgdInspectionRequest`/PYC; PCN starts from a new `CertificationProposal`/Đề nghị.
- Drafting must preserve source context, version history, private storage provenance and current RBAC; it must not create a folder watcher or historical import flow.
- A generated file is not checklist-complete until the user explicitly confirms it into the dossier.
- Upload is for external evidence/reference only; it is not the primary document-authoring path.
- UI uses the existing PGD blue and PCN emerald accents, semantic controls, keyboard focus, 44px targets and mobile inner scrolling.

### Task 1: Update the source-first and role-review contract

**Files:**
- Modify: `design.md`
- Create: `docs/superpowers/plans/2026-09-13-role-driven-drafting-review.md`
- Test: `test/role-driven-drafting-review-ui.test.ts`

**Interfaces:**
- Produces the documented contract for source creation, per-step drafting, role handoff and review gates.

- [x] **Step 1: Add the design contract**

  Document the source chain `Phiếu yêu cầu/Đề nghị → hồ sơ → tài liệu theo Bước/Node → soát xét → phê duyệt`, the role matrix, and the rule that output must be explicitly confirmed into the checklist.

- [x] **Step 2: Add contract tests**

  Assert the design and UI sources contain the source-first language, drafting CTA, confirm-to-checklist language, role-aware review and upload-as-external-evidence distinction.

- [x] **Step 3: Run the focused test**

  Run: `node --test test/role-driven-drafting-review-ui.test.ts`

### Task 2: PGD step-to-drafting handoff and confirmation

**Files:**
- Modify: `components/PgdDossierStepWorkPanel.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PgdDraftingWorkspaceView.tsx`
- Modify: `components/PgdDocumentGenerationPanel.tsx`
- Test: `test/pgd-step-drafting-review-ui.test.ts`

**Interfaces:**
- `PgdDossierStepWorkPanel` receives `onOpenDrafting` and renders the active step's drafting CTA.
- `PgdWorkspace` keeps the selected request/template context and opens the drafting workspace with that context.
- `PgdDocumentGenerationPanel` exposes an explicit confirm callback for a generated document.

- [x] **Step 1: Add a failing UI contract test**

  Assert every PGD step panel exposes `Soạn thảo tài liệu`, the workspace accepts a request context, and the generation panel exposes `Xác nhận vào bộ hồ sơ`.

- [x] **Step 2: Implement the PGD handoff**

  Map each PGD step to its existing template kind, pass `requestId` and `requirementCode`, preselect them in the drafting workspace, and return the operator to the source dossier after explicit confirmation.

- [x] **Step 3: Implement explicit confirmation**

  Keep generated output in the existing PGD generated-document collection, then call `attachGeneratedDocument` with the deterministic requirement mapping. Show `Đã xác nhận vào bộ hồ sơ` only after the attach API succeeds.

- [x] **Step 4: Run focused tests and typecheck**

  Run: `node --test test/pgd-step-drafting-review-ui.test.ts`
  Run: `npm run typecheck`

### Task 3: PCN draft-output confirmation and node review state

**Files:**
- Modify: `components/PcnDraftingWorkspaceView.tsx`
- Modify: `utils/pcnDraftApi.ts`
- Modify: `server.ts`
- Modify: `components/PcnDossierNodeWorkPanel.tsx`
- Modify: `utils/pcnDossierNodeWork.ts`
- Test: `test/pcn-drafting-review-ui.test.ts`

**Interfaces:**
- `confirmPcnDraftOutput(input: { draftId: string; outputId: string; requirementId: string }): Promise<...>` confirms a generated draft output into the dossier checklist.
- Server validates that the draft belongs to the target dossier, the output asset provenance matches, the requirement is allowed for the current node/role, and the write is idempotent.

- [x] **Step 1: Add a failing UI/API contract test**

  Assert the node's primary action is `Soạn thảo tài liệu`, the workspace has `Xác nhận & gắn vào hồ sơ`, and the API route is present.

- [x] **Step 2: Implement the client boundary**

  Add the draft-output confirmation API and expose the action beside each generated DOCX/PDF output. Keep the draft workspace and output list visible after confirmation.

- [x] **Step 3: Implement the server provenance boundary**

  Validate the PCN session, dossier/operator scope, requirement/node compatibility and draft output metadata. Copy the private asset into the dossier document asset path, write the current version and attachment, preserve the source draft in the audit note, and reuse workflow rework/audit behavior.

- [x] **Step 4: Make drafting primary in the node panel**

  Keep upload as a secondary external-evidence control and label any quick generation fallback clearly. Add `Đang soạn`, `Đã sinh`, and `Đã xác nhận` cues.

- [x] **Step 5: Run focused tests and typecheck**

  Run: `node --test test/pcn-drafting-review-ui.test.ts`
  Run: `npm run typecheck`

### Task 4: Role-aware dossier review surface

**Files:**
- Modify: `components/PgdDossierStepWorkPanel.tsx`
- Modify: `components/PcnDossierNodeWorkPanel.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `components/PcnDossierDetailView.tsx`
- Test: `test/role-driven-drafting-review-ui.test.ts`

**Interfaces:**
- Adds a compact review summary using existing checklist/status data without changing lifecycle or schema.

- [x] **Step 1: Add review indicators**

  Show current actor role, next responsible role, missing required documents, stale/rework warnings and a clear review action at the active gate.

- [x] **Step 2: Add review copy and accessibility states**

  Use text labels plus status icons, preserve focus-visible behavior, and keep the review summary readable on mobile without body horizontal overflow.

- [x] **Step 3: Run the focused test**

  Run: `node --test test/role-driven-drafting-review-ui.test.ts`

### Task 5: Verification and HS_GD role-play readiness

**Files:**
- Modify: `test/pgd-drafting-navigation.test.ts`
- Modify: `test/drafting-ui-parity.test.ts`
- Modify: `test/dossier-mobile-focus-ui.test.ts`

- [x] **Step 1: Run the relevant regression suite**

  Run: `npm run typecheck`
  Run: `node --test test/role-driven-drafting-review-ui.test.ts test/pgd-step-drafting-review-ui.test.ts test/pcn-drafting-review-ui.test.ts test/pgd-drafting-navigation.test.ts test/drafting-ui-parity.test.ts test/dossier-mobile-focus-ui.test.ts`

- [x] **Step 2: Run the production build**

  Run: `npm run build`

- [ ] **Step 3: Exercise the six HS_GD scenarios after login**

  Use the four PGD PDFs as reference input for new PYC records and the two certification PDFs as PCN reference input. Walk the roles `Người yêu cầu → Tiếp nhận → Quản lý → Chuyên gia → Soát xét → Lãnh đạo`, create documents in the app, upload only external evidence, confirm each generated version, and record any data or access blocker instead of bypassing it.
