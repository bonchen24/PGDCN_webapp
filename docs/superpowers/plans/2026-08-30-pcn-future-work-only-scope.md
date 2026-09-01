# PCN future-work-only scope amendment

## Goal

Keep the PCN product focused on creating and operating new certification dossiers. Research files from Desktop and legacy DDT/inspection history are read-only research evidence, never runtime input or product data.

## Constraints

- Preserve the existing PCN card, dossier, customer-list, QC4/QC9 and sample-flow UI.
- Keep `Đề nghị` as the PCN intake concept; reserve `Phiếu yêu cầu` for outbound requests to testing rooms.
- Do not expose historical dossier discovery, review, import, mapping, or source-path controls.
- Do not persist or read the Desktop research directory at runtime.
- Keep the PCN Supabase/Docker and port configuration unchanged.

## Tasks

1. Update the design contract and add regression tests for the future-work boundary.
2. Remove historical discovery/review surfaces from navigation, workspace, dossier detail, queue and store contracts.
3. Remove `sourceRoot` template/import controls and historical API routes; retain only new-work template/catalog operations.
4. Remove historical readiness gates from issuance and adjust affected tests/contracts to the new product scope.
5. Run the focused scope tests, full PCN test suite, build, lint and diff checks.

## Current surface amendment

The PCN runtime is intentionally smaller than the original migration plan: the daily navigation has only **Tổng quan**, **Đề nghị**, and **Danh sách khách hàng**. QC4/QC9 are filters/branches inside the dashboard and proposal cards, not a separate Hồ sơ page. A dossier card contains five internal regions: **Tổng quan**, **Tài liệu hồ sơ**, **Mẫu & PYC**, **KQTN**, and **Phê duyệt & phát hành**. Generation, proposal details, attachments, and history are collapsed blocks inside the first two regions.

## Verification

- No active PCN UI/API references `historicalDiscovery`, `historicalReview`, `historicalImport` or `sourceRoot`.
- New dossier creation and dossier document-package workflow remain available.
- Existing customer management and sample-lot flow remain available.
