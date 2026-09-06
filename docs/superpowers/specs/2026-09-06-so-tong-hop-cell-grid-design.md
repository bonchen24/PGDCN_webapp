# Sổ tổng hợp Cell-Grid PCN/PGD Design

**Status:** Approved in chat on 2026-09-06

## Goal

Replace the PCN and PGD operations projections with two independent **Sổ tổng hợp** pages. Each page presents one dossier/request per row and dossier fields as spreadsheet-like cells, with controlled inline editing.

## Boundaries

- PCN reads only the PCN dossier graph (`CertificationProposal`, `CertificationDossier`, samples, lab requests, results and issuance projections).
- PGD reads only the PGD request graph and its linked assignment, field, sample, laboratory, report, certificate and document projections.
- The two registers never merge rows, collections, permissions or saved column layouts.
- No `summaryRegister` collection or generic cell mutation endpoint is introduced.
- The register remains a projection: workflow transitions, history, audit, documents, results, sample routes and issued numbers are read-only cells and link to the canonical dossier workspace.

## Cell editing contract

The shared grid edits one complete cell draft on Enter or blur and cancels on Escape. Tab commits and advances to the next editable cell. While a row mutation is pending, its cells are disabled. The UI does not optimistically invent a snapshot: it replaces the row with the server response after success and shows the server validation message beside/toast for failure.

PCN editable cells are limited to the existing proposal whitelist (customer snapshot, warehouse, product, model/brand/type/specifications/manufacturer and quantity) and dossier whitelist (owner/evaluator/reviewer, target date, evaluation/effective date and method). PGD editable cells are limited to `PgdInspectionRequestEditPatch` plus owner assignment. Immutable identifiers, field/profile, lifecycle status and derived operational projections remain read-only.

## Shared grid UX

`PgdcnDossierSummaryGrid` owns the common spreadsheet behavior: pinned row identity, horizontal scroll, selection, inline inputs, keyboard commit/cancel/navigation, column visibility/order/width persistence, search, local filtering, pagination and CSV export. Persistence keys include the domain and current username. Domain adapters provide row values, labels, input types, read-only state and mutation callbacks; the grid never knows PCN or PGD API details.

PCN and PGD provide separate column definitions and row adapters. Default columns cover the dossier fields listed in the approved chat design; nested customer/product/registry values are flattened into labeled cells. Missing values render as `Chưa cập nhật` while CSV keeps them empty. The current dossier open action remains the canonical detail workspace.

## Error handling and permissions

The grid disables editing for viewers and for immutable/derived fields. API errors leave the original server row intact, close no unrelated edits and identify the field when available. Existing server validation, RBAC, audit and idempotency boundaries are authoritative; client-side edit metadata is only a presentation aid.

## Verification

- Unit tests cover PCN/PGD row normalization, field-to-payload mapping, filtering, CSV column/value alignment and missing-value handling.
- Component contract tests assert both branches render **Sổ tổng hợp**, use the shared grid, keep separate persistence keys and retain canonical dossier open callbacks.
- Run the focused tests, `npm run typecheck`, `git diff --check`, and the full PCN test runner before completion.
