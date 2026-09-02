# PGDCN unified shell and cross-domain AI assistant design

## Purpose

PGDCN is one department with two first-class operational domains: **Giám định (PGD)** and **Chứng nhận (PCN)**. The current `/pgdcn/` chooser and two independent shells make the department feel like two unrelated products and leave the AI review assistant limited to PCN QC4/QC9. This design introduces one department shell, a shared dashboard, and one AI entrypoint that can assist with both PGD and PCN while preserving each domain's data, lifecycle, collection and RBAC boundary.

The change is a navigation and assistance integration. It does not merge `PgdInspectionRequest` with `CertificationDossier`, does not create a cross-domain business record, and does not authorize AI to approve, mutate or advance a dossier.

## Goals and non-goals

### Goals

- Make `/pgdcn/` the canonical signed-in shell for the Phòng Giám định - Chứng nhận.
- Let an account with both department scopes switch between `Tổng quan phòng`, `Chứng nhận (PCN)` and `Giám định (PGD)` without logging in again.
- Keep one visible navigation system while rendering domain-specific menus only inside the selected domain and only when the session has that domain scope.
- Add a read-only department dashboard that compares workload projections for PCN and PGD and links to the correct domain surface.
- Add one `Trợ lý AI` surface with a domain selector and separate review criteria for PCN and PGD.
- Extend PCN AI review from hard-coded QC4/QC9 to the active field catalog, including the current QC20 confirmation-gated profile.
- Add PGD AI review over the request, assignment, field inspection, sample, laboratory, result, report, certificate and approval snapshots.
- Preserve evidence provenance, private-file access rules, audit boundaries and mobile compact UI contracts.

### Non-goals

- No merge of PCN and PGD collections, types, status enums, workflow steps or mutation APIs.
- No replacement of the canonical PCN dossier card or PGD request card.
- No AI-generated approval, signature, lifecycle transition, document mutation or automatic correction.
- No runtime reading of Desktop/UNC/research folders, external laboratory systems or credentials.
- No PGD `QC20` catalog entry and no use of `PCN_CERTIFICATION_FIELD_CODES` as a PGD model.
- No replacement of the existing domain-specific forms, work queues, template workspaces or result-entry flows.

## Current context

- `/pgdcn/` currently renders a chooser; `/pgdcn/pcn` and `/pgdcn/pgd` render independent shells.
- `PcnWorkspace` and `PgdWorkspace` already own the domain data stores and operational surfaces.
- `PcnSidebar` and `PgdSidebar` duplicate identity, collapse, mobile and logout chrome.
- `PcnAssistantView` calls the PCN approval-assistant API and currently hard-codes `QC4` and `QC9` in the field selector.
- PCN review logic already exposes typed findings, evidence links and 11 criteria.
- PGD already exposes typed snapshots for intake, assignment, field inspection, samples, lab requests/results, reports, certificates and approvals.
- The working tree contains user changes; implementation must preserve unrelated changes and avoid destructive cleanup.

## Design

### 1. Unified department shell

`PgdcnAppShell` becomes the shared shell used by `/pgdcn/`, `/pgdcn/pcn` and `/pgdcn/pgd`. It owns the shared session check, selected domain, selected surface, shared header/mobile chrome and sign-out action. The default route opens `Tổng quan phòng`; the two compatibility routes open the same shell with their corresponding domain selected.

The shell uses these navigation concepts:

```ts
type PgdcnDomain = 'department' | 'pcn' | 'pgd';
type PgdcnSharedSection = 'department-dashboard' | 'assistant';
```

The selected domain is UI state only. Server boundaries still authorize every bootstrap, candidate query, file access and mutation from the session cookie. A user with `departmentScopes: ['PCN']` cannot see or load PGD data; a user with `['PGD']` cannot see or load PCN data; a user with both may switch domains. A system admin still requires the matching department scope for domain data access.

The shared sidebar contains:

1. Department identity: `IEMM • TVCI` and `PHÒNG GIÁM ĐỊNH - CHỨNG NHẬN`.
2. Shared entries: `Tổng quan phòng` and `Trợ lý AI`.
3. A `CHỨNG NHẬN (PCN)` group with the existing PCN work surfaces: Tổng quan, Đề nghị, Sổ điều hành, PYC & luân chuyển mẫu, Soạn thảo tài liệu, Danh sách khách hàng, and its Admin-only entries.
4. A `GIÁM ĐỊNH (PGD)` group with the existing PGD work surfaces: Tổng quan PGD, Tiếp nhận PYC, Hồ sơ đang xử lý, Hiện trường & Lấy mẫu, PTN & Kết quả, Báo cáo/Chứng thư, Khách hàng dùng chung, and its Admin-only entries.
5. User identity and logout.

