### Task 3: Add owner actions across PGD dashboards, queues, and registers

**Files:**
- Modify: `components/PgdcnDashboardView.tsx`
- Modify: `components/PgdcnAppShell.tsx` or `app/pgdcn/pgd/page.tsx`, whichever supplies the dashboard state
- Create: `components/PgdDossierAssignmentControl.tsx`
- Modify: `components/PgdDossierQueueView.tsx`
- Modify: `components/PgdSummaryRegisterView.tsx`
- Modify: `components/PgdcnDossierSummaryGrid.tsx` (minimal optional cell renderer; default behavior remains unchanged)
- Modify: `components/DossierOwnerAssignmentPicker.tsx` (optional PGD action labels; PCN defaults remain unchanged)
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

### Shared UI contract adjustment

`PgdcnDossierSummaryGrid` accepts an optional `renderCell` callback, guarded from generic cell editing when it returns content; consumers without the callback retain the existing search, sorting, and editor behavior. `DossierOwnerAssignmentPicker` accepts optional action and confirmation labels, with its existing PCN copy as defaults. PGD uses the extension for an explicit confirmed assignment in the owner cell; it does not auto-save from the grid editor.
