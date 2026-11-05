### Task 5: Add assignment actions across PCN queues and registers

**Files:**
- Modify: `components/PcnDossierQueueView.tsx`
- Modify: `app/(workspace)/pcn/page.tsx` (queue caller passes PCN users, current actor, and `pcn.updateDossier`)
- Reuse and verify: `components/PcnPipelineBoard.tsx`, `components/PcnWorkQueueView.tsx` (existing manager assignment and staff self-claim)
- Reuse: `components/PcnWorkspace.tsx` (register caller)
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
