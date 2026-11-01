# Source evidence ledger

Snapshot: commit 521f8d517560f3767321c19ad492658bb507b4b4 on branch master. Candidate sources are checked against the isolated authoring worktree before index generation.
Node/participant/entity/state source pointers are embedded in each `.candidate.json`. Archify 3.1 does not attach `sources` to architecture connections; edge assertions below use the same diagram candidates and are resolved through these grouped source pointers.

## 00-master · Bản đồ vận hành toàn app

- [`app/api/pcn/intake/route.ts:154-247`](../../../app/api/pcn/intake/route.ts#L154)
- [`app/api/pcn/intake/route.ts:49-63`](../../../app/api/pcn/intake/route.ts#L49)
- [`app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts:1-210`](../../../app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts#L1)
- [`app/api/pcn/issuance/[issuanceId]/archive/route.ts:21-98`](../../../app/api/pcn/issuance/[issuanceId]/archive/route.ts#L21)
- [`app/api/pcn/issuance/[issuanceId]/deliver/route.ts:21-98`](../../../app/api/pcn/issuance/[issuanceId]/deliver/route.ts#L21)
- [`app/api/pcn/issuance/[issuanceId]/issue/route.ts:141-343`](../../../app/api/pcn/issuance/[issuanceId]/issue/route.ts#L141)
- [`app/api/pcn/ocr/route.ts:49-125`](../../../app/api/pcn/ocr/route.ts#L49)
- [`app/api/pgd/approvals/route.ts:31-150`](../../../app/api/pgd/approvals/route.ts#L31)
- [`app/api/pgd/assistant/review/route.ts:88-118`](../../../app/api/pgd/assistant/review/route.ts#L88)
- [`app/api/pgd/lab-requests/route.ts:22-95`](../../../app/api/pgd/lab-requests/route.ts#L22)
- [`app/api/pgd/lab-result-reviews/route.ts:18-68`](../../../app/api/pgd/lab-result-reviews/route.ts#L18)
- [`app/api/pgd/lab-results/route.ts:21-86`](../../../app/api/pgd/lab-results/route.ts#L21)
- [`app/api/pgd/ocr/route.ts:43-114`](../../../app/api/pgd/ocr/route.ts#L43)
- [`app/api/pgd/requests/[requestId]/package/route.ts:145-184`](../../../app/api/pgd/requests/[requestId]/package/route.ts#L145)
- [`app/api/pgd/requests/route.ts:28-138`](../../../app/api/pgd/requests/route.ts#L28)
- [`app/api/pgd/requests/route.ts:28-47`](../../../app/api/pgd/requests/route.ts#L28)
- [`components/PgdcnSidebar.tsx:53-55`](../../../components/PgdcnSidebar.tsx#L53)
- [`components/PgdDossierStepWorkPanel.tsx:48-106`](../../../components/PgdDossierStepWorkPanel.tsx#L48)
- [`sql/pcn-schema.sql:115-131`](../../../sql/pcn-schema.sql#L115)
- [`sql/pcn-schema.sql:13-113`](../../../sql/pcn-schema.sql#L13)
- [`sql/pcn-schema.sql:5-10`](../../../sql/pcn-schema.sql#L5)
- [`utils/pcnLabIntegration.ts:245-339`](../../../utils/pcnLabIntegration.ts#L245)
- [`utils/pcnLabIntegration.ts:393-461`](../../../utils/pcnLabIntegration.ts#L393)
- [`utils/pcnSampleFlow.ts:86-142`](../../../utils/pcnSampleFlow.ts#L86)
- [`utils/pcnWorkflowRuntime.ts:267-325`](../../../utils/pcnWorkflowRuntime.ts#L267)
- [`utils/pcnWorkflowRuntime.ts:334-428`](../../../utils/pcnWorkflowRuntime.ts#L334)
- [`utils/pcnWorkflowTemplate.ts:141-198`](../../../utils/pcnWorkflowTemplate.ts#L141)
- [`utils/pgdDomain.ts:1133-1136`](../../../utils/pgdDomain.ts#L1133)
- [`utils/pgdWorkflow.ts:33-68`](../../../utils/pgdWorkflow.ts#L33)
- [`utils/pgdWorkflow.ts:67-76`](../../../utils/pgdWorkflow.ts#L67)

## 01-navigation · 13 đích điều hướng và shell Superneat

- [`components/PgdcnAppShell.tsx:412-485`](../../../components/PgdcnAppShell.tsx#L412)
- [`components/PgdcnDashboardView.tsx:14-30`](../../../components/PgdcnDashboardView.tsx#L14)
- [`components/PgdcnSidebar.tsx:194-201`](../../../components/PgdcnSidebar.tsx#L194)
- [`components/PgdcnSidebar.tsx:205-215`](../../../components/PgdcnSidebar.tsx#L205)
- [`components/PgdcnSidebar.tsx:221-231`](../../../components/PgdcnSidebar.tsx#L221)
- [`components/PgdcnSidebar.tsx:232-240`](../../../components/PgdcnSidebar.tsx#L232)
- [`components/PgdcnSidebar.tsx:53-55`](../../../components/PgdcnSidebar.tsx#L53)
- [`utils/pgdcnNavigation.ts:16-41`](../../../utils/pgdcnNavigation.ts#L16)
- [`utils/pgdcnNavigation.ts:24-28`](../../../utils/pgdcnNavigation.ts#L24)
- [`utils/pgdcnNavigation.ts:30-34`](../../../utils/pgdcnNavigation.ts#L30)
- [`utils/pgdcnNavigation.ts:36-58`](../../../utils/pgdcnNavigation.ts#L36)
- [`utils/pgdcnNavigation.ts:43-46`](../../../utils/pgdcnNavigation.ts#L43)
- [`utils/pgdcnNavigation.ts:45-49`](../../../utils/pgdcnNavigation.ts#L45)
- [`utils/pgdcnNavigation.ts:46-50`](../../../utils/pgdcnNavigation.ts#L46)
- [`utils/pgdcnNavigation.ts:61-77`](../../../utils/pgdcnNavigation.ts#L61)
- [`utils/pgdcnNavigation.ts:61-83`](../../../utils/pgdcnNavigation.ts#L61)
- [`utils/pgdcnNavigation.ts:79-83`](../../../utils/pgdcnNavigation.ts#L79)

## 02-pcn-intake-assignment · PCN · Đề xuất, hồ sơ và phân công

- [`app/api/pcn/dossiers/[dossierId]/route.ts:217-310`](../../../app/api/pcn/dossiers/[dossierId]/route.ts#L217)
- [`app/api/pcn/intake/route.ts:154-247`](../../../app/api/pcn/intake/route.ts#L154)
- [`app/api/pcn/intake/route.ts:283-301`](../../../app/api/pcn/intake/route.ts#L283)
- [`app/api/pcn/intake/route.ts:49-153`](../../../app/api/pcn/intake/route.ts#L49)
- [`app/api/pcn/intake/route.ts:49-63`](../../../app/api/pcn/intake/route.ts#L49)
- [`app/api/pcn/intake/route.ts:63-153`](../../../app/api/pcn/intake/route.ts#L63)
- [`utils/pcnDossierAssignment.ts:1-120`](../../../utils/pcnDossierAssignment.ts#L1)
- [`utils/pcnDossierAssignment.ts:74-95`](../../../utils/pcnDossierAssignment.ts#L74)
- [`utils/pcnDossierStepAccess.ts:50-88`](../../../utils/pcnDossierStepAccess.ts#L50)
- [`utils/pcnWorkflowTemplate.ts:141-198`](../../../utils/pcnWorkflowTemplate.ts#L141)
- [`utils/pcnWorkflowTemplate.ts:45-110`](../../../utils/pcnWorkflowTemplate.ts#L45)

## 03-pcn-dynamic-workflow · PCN · Workflow cấu hình động

- [`app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts:1-210`](../../../app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts#L1)
- [`app/api/pcn/issuance/[issuanceId]/archive/route.ts:21-98`](../../../app/api/pcn/issuance/[issuanceId]/archive/route.ts#L21)
- [`app/api/pcn/issuance/[issuanceId]/deliver/route.ts:21-98`](../../../app/api/pcn/issuance/[issuanceId]/deliver/route.ts#L21)
- [`app/api/pcn/issuance/[issuanceId]/issue/route.ts:141-343`](../../../app/api/pcn/issuance/[issuanceId]/issue/route.ts#L141)
- [`utils/pcnDossierPipeline.ts:35-55`](../../../utils/pcnDossierPipeline.ts#L35)
- [`utils/pcnWorkflowRuntime.ts:267-325`](../../../utils/pcnWorkflowRuntime.ts#L267)
- [`utils/pcnWorkflowRuntime.ts:334-428`](../../../utils/pcnWorkflowRuntime.ts#L334)
- [`utils/pcnWorkflowRuntime.ts:38-60`](../../../utils/pcnWorkflowRuntime.ts#L38)
- [`utils/pcnWorkflowRuntime.ts:92-190`](../../../utils/pcnWorkflowRuntime.ts#L92)
- [`utils/pcnWorkflowTemplate.ts:141-198`](../../../utils/pcnWorkflowTemplate.ts#L141)
- [`utils/pcnWorkflowTemplate.ts:45-110`](../../../utils/pcnWorkflowTemplate.ts#L45)

## 04-pgd-12-steps · PGD · Đúng 12 nhiệm vụ

- [`app/api/pgd/approvals/route.ts:31-150`](../../../app/api/pgd/approvals/route.ts#L31)
- [`app/api/pgd/assignments/route.ts:31-98`](../../../app/api/pgd/assignments/route.ts#L31)
- [`app/api/pgd/lab-requests/route.ts:22-95`](../../../app/api/pgd/lab-requests/route.ts#L22)
- [`app/api/pgd/lab-result-reviews/route.ts:18-68`](../../../app/api/pgd/lab-result-reviews/route.ts#L18)
- [`app/api/pgd/lab-results/route.ts:21-86`](../../../app/api/pgd/lab-results/route.ts#L21)
- [`app/api/pgd/requests/route.ts:28-138`](../../../app/api/pgd/requests/route.ts#L28)
- [`components/PgdDossierStepWorkPanel.tsx:48-106`](../../../components/PgdDossierStepWorkPanel.tsx#L48)
- [`utils/pgdWorkflow.ts:67-76`](../../../utils/pgdWorkflow.ts#L67)

## 05-documents-and-templates · Hồ sơ tài liệu, DOCX và workflow templates

- [`app/api/pcn/dossiers/[dossierId]/documents/[requirementId]/waive/route.ts:89-120`](../../../app/api/pcn/dossiers/[dossierId]/documents/[requirementId]/waive/route.ts#L89)
- [`app/api/pcn/dossiers/[dossierId]/documents/confirm-draft-output/route.ts:1`](../../../app/api/pcn/dossiers/[dossierId]/documents/confirm-draft-output/route.ts#L1)
- [`app/api/pcn/dossiers/[dossierId]/documents/confirm-generated/route.ts:1`](../../../app/api/pcn/dossiers/[dossierId]/documents/confirm-generated/route.ts#L1)
- [`app/api/pcn/dossiers/[dossierId]/documents/route.ts:131-180`](../../../app/api/pcn/dossiers/[dossierId]/documents/route.ts#L131)
- [`app/api/pcn/drafts/[draftId]/generate/route.ts:1`](../../../app/api/pcn/drafts/[draftId]/generate/route.ts#L1)
- [`app/api/pcn/templates/[templateId]/annotate/route.ts:1`](../../../app/api/pcn/templates/[templateId]/annotate/route.ts#L1)
- [`app/api/pcn/templates/[templateId]/review/route.ts:1`](../../../app/api/pcn/templates/[templateId]/review/route.ts#L1)
- [`app/api/pgd/approvals/route.ts:69-87`](../../../app/api/pgd/approvals/route.ts#L69)
- [`app/api/pgd/document-templates/[templateId]/source/route.ts:1`](../../../app/api/pgd/document-templates/[templateId]/source/route.ts#L1)
- [`app/api/pgd/document-templates/route.ts:1`](../../../app/api/pgd/document-templates/route.ts#L1)
- [`app/api/pgd/requests/[requestId]/dossier-documents/route.ts:148-214`](../../../app/api/pgd/requests/[requestId]/dossier-documents/route.ts#L148)
- [`app/api/pgd/workflow-templates/[templateId]/publish/route.ts:1`](../../../app/api/pgd/workflow-templates/[templateId]/publish/route.ts#L1)
- [`app/api/pgd/workflow-templates/[templateId]/retire/route.ts:1`](../../../app/api/pgd/workflow-templates/[templateId]/retire/route.ts#L1)
- [`app/api/pgd/workflow-templates/[templateId]/revisions/route.ts:1`](../../../app/api/pgd/workflow-templates/[templateId]/revisions/route.ts#L1)
- [`components/PcnApprovalModal.tsx:17-82`](../../../components/PcnApprovalModal.tsx#L17)
- [`components/PcnDraftingWorkspaceView.tsx:835-856`](../../../components/PcnDraftingWorkspaceView.tsx#L835)
- [`utils/pcnDossierDocuments.ts:1-80`](../../../utils/pcnDossierDocuments.ts#L1)
- [`utils/pcnDossierInspection.ts:107-115`](../../../utils/pcnDossierInspection.ts#L107)
- [`utils/pcnWorkflowTemplate.ts:141-198`](../../../utils/pcnWorkflowTemplate.ts#L141)
- [`utils/pcnWorkflowTemplate.ts:45-110`](../../../utils/pcnWorkflowTemplate.ts#L45)
- [`utils/pgdWorkflow.ts:148-199`](../../../utils/pgdWorkflow.ts#L148)

## 06-samples-and-lab · PCN sample và tích hợp PTN

- [`app/api/pcn/integrations/lab-status-events/route.ts:1`](../../../app/api/pcn/integrations/lab-status-events/route.ts#L1)
- [`app/api/pcn/lab-requests/[requestId]/dispatch/route.ts:1`](../../../app/api/pcn/lab-requests/[requestId]/dispatch/route.ts#L1)
- [`app/api/pcn/lab-requests/[requestId]/reconcile/route.ts:1`](../../../app/api/pcn/lab-requests/[requestId]/reconcile/route.ts#L1)
- [`app/api/pcn/sample-request-bundles/[bundleId]/retry/[dispatchId]/route.ts:1`](../../../app/api/pcn/sample-request-bundles/[bundleId]/retry/[dispatchId]/route.ts#L1)
- [`app/api/pcn/sample-request-bundles/route.ts:1`](../../../app/api/pcn/sample-request-bundles/route.ts#L1)
- [`app/api/pcn/samples/routes/[routeId]/status/route.ts:1`](../../../app/api/pcn/samples/routes/[routeId]/status/route.ts#L1)
- [`app/api/pgd/lab-requests/route.ts:22-95`](../../../app/api/pgd/lab-requests/route.ts#L22)
- [`app/api/pgd/lab-result-reviews/route.ts:18-68`](../../../app/api/pgd/lab-result-reviews/route.ts#L18)
- [`app/api/pgd/lab-results/route.ts:21-86`](../../../app/api/pgd/lab-results/route.ts#L21)
- [`components/PgdDossierStepWorkPanel.tsx:48-106`](../../../components/PgdDossierStepWorkPanel.tsx#L48)
- [`utils/pcnLabIntegration.ts:245-339`](../../../utils/pcnLabIntegration.ts#L245)
- [`utils/pcnLabIntegration.ts:393-461`](../../../utils/pcnLabIntegration.ts#L393)
- [`utils/pcnSampleFlow.ts:86-142`](../../../utils/pcnSampleFlow.ts#L86)

## 07-pgd-evidence-approval-package · PGD · Evidence, review, ký và package

- [`app/api/pgd/approvals/route.ts:106-150`](../../../app/api/pgd/approvals/route.ts#L106)
- [`app/api/pgd/approvals/route.ts:117-130`](../../../app/api/pgd/approvals/route.ts#L117)
- [`app/api/pgd/approvals/route.ts:31-106`](../../../app/api/pgd/approvals/route.ts#L31)
- [`app/api/pgd/approvals/route.ts:69-87`](../../../app/api/pgd/approvals/route.ts#L69)
- [`app/api/pgd/requests/[requestId]/dossier-documents/route.ts:148-239`](../../../app/api/pgd/requests/[requestId]/dossier-documents/route.ts#L148)
- [`app/api/pgd/requests/[requestId]/package/route.ts:110-184`](../../../app/api/pgd/requests/[requestId]/package/route.ts#L110)
- [`utils/pgdDomain.ts:1133-1136`](../../../utils/pgdDomain.ts#L1133)
- [`utils/pgdDomain.ts:1475-1521`](../../../utils/pgdDomain.ts#L1475)
- [`utils/pgdDomain.ts:1694`](../../../utils/pgdDomain.ts#L1694)
- [`utils/pgdWorkflow.ts:148-199`](../../../utils/pgdWorkflow.ts#L148)
- [`utils/pgdWorkflow.ts:67-76`](../../../utils/pgdWorkflow.ts#L67)

## 08-auth-rbac · Đăng nhập, quyền và phạm vi

- [`app/api/auth/pcn-session/route.ts:1`](../../../app/api/auth/pcn-session/route.ts#L1)
- [`app/api/pcn/dossiers/[dossierId]/route.ts:217-310`](../../../app/api/pcn/dossiers/[dossierId]/route.ts#L217)
- [`app/api/pcn/dossiers/[dossierId]/route.ts:283-310`](../../../app/api/pcn/dossiers/[dossierId]/route.ts#L283)
- [`app/api/pgd/approvals/route.ts:31-67`](../../../app/api/pgd/approvals/route.ts#L31)
- [`components/PgdcnSidebar.tsx:194-240`](../../../components/PgdcnSidebar.tsx#L194)
- [`lib/server/auth.ts:1`](../../../lib/server/auth.ts#L1)
- [`utils/pcnDossierAssignment.ts:74-95`](../../../utils/pcnDossierAssignment.ts#L74)
- [`utils/pcnDossierStepAccess.ts:50-88`](../../../utils/pcnDossierStepAccess.ts#L50)
- [`utils/pcnRbac.ts:1-120`](../../../utils/pcnRbac.ts#L1)
- [`utils/pgdcnNavigation.ts:16-41`](../../../utils/pgdcnNavigation.ts#L16)
- [`utils/pgdcnNavigation.ts:61-77`](../../../utils/pgdcnNavigation.ts#L61)
- [`utils/pgdcnNavigation.ts:61-83`](../../../utils/pgdcnNavigation.ts#L61)
- [`utils/pgdWorkflow.ts:148-199`](../../../utils/pgdWorkflow.ts#L148)

## 09-ai-ocr · AI review và OCR hỗ trợ

- [`app/api/pcn/approval-assistant/review/route.ts:164-195`](../../../app/api/pcn/approval-assistant/review/route.ts#L164)
- [`app/api/pcn/dossiers/[dossierId]/documents/confirm-draft-output/route.ts:1`](../../../app/api/pcn/dossiers/[dossierId]/documents/confirm-draft-output/route.ts#L1)
- [`app/api/pcn/ocr/route.ts:118-125`](../../../app/api/pcn/ocr/route.ts#L118)
- [`app/api/pcn/ocr/route.ts:49-125`](../../../app/api/pcn/ocr/route.ts#L49)
- [`app/api/pcn/ocr/route.ts:49-95`](../../../app/api/pcn/ocr/route.ts#L49)
- [`app/api/pgd/approvals/route.ts:31-150`](../../../app/api/pgd/approvals/route.ts#L31)
- [`app/api/pgd/assistant/review/route.ts:123-154`](../../../app/api/pgd/assistant/review/route.ts#L123)
- [`app/api/pgd/assistant/review/route.ts:88-118`](../../../app/api/pgd/assistant/review/route.ts#L88)
- [`app/api/pgd/ocr/route.ts:107-114`](../../../app/api/pgd/ocr/route.ts#L107)
- [`app/api/pgd/ocr/route.ts:43-114`](../../../app/api/pgd/ocr/route.ts#L43)
- [`app/api/pgd/ocr/route.ts:43-88`](../../../app/api/pgd/ocr/route.ts#L43)
- [`components/PcnDraftingWorkspaceView.tsx:835-856`](../../../components/PcnDraftingWorkspaceView.tsx#L835)
- [`utils/pgdAssistant.ts:155-166`](../../../utils/pgdAssistant.ts#L155)
- [`utils/pgdAssistant.ts:268-296`](../../../utils/pgdAssistant.ts#L268)

## 10-system-architecture · Kiến trúc runtime và biên tích hợp

- [`app/api/health/route.ts:1`](../../../app/api/health/route.ts#L1)
- [`app/api/pcn/intake/route.ts:49-63`](../../../app/api/pcn/intake/route.ts#L49)
- [`app/api/pcn/ocr/route.ts:49-125`](../../../app/api/pcn/ocr/route.ts#L49)
- [`app/api/pgd/lab-results/route.ts:21-86`](../../../app/api/pgd/lab-results/route.ts#L21)
- [`app/api/pgd/ocr/route.ts:43-114`](../../../app/api/pgd/ocr/route.ts#L43)
- [`components/PgdcnAppShell.tsx:412-485`](../../../components/PgdcnAppShell.tsx#L412)
- [`docker-compose.yml:1-31`](../../../docker-compose.yml#L1)
- [`docker-compose.yml:7-24`](../../../docker-compose.yml#L7)
- [`Dockerfile:1-19`](../../../Dockerfile#L1)
- [`lib/server/activity-logs.ts:1`](../../../lib/server/activity-logs.ts#L1)
- [`lib/server/notifications.ts:1`](../../../lib/server/notifications.ts#L1)
- [`sql/pcn-schema.sql:115-131`](../../../sql/pcn-schema.sql#L115)
- [`sql/pcn-schema.sql:5-10`](../../../sql/pcn-schema.sql#L5)
- [`utils/pcnLabIntegration.ts:245-339`](../../../utils/pcnLabIntegration.ts#L245)
- [`utils/pcnWorkflowRuntime.ts:38-60`](../../../utils/pcnWorkflowRuntime.ts#L38)
- [`utils/pgdDomain.ts:1475-1521`](../../../utils/pgdDomain.ts#L1475)

## 11-data-lineage · Data lineage từ intake đến lưu trữ

- [`app/api/pcn/dossiers/[dossierId]/documents/route.ts:131-180`](../../../app/api/pcn/dossiers/[dossierId]/documents/route.ts#L131)
- [`app/api/pcn/intake/route.ts:154-247`](../../../app/api/pcn/intake/route.ts#L154)
- [`app/api/pcn/intake/route.ts:49-63`](../../../app/api/pcn/intake/route.ts#L49)
- [`app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts:1-210`](../../../app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts#L1)
- [`app/api/pcn/issuance/[issuanceId]/archive/route.ts:21-98`](../../../app/api/pcn/issuance/[issuanceId]/archive/route.ts#L21)
- [`app/api/pcn/issuance/[issuanceId]/deliver/route.ts:21-98`](../../../app/api/pcn/issuance/[issuanceId]/deliver/route.ts#L21)
- [`app/api/pcn/issuance/[issuanceId]/issue/route.ts:141-343`](../../../app/api/pcn/issuance/[issuanceId]/issue/route.ts#L141)
- [`app/api/pgd/approvals/route.ts:117-130`](../../../app/api/pgd/approvals/route.ts#L117)
- [`app/api/pgd/lab-result-reviews/route.ts:18-68`](../../../app/api/pgd/lab-result-reviews/route.ts#L18)
- [`app/api/pgd/lab-results/route.ts:21-86`](../../../app/api/pgd/lab-results/route.ts#L21)
- [`app/api/pgd/requests/[requestId]/dossier-documents/route.ts:148-214`](../../../app/api/pgd/requests/[requestId]/dossier-documents/route.ts#L148)
- [`app/api/pgd/requests/[requestId]/package/route.ts:145-184`](../../../app/api/pgd/requests/[requestId]/package/route.ts#L145)
- [`app/api/pgd/requests/route.ts:28-138`](../../../app/api/pgd/requests/route.ts#L28)
- [`app/api/pgd/requests/route.ts:81-114`](../../../app/api/pgd/requests/route.ts#L81)
- [`components/PgdDossierStepWorkPanel.tsx:48-106`](../../../components/PgdDossierStepWorkPanel.tsx#L48)
- [`utils/pcnLabIntegration.ts:245-339`](../../../utils/pcnLabIntegration.ts#L245)
- [`utils/pcnLabIntegration.ts:393-461`](../../../utils/pcnLabIntegration.ts#L393)
- [`utils/pcnSampleFlow.ts:86-142`](../../../utils/pcnSampleFlow.ts#L86)
- [`utils/pgdWorkflow.ts:67-76`](../../../utils/pgdWorkflow.ts#L67)

## 12-data-model-erd · ERD vật lý có khai báo trong SQL

- [`sql/pcn-schema.sql:115-131`](../../../sql/pcn-schema.sql#L115)
- [`sql/pcn-schema.sql:5-10`](../../../sql/pcn-schema.sql#L5)

## 13-audit-notifications · Activity log, audit và notification

- [`app/api/activity-logs/route.ts:1`](../../../app/api/activity-logs/route.ts#L1)
- [`app/api/activity-logs/summary/route.ts:1`](../../../app/api/activity-logs/summary/route.ts#L1)
- [`app/api/pcn/notifications/read-all/route.ts:1`](../../../app/api/pcn/notifications/read-all/route.ts#L1)
- [`app/api/pcn/notifications/route.ts:1`](../../../app/api/pcn/notifications/route.ts#L1)
- [`app/api/pgdcn/notifications/route.ts:1`](../../../app/api/pgdcn/notifications/route.ts#L1)
- [`components/ActivityLogView.tsx:1`](../../../components/ActivityLogView.tsx#L1)
- [`components/PgdcnNotificationDropdown.tsx:1`](../../../components/PgdcnNotificationDropdown.tsx#L1)
- [`sql/pcn-schema.sql:107-113`](../../../sql/pcn-schema.sql#L107)
- [`sql/pcn-schema.sql:13-29`](../../../sql/pcn-schema.sql#L13)
- [`sql/pcn-schema.sql:40-113`](../../../sql/pcn-schema.sql#L40)
- [`utils/pgdcnNotification.ts:1`](../../../utils/pgdcnNotification.ts#L1)
- [`utils/pgdcnNotificationApi.ts:1`](../../../utils/pgdcnNotificationApi.ts#L1)

## 14-customers-and-work-queues · Customer CRUD/import và work queues

- [`app/api/pcn/customer-import/apply/route.ts:1`](../../../app/api/pcn/customer-import/apply/route.ts#L1)
- [`app/api/pcn/customer-import/preview/route.ts:1`](../../../app/api/pcn/customer-import/preview/route.ts#L1)
- [`app/api/pcn/customers/[customerId]/route.ts:1`](../../../app/api/pcn/customers/[customerId]/route.ts#L1)
- [`app/api/pcn/customers/route.ts:1`](../../../app/api/pcn/customers/route.ts#L1)
- [`app/api/pgd/requests/route.ts:28-138`](../../../app/api/pgd/requests/route.ts#L28)
- [`components/PcnCustomersManagementView.tsx:1`](../../../components/PcnCustomersManagementView.tsx#L1)
- [`components/PcnOperationsRegisterView.tsx:1`](../../../components/PcnOperationsRegisterView.tsx#L1)
- [`components/PgdcnCustomersView.tsx:1`](../../../components/PgdcnCustomersView.tsx#L1)
- [`components/PgdcnDashboardView.tsx:14-30`](../../../components/PgdcnDashboardView.tsx#L14)
- [`components/PgdDossierStepWorkPanel.tsx:48-106`](../../../components/PgdDossierStepWorkPanel.tsx#L48)
- [`utils/pcnBusinessWorkspace.ts:1-80`](../../../utils/pcnBusinessWorkspace.ts#L1)
- [`utils/pcnCustomerImportContract.ts:1`](../../../utils/pcnCustomerImportContract.ts#L1)
- [`utils/pcnCustomerImportService.ts:1-86`](../../../utils/pcnCustomerImportService.ts#L1)
- [`utils/pcnCustomerImportService.ts:87-170`](../../../utils/pcnCustomerImportService.ts#L87)
- [`utils/pcnCustomerReconciliation.ts:1`](../../../utils/pcnCustomerReconciliation.ts#L1)

## 15-deployment-security · Deployment topology, health và secrets

- [`app/api/db/health/route.ts:1-20`](../../../app/api/db/health/route.ts#L1)
- [`app/api/health/route.ts:1-13`](../../../app/api/health/route.ts#L1)
- [`components/BackupRestoreAdminPanel.tsx:533-534`](../../../components/BackupRestoreAdminPanel.tsx#L533)
- [`docker-compose.yml:1-31`](../../../docker-compose.yml#L1)
- [`docker-compose.yml:15-24`](../../../docker-compose.yml#L15)
- [`docker-compose.yml:7-24`](../../../docker-compose.yml#L7)
- [`docker-compose.yml:9-21`](../../../docker-compose.yml#L9)
- [`Dockerfile:1-19`](../../../Dockerfile#L1)
- [`package.json:1-20`](../../../package.json#L1)
- [`utils/backupManager.ts:247-254`](../../../utils/backupManager.ts#L247)

## 16-sequence-pcn-create · Sequence · Tạo PCN dossier

- [`app/api/pcn/intake/route.ts:154-247`](../../../app/api/pcn/intake/route.ts#L154)
- [`app/api/pcn/intake/route.ts:283-301`](../../../app/api/pcn/intake/route.ts#L283)
- [`app/api/pcn/intake/route.ts:49-63`](../../../app/api/pcn/intake/route.ts#L49)
- [`components/PgdcnSidebar.tsx:194-215`](../../../components/PgdcnSidebar.tsx#L194)
- [`sql/pcn-schema.sql:5-10`](../../../sql/pcn-schema.sql#L5)
- [`utils/pcnWorkflowTemplate.ts:141-198`](../../../utils/pcnWorkflowTemplate.ts#L141)
- [`utils/pcnWorkflowTemplate.ts:45-110`](../../../utils/pcnWorkflowTemplate.ts#L45)

## 17-sequence-document-upload-attach · Sequence · Upload và attach DOCX

- [`app/api/pcn/dossiers/[dossierId]/documents/confirm-draft-output/route.ts:1`](../../../app/api/pcn/dossiers/[dossierId]/documents/confirm-draft-output/route.ts#L1)
- [`app/api/pcn/dossiers/[dossierId]/documents/confirm-generated/route.ts:1`](../../../app/api/pcn/dossiers/[dossierId]/documents/confirm-generated/route.ts#L1)
- [`app/api/pcn/dossiers/[dossierId]/documents/route.ts:131-203`](../../../app/api/pcn/dossiers/[dossierId]/documents/route.ts#L131)
- [`app/api/pcn/drafts/[draftId]/generate/route.ts:1`](../../../app/api/pcn/drafts/[draftId]/generate/route.ts#L1)
- [`components/PcnDraftingWorkspaceView.tsx:835-856`](../../../components/PcnDraftingWorkspaceView.tsx#L835)
- [`sql/pcn-schema.sql:115-131`](../../../sql/pcn-schema.sql#L115)
- [`sql/pcn-schema.sql:5-10`](../../../sql/pcn-schema.sql#L5)

## 18-sequence-pgd-pyc-kqtn · Sequence · PGD PYC đến KQTN

- [`app/api/pgd/lab-requests/route.ts:22-95`](../../../app/api/pgd/lab-requests/route.ts#L22)
- [`app/api/pgd/lab-result-reviews/route.ts:18-68`](../../../app/api/pgd/lab-result-reviews/route.ts#L18)
- [`app/api/pgd/lab-results/route.ts:21-86`](../../../app/api/pgd/lab-results/route.ts#L21)
- [`app/api/pgd/requests/route.ts:28-138`](../../../app/api/pgd/requests/route.ts#L28)
- [`components/PgdDossierStepWorkPanel.tsx:48-106`](../../../components/PgdDossierStepWorkPanel.tsx#L48)
- [`sql/pcn-schema.sql:5-10`](../../../sql/pcn-schema.sql#L5)

## 19-sequence-pcn-approval-release · Sequence · PCN phê duyệt và release

- [`app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts:1-210`](../../../app/api/pcn/issuance/[issuanceId]/approval/[stepId]/route.ts#L1)
- [`app/api/pcn/issuance/[issuanceId]/archive/route.ts:21-98`](../../../app/api/pcn/issuance/[issuanceId]/archive/route.ts#L21)
- [`app/api/pcn/issuance/[issuanceId]/deliver/route.ts:21-98`](../../../app/api/pcn/issuance/[issuanceId]/deliver/route.ts#L21)
- [`app/api/pcn/issuance/[issuanceId]/issue/route.ts:141-343`](../../../app/api/pcn/issuance/[issuanceId]/issue/route.ts#L141)
- [`sql/pcn-schema.sql:5-10`](../../../sql/pcn-schema.sql#L5)