PCN remains emerald-accented and PGD remains blue-accented. The active group and selected entry must be visible in the expanded sidebar; the collapsed rail keeps icon labels via `title`/`aria-label`. Mobile uses a horizontal domain switcher or stacked domain tabs with 44px-class touch targets. The sidebar must not expose a domain section when the session lacks its scope.

The existing `PcnWorkspace` and `PgdWorkspace` surfaces are reused in embedded mode under the shared shell. Embedded mode removes their duplicate login/sidebar/header and accepts the shell's selected section/navigation callbacks. Direct domain routes use the same embedded content with an initial domain, so there is one chrome implementation and no drift between entrypoints.

### 2. Shared department dashboard

`Tổng quan phòng` is a read-only projection composed from the already-loaded or scope-authorized PCN and PGD stores. It has six equal KPI cards on desktop and two columns on mobile:

1. Hồ sơ PCN.
2. Hồ sơ PGD.
3. PCN cần xử lý.
4. PGD cần xử lý.
5. Hồ sơ cần AI hỗ trợ.
6. Quá hạn / cần chú ý.

The exact values are derived from domain status projections; no dashboard collection is introduced. The AI count is the number of eligible technical-review/approval PCN dossiers plus eligible PGD requests at technical-review/leadership-approval stages, filtered by the current user's domain scope.

Below the KPI row, two domain cards sit side-by-side on desktop and stack on mobile:

- **Chứng nhận PCN**: field count, waiting lab/results, corrective action, waiting approval, QC20 scope-confirmation warning and a CTA to the PCN dashboard or AI review.
- **Giám định PGD**: intake/capability, field/sample, waiting lab results, technical/leadership review and a CTA to the PGD dashboard or AI review.

The dashboard also has one compact `Việc cần chú ý` list containing read-only attention rows tagged `PCN` or `PGD`. Each row opens the canonical dossier/request card in its own domain. The list never combines records into a shared card and never uses a workflow node as a cross-domain filter.

The existing domain dashboards remain available after entering each domain. PCN keeps the six-column KPI contract from `design.md`; the new department dashboard does not change PCN or PGD business metrics or callbacks.

### 3. Shared AI assistant experience

`Trợ lý AI` is a shared read-only workbench. The first control selects `Chứng nhận (PCN)` or `Giám định (PGD)`; the candidate list, label, search fields, status copy and criteria then come from that domain. A review run always contains exactly one domain and exactly one selected record.

The common result model is:

```ts
type AssistantDomain = 'PCN' | 'PGD';
type AssistantReviewStatus = 'PASS' | 'WARNING' | 'ERROR' | 'NOT_EVALUABLE';

type AssistantFinding = {
  id: string;
  code: string;
  message: string;
  severity: 'INFO' | 'ATTENTION' | 'CRITICAL';
  suggestedAction?: string;
  evidence: AssistantEvidence[];
};
```

The UI shows the same status colors and evidence actions for both domains. A finding must distinguish “missing evidence” from “evidence indicates a failed result”. Evidence buttons open the canonical domain card and, when a private asset is available, the authorized file endpoint. A run is ephemeral for display/export and must not create an operational record or file asset.

#### PCN criteria

The existing 11 PCN criteria remain the baseline: entry gate, completeness, identity, commercial, field evaluation, sample/PYC, lab results, technical assessment, certificate/decision, document quality and system logic. The field selector is built from active PCN catalog data rather than a literal list. The current catalog includes QC4, QC9 and QC20.

QC20 adds field-aware checks for `scopeStatus`, product form, grade, nominal dimensions, HS code, applied standard, lot definition, manufacturer/importer/origin and chemical-analysis routing/results. Cr/C thresholds are evidence for comparison only and never replace a measured result or a manager's scope confirmation. A `NEEDS_PCN_CONFIRMATION` field produces `WARNING` or `NOT_EVALUABLE` as appropriate and cannot be silently treated as confirmed.

#### PGD criteria

PGD review uses five criteria aligned with the five operational stations:

1. **Tiếp nhận & năng lực** — request identity, requester/customer, product group/catalog match, scope, location, standards, required input and capability status.
2. **Chuẩn bị & phân công** — assignment exists, assigned people have PGD scope, technical reviewer is present, assignment approval/status is consistent with the request stage.
3. **Hiện trường & lấy mẫu** — field inspection exists when required, completion/location/inspectors are present, nonconformities are preserved, sample split/codes/quantities are consistent and field evidence pointers belong to PGD.
4. **PTN & xem xét kết quả** — each lab request points to a valid PGD sample, handover is stamped, result links to the same request/lab request, required values are present, and a result issue is reported without being confused with transport state.
5. **Báo cáo, phê duyệt & trả kết quả** — report uses an active template snapshot, required cells and conclusion exist, report approval precedes leadership approval/signature, certificate snapshot matches the request/report, and issued/returned metadata is consistent.

