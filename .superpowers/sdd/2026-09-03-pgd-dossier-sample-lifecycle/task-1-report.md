# Task 1 Report

Completed the canonical PGD dossier/sample lifecycle changes in the requested scope.

## Files changed

- `utils/pgdDomain.ts`
- `utils/pgdDossier.ts`

## What changed

- Added `PGD_COLLECTIONS.dossierDocuments`.
- Extended `PgdSample` compatibly with dossier/sample lifecycle metadata.
- Updated `splitPgdSample()` so LAB and RETAINED rows get distinct non-empty seal numbers, a timestamp derived from the `now` argument, and optional sampling metadata without breaking existing callers.
- Added the PGD-only dossier module with:
  - `getPgdDossierRequirements(productGroup)`
  - `buildPgdDossierDocument(input, now)`
  - `validatePgdSample(sample)`
  - `buildPgdSampleRegister(samples)`
  - `markPgdSampleDestroyed(sample, actorUsername, note, now)`

## Tests run

- `node --test test/pcn-pgd-dossier-samples.test.ts`
- `node --test test/pcn-pgd-domain.test.ts`

## Concerns

- The working tree already contains many unrelated modified and untracked files outside this task scope. I did not touch them.

## Fix note

- Adjusted `getPgdDossierRequirements()` so `MACHINERY_LINE` retains the full commercial/customs baseline and the fallback groups keep `SAMPLE_HANDOVER_LAB` plus the PTN result lifecycle items.
- Re-ran the requested regression coverage and confirmed both `test/pcn-pgd-dossier-samples.test.ts` and `test/pcn-pgd-domain.test.ts` pass.
- Removed the duplicate requirement-code insertions so each product-group requirement list stays unique while preserving the required base items and technical additions.
- Compatibility follow-up: extended `PgdDossierDocument` with optional `documentNumber`, `documentDate`, and `note`, and updated `buildPgdDossierDocument()` to preserve/normalize those fields when present so the dossier sample regression stays green without changing server/store/UI/SQL/source code.
