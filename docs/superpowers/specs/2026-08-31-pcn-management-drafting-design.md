# PCN management and drafting workspaces specification

## Purpose

PCN operates new certification dossiers from a `Đề nghị` through five gated steps. The dossier card remains the source of truth for work execution. This specification adds the management projections and a free drafting workspace requested by the department without restoring DDT/Haimy/cutover or historical-review workflows.

## Active surfaces

- `Tổng quan`: current workload and five-step process map.
- `Đề nghị`: proposal cards and dossier entry point.
- `Sổ điều hành`: read-only projection of every active dossier, with compact-step, owner, completeness, due-date and customer filters; opening a row opens the canonical dossier card.
- `PYC & luân chuyển mẫu`: read-only management projection of outbound PYC, sample lots and lab routes. Mutations still happen in the dossier card's `Mẫu & PYC` region.
- `Soạn thảo tài liệu`: independent workspace for preparing optional customer-facing or internal documents. It may use a proposal/dossier as a source but does not advance the dossier lifecycle.
- `Trợ lý tiến trình`: bounded assistant over the current PCN snapshot. It recommends the next dossier action and highlights missing/overdue work; it never mutates a dossier without an explicit action in the canonical card.
- `Danh sách khách hàng`, plus Admin-only `Nhân sự PCN` and `Cài đặt PCN`.

Retired surfaces remain absent: Haimy, Cutover, historical discovery/review/import, DDT schedules, independent backup/archive/integrity pages and legacy template-source managers. The Desktop PCN research folder is authoring input only; it is never a runtime dependency, path selector, watcher, API input, database value or UI link.

## Management projections

`Sổ điều hành` uses `buildPcnOperationsRegisterRows` from the existing proposal, dossier, sample, lab, result and issuance collections. It must show the compact five-step label, completeness numerator/denominator, missing requirements, owner, target date and a direct dossier action. It is read-only and has client-side filters plus CSV export; it does not introduce a new collection.

`PYC & luân chuyển mẫu` projects each outbound PYC and sample route as a cell/card row grouped by dossier and laboratory. Required columns are dossier/proposal, lot code, sample code/quantity, laboratory, PYC number, route status, sent/received/result-returned dates, current location, issue and owner. The projection links to the canonical dossier tab and does not create a second sample source of truth.

## Independent drafting workspace

The drafting screen is intentionally outside the five-step gate. A user can:

1. Search by proposal number or dossier number and load a read-only source snapshot. When a dossier is selected, related sample-lot, route, outbound-PYC, handover and returned-result snapshots may prefill matching form fields for operator confirmation.
2. Choose a PCN form/template, including dossier cover, assignment, evaluation plan, field inspection, sampling, sample coding, evaluation report, certification result/appendix, commercial/contract and outbound PYC/handover documents where a checked-in template exists. The input form derives required controls from the selected template manifest, so every required placeholder (including form-specific fields such as sample location, sampling date or sender) is editable and validated. PTN test reports remain reference-only, while official certificate/decision generation remains approval-gated in the dossier card.
3. Edit structured form fields in a compact form, while prefilled values remain traceable to the selected proposal/dossier and related sample-flow source; the workspace never writes those related records.
4. Save a draft workspace and later reopen it.
5. Generate DOCX, PDF or both. Generation uses the checked-in PCN template pack and private Storage/file-asset rules, and stores output metadata. The pack contains normalized, customer-data-free PCN templates; it has no dependency on the source research folder. A draft output may be sent for signature or another purpose without changing dossier status.

Draft state is separate from `CertificationDossier.operationalForms`: it stores `sourceProposalId`, optional `sourceDossierId`, `templateId`, `formKind`, structured `values`, status, actor and output asset IDs. Source identifiers are optional so a user can prepare a blank document, but generation must make missing required fields visible and must not silently invent business facts. On save, the server re-reads any referenced proposal/dossier from the PCN database, verifies that the records exist and belong to the same dossier relationship, and rejects historical-import records or client-only source references. When a dossier is selected without an explicit proposal ID, the linked proposal is resolved from the dossier before validation. The same source check is repeated immediately before generation, and canonical field codes are resolved from the server-side proposal/dossier snapshot rather than trusted from the client payload.

## Assistant behavior

The assistant combines deterministic, auditable recommendations with an optional bounded Q&A endpoint over the current snapshot. It reports:

- dossiers blocked by the current five-step gate;
- required documents missing or waived with reason;
- due dates that are overdue or approaching;
- PYC/sample routes waiting for handover, lab receipt or returned KQTN;
- KQTN scans waiting for confirmation and dossiers ready for technical review.

It can accept a short question and answer from a server-side compact snapshot. That snapshot is filtered to active future-work dossiers before serialization and includes only step 1–5, completeness, PYC, lot, route, location and KQTN metadata; it does not include file bytes, credentials, research-folder paths, historical records or external lab data. It does not access the research folders, DDT data, external lab systems or secrets. It never mutates business data; any future generative action must still be confirmed and routed through a dedicated server boundary.

## Non-functional constraints

- Preserve the existing IEMM/TVCI shell, card/modal density and customer catalog.
- Next.js App Router remains the only active runtime route; native dev is port 1357 and Docker production is port 2357.
- PCN PostgreSQL/Supabase remains self-hosted on Docker Desktop with private file assets.
- All new server mutations require the existing PCN session/RBAC, audit and idempotency conventions.
- Tests must verify that management projections are derived, drafting is independent of lifecycle status, and retired surfaces are not reintroduced.