Payment status may appear as an informational warning because PGD explicitly keeps payment non-blocking. The assistant must not turn payment into a lifecycle gate.

### 4. API and data flow

The client uses one assistant adapter with a discriminated request:

```ts
type AssistantReviewRequest =
  | { domain: 'PCN'; fieldCode: string; dossierId: string }
  | { domain: 'PGD'; requestId: string };
```

The server may expose domain-specific routes behind this adapter, but every route must enforce the same sequence:

1. Verify the PCN session cookie.
2. Verify the requested department scope and, for PCN, field scope.
3. Load the selected record from the domain's allowlisted collections, ignoring client-supplied snapshots.
4. Load only related records whose domain and foreign keys match the selected record.
5. Validate file/pointer provenance before extraction. PCN uses the existing private `file_assets` boundary; PGD accepts only `domain = pgd` document pointers, `evidenceAssetIds` and PGD-generated document assets with matching source IDs.
6. Run deterministic checks, then optional bounded AI semantic checks over a size-limited snapshot. The snapshot excludes credentials, raw prompts, external system data, research paths and unrelated records.
7. Stream typed progress/results to the UI and keep the run in an expiring server-side session map keyed to the actor and selected domain/record.

Candidate endpoints must return only eligible records in the requested domain. PCN eligibility remains `TECHNICAL_REVIEW` or `WAITING_APPROVAL` and excludes historical imports. PGD eligibility is `TECHNICAL_REVIEW` or `LEADERSHIP_APPROVAL` and excludes cancelled, rejected and archived requests.

AI failures, OCR service unavailability and unavailable private assets must produce an explicit `NOT_EVALUABLE`/error event with the affected source. They must not block manual domain operations. Export remains a snapshot of the authorized run and must enforce actor, domain and record ownership before generating PDF/DOCX.

### 5. Responsive and accessibility requirements

- The shared shell follows the existing `ddt-compact` and `mobile-scroll-y` contracts.
- Main content has `min-w-0`; wide candidate/result tables use a local horizontal scroll boundary.
- Sidebar, domain switcher, candidate selection and action buttons expose visible focus, `aria-current`, `aria-expanded`, `aria-pressed` and labels where applicable.
- The AI workbench keeps domain selection and candidate search above the result stream; the result stream has an independent mobile scroll boundary without hiding the run status.
- Color is not the only status signal; every status has Vietnamese text and an icon/label.
- No hover-only interaction is used for domain switching, admin expansion or dashboard action disclosure.

### 6. Compatibility and migration

- `/pgdcn/` changes from chooser to the shared shell.
- `/pgdcn/pcn` and `/pgdcn/pgd` remain valid and open the shared shell with an initial domain.
- Existing PCN and PGD API paths, stores, collections and canonical cards remain the source of truth.
- Existing users with a single department scope keep the same effective domain access; they simply no longer see an unauthorized domain tab.
- Existing PCN assistant runs and exports remain valid while the client migrates to the discriminated shared adapter.
- No database migration is needed for the shell/dashboard. If an assistant run record is needed for export, it is an expiring server-side projection and is not a new business collection.

### 7. Verification and acceptance criteria

The implementation is accepted when:

- `/pgdcn/` renders one shell with `Tổng quan phòng`, `Trợ lý AI`, PCN and PGD groups for a dual-scope account.
- Single-scope accounts cannot see or load the other domain; direct compatibility routes do not bypass this.
- The department dashboard renders six responsive KPI cards, two domain cards, scope-correct attention rows and correct navigation callbacks without duplicating business records.
- PCN assistant candidate/review flows include QC4, QC9 and QC20 from the catalog; QC20 confirmation-gated data creates an explicit warning/not-evaluable outcome.
- PGD assistant candidate/review flows validate the five PGD station criteria and evidence provenance, including assignment, field evidence, sample/lab links, report/template snapshot and approval sequence.
- AI findings are read-only, evidence-linked, exportable and never mutate status, approval or source records.
- Unit/contract tests cover navigation scope, dashboard projection, PCN field catalog behavior, PGD review rules, domain isolation, provenance rejection, stream errors and responsive/accessibility markers.
- `npm test`, `npm run lint`, `npm run build` and `git diff --check` pass after implementation, with pre-existing unrelated warnings reported separately.
