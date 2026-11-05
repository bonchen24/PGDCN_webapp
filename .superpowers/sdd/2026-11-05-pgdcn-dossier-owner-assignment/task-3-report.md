# Task 3 report — PGD dossier owner surfaces

## Delivered

- Added `PgdDossierAssignmentControl`, which applies the PGD manager policy, offers only active PGD-scoped non-viewer candidates, and delegates a confirmed change to the existing `pgd.assignOwner` callback.
- Added owner assignment controls to the unified dashboard manager queue, PGD workspace register, dossier queue, summary register, and dossier detail header before the existing workflow rail.
- Kept the dashboard personal-work projection scope-based and unchanged. The separate manager queue lists all PGD requests supplied by the PGD store without the six-row cap.
- Aligned PGD data loading and refresh with the server permission: system admins and organization leaders can load PGD data without explicit scope; PGD role managers still require PGD scope. The dashboard queue is gated by the PGD-specific request source and manager permission.
- Added optional shared-grid cell rendering with generic editor activation guarded when custom content is supplied. Added optional picker action labels; existing PCN label defaults remain intact.
- Updated the brief and SDD ledger with this shared UI contract. `design.md` was left to Task 7.

## RED evidence

- The initial focused surface suite failed before wiring the PGD wrapper, actions, and detail status block.
- The direct `PgdRegisterTable` test failed while the register owner cell was still plain text and the component was not exported for a surface-level render test.
- The data-access test failed before `canLoadPgdDataForUser` was added. A global admin with no explicit scope also initially had no dashboard manager queue.

## GREEN evidence

Command:

```text
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/dossier-owner-assignment-surfaces.test.ts test/dossier-owner-assignment-picker.test.ts test/pgd-dossier-operations-ui.test.ts test/pgd-register-ui.test.ts
```

Result: **20/20 passed**.

`npm run typecheck` completed with exit code 0. `git diff --check` completed with exit code 0.

## Limits

- Surface assertions use server-rendered markup and existing picker unit tests; no browser end-to-end run was performed.
- The existing store mutation and server route were not changed. Assignment results continue to flow through the store's existing response merge.
