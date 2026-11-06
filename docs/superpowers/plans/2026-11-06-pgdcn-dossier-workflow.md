# PGDCN Dossier Workflow Implementation Plan

> **For agentic workers:** Implement one task at a time with `superpowers:executing-plans`; each task has a focused test and Codex review checkpoint. AGY runs only in `.worktrees/task-c2c-pgdcn-dossier-workflow-20261106` on the shared branch `task/c2c/pgdcn-dossier-workflow-20261106`.

**Goal:** Ship a versioned PGDCN dossier workflow with seven business steps, minimal safe intake, round-aware evidence, capability-based server authorization, and separate issuance.

**Architecture:** PCN and PGD keep independent APIs and collections. New dossiers snapshot a v2 stage/catalog policy; legacy dossiers keep their current snapshots and lifecycle. PGD assessment rounds are separate entities linked to field, sample, lab, review, and file evidence; B6 approval does not sign, and B7 owns final signed PDF and issuance metadata.

**Tech Stack:** Next.js App Router 16.4.3, React 19, TypeScript, PostgreSQL `app_documents` JSONB, private Storage, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-06-pgdcn-dossier-workflow-design.md`

## Global Constraints

- PCN remains QC4/QC9; QC20 remains PGD. Do not combine PCN/PGD collections or authorization boundaries.
- Every PCN/PGD B1 upload is optional: create/save must accept zero files, and users may upload later through the existing dossier document routes. Do not add hidden client/server attachment validation.
- Only newly created v2 templates/dossiers use the new seven-step contract; preserve legacy snapshots and data.
- Do not infer or import employee identities/roles from the unavailable workbook; never overwrite credentials or user rights.
- Documents remain private, versioned, checksummed, provenance-checked, and audited. Multiple rounds are separate records, never revisions of one evidence item.
- Do not add destructive SQL, run production migrations, use `prisma db push`, or change credentials.
- UI stays work-first, compact, responsive, and uses Vietnamese field-level errors; no Archify rendering or KPI gate.

---

## Audit and gap matrix

Status compares the three source descriptions with the currently checked-out `master` code and relevant `design.md` sections. Source uploads were not present in this workspace; the matrix uses the extracted requirements supplied in chat.

| Priority | Requirement | `design.md` today | Code today | Status / action |
|---|---|---|---|---|
| P0 | Seven steps B1–B7 with B5/B6 return to B4 | Sections 0A.2.3/0A.2.4 define seven UI stages, but 0.10 says stages only group legacy tasks and preserve the 12-task PGD lifecycle | PGD UI has seven buttons; server uses five operational stations; leadership approval currently sets request and certificate to `SIGNED` | **CONFLICT** — add v2 snapshot/runtime and preserve legacy behavior |
| P0 | Reduce PCN intake detail fields and align client/server validation/types | Sections 4.1.2/0.4 require detailed product fields at intake | `PcnWorkspace`, `validatePcnProposalIntake`, create/edit APIs still require model, brand, manufacturer, specifications and product type | **CONFLICT** — new form uses classification fields; legacy detail fields remain optional/compatible |
| P0 | Domain + group + standard + method + template catalog | Sections 0.1/0A.1 strictly separate PCN QC4/QC9 from PGD QC20 | PCN field catalog and PGD catalog are independent; no shared scoped standard catalog or pending-confirmation flags | **PARTIAL** — add shared catalog projection without merging domain storage; QCVN07/QCVN25/unknown relations pending |
| P0 | Capability-based dossier assignment and server RBAC | Section 7.1 has system/management/professional roles and domain scopes | Existing `systemUsers` roles/scopes and PGD assignment fields exist; assignments lack archivist and per-dossier capability matrix; generic mutation checks scope first | **PARTIAL** — add assignment capability snapshot and per-action server checks |
| P0 | Multi-expert assignment, multi-day plan acceptance | Sections 0A.2/0A.3 describe assignment and plan, not the new lead accept/return gate | Assignment supports multiple inspectors and one technical reviewer; plans have schedule rows but no lead acceptance/return audit | **PARTIAL** — extend plan lifecycle and role checks |
| P0 | Multiple assessment/sample/test rounds retain every result | Section 0A.2 lists field/sample/lab entities; 0.10 mandates `SINGLE` current file per requirement | Multiple artifact IDs exist; `PgdDossierDocument` versions one current file by requirement and artifacts have no round relation | **PARTIAL** — add assessment-round entity and round-aware evidence references |
| P0 | B5 read-only review; B6 separate approval; B7 issue/sign/deliver/archive | Sections 0A.9/7.1 require package boundary and audit | Technical/leadership approval exists, but leadership approval signs immediately; certificate lacks issue/expiry and final signed-file fields | **CONFLICT** — keep package approval boundary, split v2 approval and issuance |
| P1 | Requirement gates configurable, conditional, waiver reason, no early block | Section 0.10 supports required/optional/conditional and waiver, but old base checklist has fixed requirements | Template definitions, conditional rules and waiver APIs exist; creation snapshot also includes static requirements | **PARTIAL** — apply template v2 policy and defer gates until configured stage |
| P1 | B1 uploads optional; secure document round-trip | Sections 0.2/0A.3/4.1.2 permit zero-file create and later upload | PCN and PGD create routes accept no attachment collection; existing document flows remain available after create | **DONE** for zero-file create and current round-trip; add round scope and regression coverage |
| P1 | Audit assignment, returns, issuance and targeted notifications | Sections 7.4/7.4.1 define append-only audit and targeted notification | PGD activity and assignment notifications exist; new gate events/issue fields do not | **PARTIAL** — extend transactional audit/notification events |
| P2 | Superneat compact work-first UI, desktop/mobile, Vietnamese errors | Sections 0.2.3/0A.2.3/5A.44 define seven-button layout and responsive behavior | Seven-step flow, document panel, Windows modal and responsive tests exist, but labels/actions use old map | **PARTIAL** — preserve anatomy and update only v2 stage/action projection |
| P2 | Roster reconciliation with source Excel | Section 7.1 uses explicit username/role model | No source workbook in workspace; code has `systemUsers` and multiple role fields | **MISSING** — do not import; report source workbook required for verified account mapping |

## Verification matrix for the implementation in this worktree

The table below records the implementation after this task, separate from the historical baseline matrix above. The three original source files named in the design are absent from the workspace, so this audit checks the requirements quoted in the user request and the current code/tests; it cannot confirm source-only details or employee identities.

| Step | Status | Code and verification evidence |
|---|---|---|
| B1 — Intake and optional uploads | **DONE** | PCN and PGD create/save accept zero files; file controls add no hidden required gate; later uploads still use the existing scoped document routes. PCN/PGD catalog checks preserve product-group, method, standard, and domain boundaries. Evidence: `pcn-proposal-dossier-route`, `pgdcn-v2-workflow`, `pcn-pgd-required-fields-ui`, `pgdcn-intake-catalog`, and document API suites. |
| B2 — Manager review and return | **DONE** | Only authorized managers may decide the B2 capability review. Return/reject and hold require a reason, persist actor/time/reason, and remain in the review lifecycle for supplementation; the decision is audited. Evidence: `pgdcn-v2-workflow` manager, exception, and audit cases. |
| B3 — Multi-role assignment and schedule | **DONE** | Per-dossier capabilities support lead, assessors, reviewer, issuance, and archive roles; multi-day plans require the assigned team lead to accept or return, with reason and audit on return. Evidence: capability, transition, and plan-route cases in `pgdcn-v2-workflow`. |
| B4 — Assessment and testing | **DONE** | Assessment rounds are separate records; failed and passing rounds remain visible, open rounds block handoff, and round evidence is included in the dossier package. Evidence: round lifecycle, package manifest, and B4 gate tests in `pgdcn-v2-workflow`, plus PGD document and operations suites. |
| B5 — Independent review | **DONE** | Reviewer approval advances to B6; returning to B4 requires a reason and opens a new round. The package retains prior evidence, while the B5 panel exposes read-only evidence. Evidence: B5 return/approval, package manifest, and read-only panel tests. |
| B6 — Management approval | **DONE** | Leadership approval is separate from signing, records an approval snapshot, and may return to B4 with a reason and new round. Legacy approval behavior remains covered separately. Evidence: B6 approval/return and legacy compatibility tests in `pgdcn-v2-workflow`. |
| B7 — Issuance, delivery, and archive | **DONE** | Authorized office users attach the final signed/stamped PDF with issue/expiry dates; delivery records recipient/time; assigned archivists complete archive. The server validates gates, scope, role, and idempotency. Evidence: `pgdcn-issuance` and B7 route tests in `pgdcn-v2-workflow`. |

Cross-step checks confirm PCN/PGD data and authorization boundaries remain separate, v2 is opt-in for new dossiers, legacy snapshots keep their mapping, and audit writes remain append-only. Desktop/mobile layout contracts have focused UI coverage; REAL AUTH against a real dossier still requires QA credentials and dossier IDs not present in the environment.

## Acceptance tests by priority

- **P0:** PCN and PGD B1 create/save succeed with zero files, without hidden client/server upload validation, and accept later upload; minimal PCN create/edit succeeds without hidden product detail; category/domain/standard validation rejects cross-domain QC20; v2 mapping and immutable legacy mapping; B5/B6 return to B4; active authorized multi-role assignment; multi-day plan accept/return; two distinct assessment rounds retain fail then pass; B6 does not sign and B7 records signature/issue dates.
- **P1:** required/optional/conditional gate and reasoned waiver; multiple round evidence in B5 manifest; private upload/download and checksum; audit and notifications target only assigned usernames; idempotent repeated actions.
- **P2:** seven stage buttons and correct panel/action per role on desktop and mobile; no clipped text/horizontal page overflow; search accepts unaccented Vietnamese; field errors remain adjacent and translated.
- **Release:** `npm run typecheck`, focused Node tests, integration tests, Playwright create/edit/desktop/mobile smoke, `npm run build`; inspect the final diff for destructive SQL and unrelated changes.

## File map

- `utils/pgdcnIntakeCatalog.ts`: domain/product group/standard/method/template catalog with explicit confirmation state.
- `types.ts`, `utils/pgdDomain.ts`, `utils/pgdWorkflowTemplate.ts`, `utils/pgdDossier.ts`, `utils/pgdArtifacts.ts`: v2 snapshot, catalog, assignment capability, round and metadata types/policies.
- `utils/pcnIntakePolicy.ts`, `app/api/pcn/intake/route.ts`, `app/api/pcn/proposals/[proposalId]/route.ts`, `components/PcnWorkspace.tsx`: validation/schema/create/edit/modal.
- `app/api/pgd/requests/route.ts`, `app/api/pgd/requests/[requestId]/transition/route.ts`, PGD assignment/plan/approval/certificate/document routes: server gates, evidence, audit, issuance.
- `components/PgdWorkspace.tsx`, `components/PgdDossierFlow.tsx`, `components/PgdDossierStepWorkPanel.tsx`: v2 work-first display and role-aware actions; keep legacy projections.
- `test/pgdcn-intake-catalog.test.ts`, `test/pgdcn-v2-workflow.test.ts`, focused existing intake/RBAC/document/workflow suites: behavioral contracts.
- `design.md`: update only durable v2 decisions in 0A.2.3, 0.10, 4.1.2 and 7.1/7.4.

## Implementation tasks

### Task 1 — Scoped intake catalog and minimal PCN intake

**Files:** Create `utils/pgdcnIntakeCatalog.ts`; modify `types.ts`, `utils/pcnIntakePolicy.ts`, `app/api/pcn/intake/route.ts`, `app/api/pcn/proposals/[proposalId]/route.ts`, `components/PcnWorkspace.tsx`; test `test/pgdcn-intake-catalog.test.ts` and PCN intake API/UI contracts.

- [ ] Write tests proving QCVN04/QC4 and QCVN09/QC9 are PCN-confirmed, QCVN20/QC20 is PGD-only, unconfirmed QCVN07/QCVN25 and custom unmapped standard cannot silently select a wrong domain, and product group is not a field code.
- [ ] Write create/edit tests that omit model/brand/manufacturer/specification/product type and still pass when required intake classification/customer/registration fields are present.
- [x] Verify PCN and PGD create/save routes accept zero attachments, the create dialogs have no required file control, and later upload uses existing dossier routes. Verified by `test/pcn-proposal-dossier-route.test.ts`, `test/pgdcn-v2-workflow.test.ts`, `test/pcn-pgd-required-fields-ui.test.ts`, `test/dossier-supplementary-modal-contract.test.ts`, `test/pcn-dossier-documents.test.ts`, and PGD dossier operation API contracts.
- [ ] Run these tests and confirm the failures point to missing catalog/validation behavior.
- [ ] Implement the catalog and update both client/server validation plus stored model fields; remove the detailed PCN modal section while retaining the product group selector and existing historic values.
- [ ] Run the focused tests and `npm run typecheck` before the next task.

### Task 2 — Versioned seven-step workflow and return policy

**Files:** Modify `types.ts`, `utils/pgdWorkflowTemplate.ts`, `utils/pgdWorkflow.ts`, `components/PgdDossierFlow.tsx`, `components/PgdDossierStepWorkPanel.tsx`, PGD transition and approval routes; test `test/pgdcn-v2-workflow.test.ts` and existing snapshot/transition suites.

- [ ] Add red tests for the exact seven v2 stage IDs/order, 0–6 prior-stage compatibility, return B5/B6→B4, and B6 approval not signing.
- [ ] Implement `workflowSchemaVersion: 2` in new snapshots/runtime; retain existing status/stage mapping when the snapshot is absent or v1.
- [ ] Enforce server-side role/capability and gate checks for B2–B7; create an append-only return event and make retries idempotent.
- [ ] Run focused workflow and authorization tests.

### Task 3 — Assignment capabilities and schedule acceptance

**Files:** Modify `utils/pgdDomain.ts`, `utils/pgdArtifacts.ts`, `components/PgdWorkspace.tsx`, PGD assignment/inspection-plan routes and assignment controls; test assignment RBAC and schedule API contracts.

- [ ] Add red tests for multiple inspectors, separate team lead/reviewer/office/archivist capabilities, active/scope checks and rejection of unqualified usernames.
- [ ] Add round-safe assignment capability snapshots without modifying `systemUsers` from the missing workbook.
- [ ] Add multi-day schedule state with explicit lead accept/return, reason, actor and audit; require acceptance before opening B4.
- [ ] Run focused RBAC/schedule tests and typecheck.

### Task 4 — Multiple assessment rounds and round-aware evidence

**Files:** Modify `utils/pgdDomain.ts`, `utils/pgdDossier.ts`, `utils/pgdArtifacts.ts`, `utils/pgdApi.ts`, `store-pgd.ts`, PGD field/sample/lab/document routes and panels; test `test/pgdcn-v2-workflow.test.ts`, PGD document API and workflow tests.

- [ ] Add red tests that create two distinct rounds, attach separate field minutes/samples/lab requests/results, preserve round-one fail when round two passes, and keep document versions scoped by `(requestId, roundId, requirementCode)`.
- [ ] Implement a separate `pgdAssessmentRounds` entity and optional `assessmentRoundId` links; preserve all legacy records with no round ID.
- [ ] Ensure B4 completion checks every open round and B5 review manifest includes all rounds/evidence while the reviewer view is read-only.
- [ ] Run focused round, upload/download, checksum and manifest tests.

### Task 5 — Separate approval from signing, issuance and archive

**Files:** Modify `utils/pgdDomain.ts`, `app/api/pgd/approvals/route.ts`, `app/api/pgd/certificates/route.ts`, add or extend PGD issuance route, document upload/download route and B7 workspace panel; test issuance and approval APIs.

- [ ] Add red tests for B6 APPROVED without `SIGNED`, B6 return to B4, and B7-only signed PDF/date/expiry/delivery/archive updates.
- [ ] Implement final PDF private asset provenance, date fields, assigned office/archivist RBAC, and append-only audit/targeted notification.
- [ ] Preserve legacy approval/signature behavior only for v1 snapshots and verify idempotent retries.
- [ ] Run approval/issuance/upload/download tests.

### Task 6 — Intake UX, catalog affordances and SSOT

**Files:** Modify shared intake selection and domain workspace forms, `components/PcnWorkspace.tsx`, `components/PgdWorkspace.tsx`, focused CSS only if needed, `design.md`; test modal and responsive smoke contracts.

- [ ] Add tests for domain-first entry, accent-insensitive search, confirmed/pending labels, desktop 3–4-column compact form, mobile single-column layout and Vietnamese field errors.
- [ ] Implement the domain selection/router handoff while each domain writes only its own endpoint; show registration number/date separately from generated internal code.
- [ ] Update only the directly related SSOT sections with v2-only behavior, legacy compatibility, round identity, and QCVN confirmation flags.
- [ ] Run the Impeccable detector once against changed UI targets and resolve relevant findings.

### Task 7 — Full verification and branch completion

**Files:** No unrelated files; use existing tests and add only focused regression coverage from prior tasks.

- [ ] Run typecheck, focused/unit/integration suites, Playwright desktop/mobile create/edit and role workflows, then production build.
- [ ] Inspect diff, verify no destructive SQL or secrets, verify repository/worktree ownership and status, and record exact evidence.
- [ ] Commit on `task/c2c/pgdcn-dossier-workflow-20261106`; integrate into the checked-out mainline only if it can be done without touching the pre-existing dirty checkout or concurrent worktrees.
- [ ] Check Docker production status after verification; release only if tests/build pass and the actual production target can be proven safe without migration or credential changes.
