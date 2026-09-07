# Task 6 report — combobox, workspace, and modal hardening

Worktree: `E:\CODING\PCN_webapp\.worktrees\pgdcn-official-superneat-ui`

## Scope

Implemented only the six component surfaces named in the brief plus the required contract-test extension:

- `components/PcnCatalogCombobox.tsx`
- `components/PgdWorkspace.tsx`
- `components/PcnDocumentOutputModal.tsx`
- `components/PcnProposalDetailModal.tsx`
- `components/PcnResultDetailModal.tsx`
- `components/PcnLabRequestDetailModal.tsx`
- `test/pcn-official-superneat-ui.test.ts`

No schema, API, persistence, RBAC, callback, collection, lifecycle, or business-value mapping was changed. Existing Vietnamese copy was preserved.

## Changes

- Added `focus-visible` indicators to combobox input, clear/toggle controls, and options while preserving search normalization and keyboard selection behavior.
- Preserved combobox listbox semantics and mobile scroll behavior; retained mobile touch targets for clear/toggle/option controls and reduced the dropdown to a light official shadow.
- Hardened all four PCN detail/output modals with `min-h-0` viewport panels, independently scrollable bodies, `shrink-0` header/footer anatomy, accessible labelled dialogs, focus-visible action controls, and mobile touch targets.
- Added presentation semantics to the result modal backdrop and reduced modal panel shadows to the official light-shadow level.
- Removed the PGD register row-level click handler so the PYC code button is the single clear interactive owner; preserved `onOpen(request.id)` and added an accessible dossier name.
- Added shared PGD numeric input modes (`numeric` for integer steps, `decimal` otherwise) without changing values or payload construction; existing date inputs remain `type="date"`.
- Removed decorative lift/transition behavior from the PGD request card and added visible keyboard focus.
- Extended the official/superneat contract test for combobox focus/touch markers, four modal semantics/scroll/focus contracts, and the PGD nested-interactive-row regression.

## TDD evidence

RED was run before production edits:

```text
focused PCN controls and modal surfaces ... FAIL
PGD register rows expose one clear interactive owner ... FAIL
8 passed, 2 failed
```

The failures were the intended missing `focus-visible` contract and existing `<tr onClick>` conflict.

GREEN was then verified with the focused suites:

```text
28 tests
28 passed
0 failed
```

## Verification

Commands run from the primary shell against the corrected worktree:

```text
node --require <worktree>/scripts/native-dev-preload.cjs <root>/node_modules/tsx/dist/cli.mjs --test \
  <worktree>/test/pcn-official-superneat-ui.test.ts \
  <worktree>/test/pcn-mobile-scroll.test.ts \
  <worktree>/test/pcn-document-modals.test.ts \
  <worktree>/test/pgd-operational-stations-ui.test.ts
PASS — 28/28

npm --prefix <worktree> run typecheck
PASS — exit code 0

npm --prefix <worktree> run build
PASS — exit code 0; Next.js optimized build and static generation completed

git -C <worktree> diff --check
PASS — exit code 0
```

## Verification limitation

No browser-driven visual or manual keyboard/mobile viewport session was run. Confidence is based on the RED/GREEN source contracts, TypeScript validation, and production build. Git emitted environment line-ending/ignore-file warnings during read-only checks, but `git diff --check` returned exit code 0.
