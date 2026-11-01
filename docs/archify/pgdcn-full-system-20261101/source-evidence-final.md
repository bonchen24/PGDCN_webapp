# Source evidence — final delivery layer

Revision: 348b855a57595eec2646bb462e5c29571c3be501. No authenticated read-only DB connection was available; no private customer/case data or file bytes were read. Live PUBLISHED workflow records remain NOT_VERIFIED.

## Source line ledger

- utils/pgdcnNavigation.ts:16-34 — 1 node(s): system-operation--client_intake
- app/api/pcn/intake/route.ts:130-194 — 11 node(s): system-operation--client_intake, system-operation--pcn_proposal, system-operation--pcn_dossier, pcn-canonical--pcn_proposal, pcn-canonical--pcn_review, …
- utils/pgdDomain.ts:234-263 — 1 node(s): system-operation--client_intake
- utils/pgdcnNavigation.ts:16-22 — 2 node(s): system-operation--nav_shared, system-operation--nav_shared
- components/PgdcnDashboardView.tsx:14-30 — 2 node(s): system-operation--nav_shared, system-operation--nav_shared
- design.md:80-81 — 1 node(s): system-operation--rbac_session
- utils/pcnRbac.ts:75-83 — 1 node(s): system-operation--rbac_session
- utils/pcnRbac.ts:46-85 — 1 node(s): system-operation--rbac_session
- utils/pgdcnNavigation.ts:24-28 — 1 node(s): system-operation--pcn_proposal
- design.md:90-92 — 1 node(s): system-operation--pcn_proposal
- utils/pcnWorkflowTemplate.ts:37-110 — 7 node(s): system-operation--pcn_proposal, pcn-canonical--pcn_select, pcn-canonical--pcn_join, pcn-qc4-pack--qc4_select, pcn-qc4-pack--qc4_native, …
- utils/pgdcnNavigation.ts:30-34 — 1 node(s): system-operation--pgd_request
- design.md:374-379 — 1 node(s): system-operation--pgd_request
- app/api/pgd/requests/route.ts:1-140 — 1 node(s): system-operation--pgd_request
- utils/pgdDossier.ts:171-222 — 4 node(s): system-operation--pgd_request, system-operation--pgd_plan, system-operation--field_sample_pgd, system-operation--pgd_review_kqtn
- utils/pgdcnNavigation.ts:61-83 — 1 node(s): system-operation--admin_assign
- utils/pcnRbac.ts:58-83 — 1 node(s): system-operation--admin_assign
- utils/pgdcnNavigation.ts:61-89 — 1 node(s): system-operation--admin_assign
- utils/pgdDomain.ts:234-447 — 145 node(s): system-operation--admin_assign, pgd-canonical--s01, pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s04, …
- utils/pcnDossierTemplateCatalog.ts:1-180 — 1 node(s): system-operation--admin_assign
- utils/pcnWorkflowTemplate.ts:141-156 — 1 node(s): system-operation--pcn_dossier
- design.md:90-91 — 1 node(s): system-operation--pcn_dossier
- utils/pcnWorkflowTemplate.ts:129-155 — 7 node(s): system-operation--pcn_dossier, pcn-canonical--pcn_select, pcn-canonical--pcn_join, pcn-qc4-pack--qc4_select, pcn-qc4-pack--qc4_native, …
- utils/pgdDomain.ts:24-31 — 1 node(s): system-operation--pgd_plan
- design.md:370-373 — 1 node(s): system-operation--pgd_plan
- utils/pgdWorkflow.ts:33-76 — 73 node(s): system-operation--pgd_plan, pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s05, pgd-canonical--s06, …
- design.md:84-88 — 2 node(s): system-operation--db_dossier, system-operation--db_dossier
- utils/pgdDomain.ts:7-31 — 1 node(s): system-operation--db_dossier
- sql/pcn-schema.sql:1-80 — 1 node(s): system-operation--db_dossier
- templates/pcn/manifest.json:13-14 — 1 node(s): system-operation--ext_lab_handoff
- utils/pgdDomain.ts:372-373 — 1 node(s): system-operation--ext_lab_handoff
- templates/pcn/manifest.json:11-15 — 1 node(s): system-operation--ext_lab_handoff
- app/api/pgd/lab-results/route.ts:1-72 — 15 node(s): system-operation--ext_lab_handoff, system-operation--pgd_sample_ledger, system-operation--ext_lab_result, pgd-canonical--s08, pgd-steel-lot-inspection--s08, …
- utils/pcnDossierDocuments.ts:50-52 — 1 node(s): system-operation--sample_lab_pcn
- templates/pcn/manifest.json:11-14 — 1 node(s): system-operation--sample_lab_pcn
- utils/pcnDossierDocuments.ts:50-58 — 1 node(s): system-operation--sample_lab_pcn
- lib/server/workflow-tasks.ts:32-230 — 3 node(s): system-operation--sample_lab_pcn, pcn-canonical--pcn_native, pcn-canonical--pcn_technical
- utils/pgdWorkflow.ts:49-54 — 1 node(s): system-operation--field_sample_pgd
- design.md:380-381 — 1 node(s): system-operation--field_sample_pgd
- utils/pgdWorkflow.ts:49-61 — 1 node(s): system-operation--field_sample_pgd
- utils/pgdDomain.ts:139-140 — 2 node(s): system-operation--pgd_sample_ledger, system-operation--pgd_sample_ledger
- design.md:381-381 — 1 node(s): system-operation--pgd_sample_ledger
- templates/pcn/manifest.json:15-15 — 2 node(s): system-operation--ext_lab_result, system-operation--ext_lab_result
- design.md:385-385 — 1 node(s): system-operation--ext_lab_result
- utils/pgdcnNavigation.ts:43-46 — 2 node(s): system-operation--pcn_drafting, system-operation--pcn_drafting
- templates/pcn/manifest.json:16-17 — 1 node(s): system-operation--pcn_drafting
- utils/pcnDossierDocuments.ts:24-118 — 13 node(s): system-operation--pcn_drafting, pcn-canonical--pcn_documents, pcn-canonical--pcn_lab, pcn-qc4-pack--qc4_intake, pcn-qc4-pack--qc4_assign, …
- app/api/pcn/dossiers/[dossierId]/documents/confirm-generated/route.ts:1-74 — 2 node(s): system-operation--pcn_drafting, pcn-canonical--pcn_documents
- utils/pgdWorkflow.ts:56-61 — 2 node(s): system-operation--pgd_review_kqtn, system-operation--pgd_review_kqtn
- design.md:388-393 — 2 node(s): system-operation--pgd_review_kqtn, system-operation--pgd_review_kqtn
- utils/pcnRbac.ts:46-63 — 2 node(s): system-operation--mgmt_signature, system-operation--mgmt_signature
- design.md:97-97 — 1 node(s): system-operation--mgmt_signature
- app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts:80-195 — 4 node(s): system-operation--mgmt_signature, system-operation--pcn_issue_archive, pcn-canonical--pcn_approval, pcn-canonical--pcn_release
- app/api/pgd/approvals/route.ts:1-155 — 13 node(s): system-operation--mgmt_signature, pgd-canonical--s11, pgd-steel-lot-inspection--s11, pgd-steel-tt58-inspection--s11, pgd-machinery-line-inspection--s11, …
- utils/pgdcnNavigation.ts:16-41 — 4 node(s): system-operation--ai_ocr_assist, system-operation--ai_ocr_assist, system-operation--audit_journal, system-operation--audit_journal
- design.md:480-485 — 2 node(s): system-operation--ai_ocr_assist, system-operation--ai_ocr_assist
- design.md:95-95 — 2 node(s): system-operation--client_receipt, system-operation--pcn_issue_archive
- design.md:376-376 — 2 node(s): system-operation--client_receipt, system-operation--pgd_issue_archive
- app/api/pcn/issuance/[issuanceId]/deliver/route.ts:70-97 — 4 node(s): system-operation--client_receipt, system-operation--pcn_issue_archive, pcn-canonical--pcn_approval, pcn-canonical--pcn_release
- app/api/pgd/requests/[requestId]/package/route.ts:95-197 — 14 node(s): system-operation--client_receipt, system-operation--pgd_issue_archive, pgd-canonical--s12, pgd-steel-lot-inspection--s12, pgd-steel-tt58-inspection--s12, …
- utils/pcnDossierDocuments.ts:55-58 — 1 node(s): system-operation--pcn_issue_archive
- app/api/pcn/issuance/[issuanceId]/issue/route.ts:100-168 — 3 node(s): system-operation--pcn_issue_archive, pcn-canonical--pcn_approval, pcn-canonical--pcn_release
- app/api/pcn/issuance/[issuanceId]/archive/route.ts:58-90 — 3 node(s): system-operation--pcn_issue_archive, pcn-canonical--pcn_approval, pcn-canonical--pcn_release
- utils/pgdWorkflow.ts:67-76 — 2 node(s): system-operation--pgd_issue_archive, system-operation--pgd_issue_archive
- design.md:480-480 — 2 node(s): system-operation--audit_journal, system-operation--audit_journal
- components/PcnDossierDetailView.tsx:236-243 — 37 node(s): pcn-canonical--pcn_select, pcn-canonical--pcn_select, pcn-canonical--pcn_native, pcn-canonical--pcn_join, pcn-canonical--pcn_join, …
- components/PcnDossierDetailView.tsx:872-872 — 37 node(s): pcn-canonical--pcn_select, pcn-canonical--pcn_select, pcn-canonical--pcn_native, pcn-canonical--pcn_join, pcn-canonical--pcn_join, …
- components/PcnDossierFlow.tsx:150-151 — 37 node(s): pcn-canonical--pcn_select, pcn-canonical--pcn_select, pcn-canonical--pcn_native, pcn-canonical--pcn_join, pcn-canonical--pcn_join, …
- utils/pcnRbac.ts:45-85 — 1 node(s): pcn-canonical--pcn_assign
- app/api/pcn/dossiers/[dossierId]/documents/[requirementId]/waive/route.ts:1-92 — 1 node(s): pcn-canonical--pcn_documents
- components/PgdDossierStepWorkPanel.tsx:48-60 — 12 node(s): pgd-canonical--s01, pgd-steel-lot-inspection--s01, pgd-steel-tt58-inspection--s01, pgd-machinery-line-inspection--s01, pgd-coal-lot-inspection--s01, …
- design.md:374-385 — 144 node(s): pgd-canonical--s01, pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s04, pgd-canonical--s05, …
- components/PgdWorkspace.tsx:1159-1167 — 144 node(s): pgd-canonical--s01, pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s04, pgd-canonical--s05, …
- components/PgdWorkspace.tsx:1352-1367 — 144 node(s): pgd-canonical--s01, pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s04, pgd-canonical--s05, …
- components/PgdWorkspace.tsx:1542-1548 — 144 node(s): pgd-canonical--s01, pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s04, pgd-canonical--s05, …
- components/PgdDossierStepWorkPanel.tsx:194-198 — 144 node(s): pgd-canonical--s01, pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s04, pgd-canonical--s05, …
- components/PgdDossierStepWorkPanel.tsx:277-293 — 144 node(s): pgd-canonical--s01, pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s04, pgd-canonical--s05, …
- utils/pgdWorkflow.ts:148-199 — 72 node(s): pgd-canonical--s02, pgd-canonical--s03, pgd-canonical--s05, pgd-canonical--s06, pgd-canonical--s07, …
- utils/pgdDossier.ts:171-263 — 96 node(s): pgd-canonical--s04, pgd-canonical--s05, pgd-canonical--s06, pgd-canonical--s07, pgd-canonical--s09, …
- utils/pgdDossier.ts:226-248 — 24 node(s): pgd-canonical--s04, pgd-canonical--s10, pgd-steel-lot-inspection--s04, pgd-steel-lot-inspection--s10, pgd-steel-tt58-inspection--s04, …

