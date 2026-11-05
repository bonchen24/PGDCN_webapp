# PGDCN Dossier Owner Assignment Implementation Plan

> **For agentic workers:** Execute task-by-task in the isolated `task/c2c/dossier-owner-assignment` worktree. Preserve the red-green test cycle and review each task before continuing.

**Goal:** New PGD and PCN dossiers remain unassigned until an authorized manager assigns an active employee in the same domain, with consistent owner controls on management lists and at the top of detail pages.

**Architecture:** Keep `ownerUsername` as the only source of truth and an unassigned display projection; persist `null` for new PGD owners and preserve the existing empty value for new PCN dossiers. Do not add lifecycle states or collections. Reuse PGD `assignOwner` and PCN dossier update mutations, server authorization, audit, and store merges. Add a shared client assignment picker, with domain-specific option filtering and PCN self-claim policy.

**Tech Stack:** Next.js 16.4.3 App Router, React, TypeScript, Tailwind CSS, PostgreSQL transaction helpers, Zustand stores, Node test runner with `tsx`, Playwright.

**Spec:** `design.md` sections 0.2, 0A.3, 0A.4, and 0A.9; the user's explicit requirements supersede the current PGD creator-owner sentence in 0A.9.

## Global Constraints

- Exactly one dossier per PGD request or PCN proposal conversion; use existing transaction and identity rules.
- New PGD records persist `ownerUsername: null`; PCN keeps its existing empty-on-create convention. Reads never claim records; legacy assigned records remain unchanged.
- Keep the seven-stage PGD workflow, PCN workflow snapshots, OCR, DOCX templates, edit flows, and independent evaluator/reviewer assignments intact.
- Manager actions require server authorization and active same-domain assignees; PCN candidates must also match dossier field scope.
- PCN staff self-claim remains available only under its existing policy; viewers never receive assignment controls.
- No generic database endpoint, migration, production write, push, or deploy.
- Assignment updates merge into existing client stores so mounted projections refresh immediately.
- At 390px and 1440px, do not introduce viewport-level horizontal overflow; use existing table scroll/card patterns.

---

### Task 1: Make PGD creation unassigned and harden assignment server behavior

**Files:**
- Modify: `utils/pgdDomain.ts`
- Modify: `app/api/pgd/requests/route.ts`
- Modify: `app/api/pgd/requests/[requestId]/owner/route.ts`
- Modify: `utils/pgdcnNotification.ts` only if needed to express a targeted owner notification
- Modify: `store-pgd.ts` only if creation or assignment synthesizes an owner instead of merging the server response
- Modify: `test/pgd-dossier-operations.test.ts`
- Modify: `test/pgd-dossier-operations-api-contract.test.ts`
- Modify: `test/pcn-notification-contract.test.ts`
- Create: `test/pcn-proposal-dossier-route.test.ts`

- [x] First add assertions that PGD factory and POST ignore creator owner values; same-owner PGD retries cause no second audit/notification; assignment requires the PGD manager boundary and an active non-viewer PGD assignee; successful assignment writes one `ASSIGNED` audit and notification with `targetUsernames` containing only the selected username.
- [x] Add PCN proposal-conversion regression assertions for an empty new owner, one dossier per proposal, and idempotent retry; preserve current PCN manager/staff/viewer checks and field scope behavior.
- [x] Run the focused tests and confirm the missing PGD behavior fails for the expected assertions.
- [x] Update the PGD factory/server create boundary to force a blank owner without changing transaction, samples, checklist, workflow snapshot, or request identity.
- [x] Keep the existing PUT assignment boundary; validate manager authority and active PGD scope server-side, no-op when the selected username already owns the request, and apply the existing post-signature assignment policy.
- [x] Write one `ASSIGNED` audit event and one transaction-bound notification addressed only to the new owner. Do not add another endpoint.
- [x] Run focused PGD and PCN creation/assignment tests to green.

### Task 2: Add an accessible, confirmed owner picker

**Files:**
- Create: `components/DossierOwnerAssignmentPicker.tsx`
- Modify: `components/PcnDossierAssignmentControl.tsx`
- Modify: `test/pcn-dossier-assignment-ui.test.ts`
- Create: `test/dossier-owner-assignment-picker.test.ts`

**Picker contract:** `options` contains `{ username: string; displayName: string }`; `ownerUsername` and `ownerDisplayName` describe the current value; `canAssign`, `disabled`, and `compact` control visibility/state; `onAssign(username): Promise<void>` performs the existing domain mutation once.

- [x] Add tests for a prominent unassigned CTA, compact assigned transfer action, manager-only visibility, Vietnamese diacritic-insensitive search, explicit selection/confirmation, busy duplicate-submit guard, and inline error/success feedback.
- [x] Run the focused tests and verify the picker assertions fail before implementation.
- [x] Implement a portal-backed lightweight dialog so table overflow cannot clip it. Use a labeled search field and visible employee names/usernames, keyboard-accessible choices, cancel, and confirm.
- [x] Require a changed username before enabling confirm; disable the form while saving and close only after `onAssign` resolves.
- [x] Route PCN control options through `getPcnAssignableDossierUsers` and existing denial policy; preserve PCN staff self-claim as its separate action.
- [x] Run picker and existing PCN assignment UI tests to green.

### Task 3: Add owner actions across PGD dashboards, queues, and registers

**Files:**
- Modify: `components/PgdcnDashboardView.tsx`
- Modify: `components/PgdcnAppShell.tsx`
- Create: `components/PgdDossierAssignmentControl.tsx`
- Modify: `components/PgdDossierQueueView.tsx`
- Modify: `components/PgdSummaryRegisterView.tsx`
- Modify: `components/PgdWorkspace.tsx`
- Modify: `test/pgd-dossier-operations-ui.test.ts`
- Create or extend: `test/dossier-owner-assignment-surfaces.test.ts`

