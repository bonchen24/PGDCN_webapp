# PGD v1 implementation

## Final deployment audit — 2026-09-05

- The visible PGD request code is `PGD-YYMMDD-TT` (example `PGD-260905-01`). It intentionally has no literal `PYC` prefix; `TT` is a two-digit sequence reset at the start of each Vietnam calendar day.
- Runtime wording now describes the two-step approval chain: technical approval/review followed by leadership approval and signature. The old single-level “PGD manager approval” wording is no longer used in the PGD runtime.
- Verification completed: `npm test` 684/684, `npm run lint`, `npm run build`, and `git diff --check` passed. Docker Desktop rebuilt and recreated `pcn_webapp-webapp:latest`; port 2357 serves `/api/health` and `/pgdcn/pgd` with HTTP 200.
- The Desktop `PGD` source remains read-only and was not modified, deleted, renamed, watched, or imported at runtime.

## Verified scope

- Runtime catalog exposes every source-derived PGD type: stainless steel `GĐ-THEP-KG`, general steel/metal `GĐ-THEP-TT58`, machinery/line `GĐ-MAY-01`, coal `GĐ-THAN-01`, outside inspection `GĐ-NGOAI-01`, and other/general goods `GĐ-HH-01`.
- `Giám định ngoài` is a separate catalog type inside data group `OTHER`; the inspection location/channel remains a separate dossier field.
- The server issues the visible dossier number as `PGD-YYMMDD-TT`, using the Vietnam calendar date. The two-digit serial increments within the date and starts at `01` each new day.
- Each PYC maps to one PGD dossier. The existing dossier model supports repeatable product, lot, sample, document and laboratory-result rows.
- Technical review prepares evidence and the report, followed by two approval steps: technical approval and leadership approval (`LEADERSHIP_APPROVAL`).

## Source and document boundary

- The Desktop `PGD` folder was inspected read-only. No source file was changed, deleted, renamed, watched or imported.
- DOCX assets are resolved from the packaged PGD template set and keep placeholder, version, checksum and provenance metadata. Generated output remains in PGD-owned storage metadata.
- PGD has no runtime Desktop/UNC watcher and no payment, quotation or testing-fee surface.

## Verification

- `npm test`: 669/669 pass.
- PGD/PGDCN focused checks: 43/43 pass, including all source-derived catalog groups and legacy-catalog supplementation.
- `npm run lint`, `npm run build` and `git diff --check`: pass.
- Full maintenance suite: 1167/1172 pass; the five failures are pre-existing historical PCN reconcile/discovery/manual-mapping contracts outside the PGD v1 scope.

## Follow-up audit — 2026-09-05

- Re-checked the two BM branches in `Desktop\PGD` read-only. No source mutation or runtime import/watch behavior was introduced.
- Updated the SSoT wording so PGD template/cell administration is explicitly local to the DOCX settings modal, not shared system settings.
- `/pgdcn/pgd` is reachable and shows the protected login surface. Station-level visual smoke remains pending an authenticated test session; no credentials were entered.