## Catalog truth

- PCN QC4_BLANK_PACK and QC9_BLANK_PACK are blank dossier-pack profiles in source, not workflow IDs; no workflow version/status is declared. Checklist baseline is in utils/pcnDossierDocuments.ts and runtime configuration may merge/override.
- All 11 active:true PGD profiles from utils/pgdDomain.ts:234-447 are included. They identify code-catalog profiles/product groups/methods; they are not DB workflow-template records.
- PGD manifest version 1.3 and PCN manifest statuses describe DOCX assets only, not workflow publication status.

## Redraw provenance

- The three main workflows, 13 profile workflows and seven selected technical candidates were redrawn or materially revised from source commit 348b855a57595eec2646bb462e5c29571c3be501.
- Operational UI guidance was checked against source commit 348b855a57595eec2646bb462e5c29571c3be501; the Atlas remains a static knowledge artifact and is not an in-app workflow UI.
- PCN workspace: components/PcnDossierDetailView.tsx:236-243,872; components/PcnDossierFlow.tsx:150-151.
- PGD workspace: components/PgdWorkspace.tsx:1159-1167,1352-1367,1542-1548; components/PgdDossierStepWorkPanel.tsx:194-198,277-293.
- No authenticated read-only DB source was available. Runtime PUBLISHED template IDs/versions/status remain NOT_VERIFIED.