- [x] Add tests proving unassigned PGD dashboard/queue/register rows expose “Giao hồ sơ” only to PGD managers, assigned rows show employee display names and a compact “Đổi người” action, and viewer/staff rows do not expose manager actions, and PGD detail status/action appears before the workflow rail.
- [x] Run the focused tests and verify they fail because owner cells currently render text or an inline select.
- [x] Feed active PGD-scope employees and the existing `pgd.assignOwner` mutation into a PGD wrapper around the shared picker.
- [x] Put the control in the owner position in the unified dashboard, PGD workspace register, dossier queue, and summary register. Replace direct owner cell auto-save with the explicit confirm picker.
- [x] Ensure managers can reach every in-scope unassigned record from the dashboard; do not depend only on the existing six-item waitingOthers cap. Keep the current personal work projection unchanged for staff.
- [x] Render the compact owner status/assignment block in `PgdWorkspace` before the PGD workflow rail; show waiting copy to unassigned staff and the assigned display name to scoped readers. Keep the existing seven stages unchanged.
- [x] Remove creator-as-owner fallbacks in display/identity projections; keep request visibility and existing field filters unchanged.
- [x] Let the existing store response merge update all visible owner projections immediately; run focused PGD surface and operation tests to green.

### Task 4: Remove the late PGD assignment editor

**Files:**
- Modify: `components/PgdDossierOperationsPanel.tsx`
- Reuse: `components/PgdDossierAssignmentControl.tsx`
- Modify: `test/pgd-dossier-operations-ui.test.ts`
- Extend: `test/dossier-owner-assignment-surfaces.test.ts`

- [x] Add a focused regression asserting that `PgdDossierOperationsPanel` no longer contains a second owner picker after the detail header control was added in Task 3.
- [x] Run that test red, remove the late assignment editor while retaining the owner display and status-policy message, then run it green.
- [x] Keep assignment disabled where the existing post-signature policy locks it; retain all seven stages, snapshots, OCR, and DOCX behavior.
- [x] Run PGD detail/flow tests to green.

### Task 5: Add assignment actions across PCN queues and registers

**Files:**
- Modify: `components/PcnDossierQueueView.tsx`
- Modify: `components/PcnPipelineBoard.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PcnOperationsRegisterView.tsx` (used by `PcnWorkspace` for the owner column in the summary register)
- Modify: `test/pcn-dossier-queue-view-ui.test.ts`
- Modify: `test/summary-register-grid.test.ts`
- Extend: `test/dossier-owner-assignment-surfaces.test.ts`

- [x] Assert managers see the confirmed picker in each owner column for unassigned rows and assigned names with compact transfer action; viewer/staff do not see manager controls.
- [x] Run focused tests red before UI changes.
- [x] Pass dossier field codes, the active matching PCN user list, current actor permissions, and the existing `updateDossier` mutation to the shared picker.
- [x] Use the shared grid's optional owner-cell renderer in the PCN register; keep evaluator and reviewer columns independently editable.
- [x] Keep list data domain-scoped and preserve row navigation, PCN self-claim behavior, evaluator/reviewer assignments, and status locks.
- [x] Run focused PCN board, queue, and workspace tests to green.

### Task 6: Put PCN assignment status before the workflow rail

**Files:**
- Modify: `components/PcnDossierDetailView.tsx`
- Modify: `components/PcnDossierAssignmentControl.tsx` (use the requested concise “Giao hồ sơ” / “Đổi người” labels across PCN surfaces)
- Reuse: `components/PcnDossierAssignmentControl.tsx`
- Modify: `test/pcn-dossier-detail-ux.test.ts`
- Modify: `test/pcn-dossier-assignment-ui.test.ts`
- Extend: `test/dossier-owner-assignment-surfaces.test.ts`

- [x] Assert the owner control/status appears before the first workflow rail and is not duplicated in a later step panel.
- [x] Run the focused test red before moving the existing assignment control.
- [x] Show manager assignment at the top, assigned display to scoped readers, and the existing staff self-claim action only when policy allows.
- [x] Use “Giao hồ sơ” for unassigned manager CTA and “Đổi người” for the compact transfer action, with matching confirmation copy.
- [x] Preserve the existing PCN manager authority, matching field scope, workflow snapshot and independent evaluator/reviewer controls; run focused PCN detail tests to green.

### Task 7: Update the owner contract, run QA, and commit

**Files:**
- Modify: `design.md` sections 0.2 and 0A.9

- [x] Specify PGD and PCN unassigned-on-create semantics, manager assignment surfaces, top-of-detail placement, targeted PGD notification, and the existing PCN self-claim/evaluator/reviewer policies.
- [x] Run `npm run typecheck` and `npm test`; record totals and skipped tests in the SDD ledger.
- [x] Run Impeccable's detector once over changed UI files and review its findings; they point only to unchanged style lines, so no task-scoped finding applies.
- [~] Leave the existing port 1357 listener untouched and start the worktree app on free port 1358. Browser role-state QA at 390px/1440px is unverified: the route remained at session authentication and `/api/auth/pcn-session` returned 401; no credentials or dossier data were used.
- [x] Review `git diff --check`, complete diff, and destructive SQL patterns. Stage only task files and commit with a conventional `feat:` message.
- [x] Fast-forward local `master` only if it remains at the worktree base and integration has no conflicts; never push or deploy.
