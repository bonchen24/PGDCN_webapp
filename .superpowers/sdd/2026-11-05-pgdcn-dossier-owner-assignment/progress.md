# SDD ledger — plan: docs/superpowers/plans/2026-11-05-pgdcn-dossier-owner-assignment.md

## Preflight scan: shared task files and interfaces

| Tasks | Shared file/interface | Produced → consumed | Scan result |
|---|---|---|---|
| 1 → 2 | `PgdDossierAssignment` server response / `store-pgd.assignOwner` | Task 1 keeps the current single mutation and store merge; Task 2 exposes only a callback and does not call the API itself. | Compatible; one mutation boundary. |
| 1 → 3 | PGD `ownerUsername` projection and `pgd.assignOwner` | Task 1 guarantees blank-on-create and server response merge; Task 3 displays that value and invokes the existing store action. | Compatible; no lifecycle state is introduced. |
| 2 → 3 | `DossierOwnerAssignmentPicker` option and callback contract | Task 2 produces the documented picker contract; Task 3 consumes it in the PGD wrapper. | Compatible; wrapper owns scope filtering. |
| 2 → 5 | `PcnDossierAssignmentControl` | Task 2 integrates the picker and preserves manager/self-claim policy; Task 5 consumes the control without changing its API. | Compatible; Task 5 must not duplicate PCN owner mutation. |
| 3 → 4 | `PgdDossierAssignmentControl` | Task 3 produces the PGD wrapper over `pgd.assignOwner`; Task 4 reuses it at the detail header. | Compatible; detail must remove its late duplicate editor. |
| 3 → 4 | `PgdDossierAssignmentControl` and PGD UI tests | Task 3 puts the top detail banner in `PgdWorkspace`; Task 4 removes only the duplicate late editor in `PgdDossierOperationsPanel` and tests that contract. | Compatible; same owner callback, one visible manager control. |
| 3 → 7 | PGD dashboard/register controls | Task 3 adds scoped actions; Task 7 checks design contract and visual behavior. | Compatible; no file overlap with `design.md`. |
| 4 → 7 | PGD detail header and status policy | Task 4 places assignment before the rail; Task 7 verifies layout and documents it. | Compatible. |
| 5 → 6 | PCN `PcnDossierAssignmentControl` | Task 5 consumes the Task 2 control; Task 6 reuses the same detail control. | Compatible; no duplicate mutation if detail moves, rather than clones, the existing control. |
| 6 → 7 | PCN detail header | Task 6 moves the owner control before the rail; Task 7 verifies placement and responsive layout. | Compatible. |
| 1 | Backend tests and PGD route | Tests are written before code, run red, then the existing route is updated to pass them. | Self-consistent. |
| 2 | Picker component and unit tests | Picker behavior is tested before implementation; domain callbacks remain external. | Self-consistent. |
| 3 | PGD list/dashboard/UI tests | Tests cover manager, staff, viewer and assigned/unassigned projections before wiring the wrapper. | Self-consistent. |
| 4 | PGD detail/UI tests | Tests prove before-rail placement and no duplicate late editor before moving UI. | Self-consistent. |
| 5 | PCN list/UI tests | Tests exercise existing manager rights and field scope before replacing text cells. | Self-consistent. |
| 6 | PCN detail/UI tests | Tests establish placement; implementation moves existing assignment UI and keeps self-claim separate. | Self-consistent. |
| 7 | Design and release checks | No code behavior is deferred; all UI/backend tasks are complete before final QA/commit. | Self-consistent. |

### Rulings
- Ruling: The PGD detail rail is rendered from `PgdWorkspace`, so Task 3 owns the top banner in that file while Task 4 removes only the later editor from `PgdDossierOperationsPanel` — this avoids two implementers editing the same large workspace file; cost if wrong: the banner may be placed at a workspace boundary instead of the detail boundary.

- Ruling: The PGD manager assignment action remains disabled when the existing dossier status policy locks owner changes — this keeps list/detail affordances aligned with current server and detail-panel policy; cost if wrong: managers may need to reassign a late-stage dossier through the existing leadership workflow.
- Ruling: The shared picker owns presentation and confirmation only; each domain wrapper supplies permitted employees and the existing mutation — this prevents generic data access and duplicate writes; cost if wrong: a future domain with different selection policy needs another wrapper.
- Ruling: PGD's owner column uses a minimal optional `PgdcnDossierSummaryGrid.renderCell` hook and optional labels on `DossierOwnerAssignmentPicker`; grid callers without a renderer keep their existing editor and sorting behavior, and PGD owner changes stay behind the picker confirmation; cost if wrong: shared grid interactions or PCN copy could regress.

### Task log

- Task 1: complete (commits `0a85177..a0d5974`, review clean). Evidence: 27/27 focused, 1224 pass/8 skip in `npm test`, typecheck exit 0. Review finding: none. Broader PGD selection had 19 untouched UI contract failures; recheck affected contracts in UI tasks.
- Task 2: complete (commits `a0d5974..d51d0d1`, review clean after resolving P2 PCN search metadata regression). Evidence: focused browser+PCN suite 11/11, typecheck exit 0, diff check clean. Review finding: restored position/department role/system role search metadata in the neutral picker adapter; follow-up review PASS.
- Task 3: complete (commit `f721343`, `feat(pgd): add dossier owner assignment surfaces`). Evidence: 20/20 focused picker/surface/register tests, typecheck exit 0, diff check clean. Review pending.
- Task 4: pending.
- Task 5: pending.
- Task 6: pending.
- Task 7: pending.
