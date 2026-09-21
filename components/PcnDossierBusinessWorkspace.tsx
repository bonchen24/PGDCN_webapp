'use client';

import React from 'react';
import type { ActivityLog, CertificationDossier, CertificationProposal, IssuancePackage, OutboundLabRequest, PcnApprovalStep, PcnDocumentRequirement, PcnDossierDocument, PcnGeneratedDocumentKind, PcnSampleItem, PcnSampleLot, PcnSampleRoute, PcnUserAccount, ReturnedTestResult } from '../types';
import { activityEntityLabels } from '../utils/activityLog';
import { buildPcnDossierInspection } from '../utils/pcnDossierInspection';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { getPcnActorDisplayName, getPcnUserDisplayName } from '../utils/pcnUserIdentity';
import { getPcnDossierStatusLabel } from '../utils/pcnWorkflow';
import PgdcnDossierBusinessWorkspace, { type DossierBlocker, type DossierEvidenceGroup, type DossierSuggestedAction } from './PgdcnDossierBusinessWorkspace';

function outcomeLabel(outcome: ReturnedTestResult['outcome']): string {
  return outcome === 'PASS' ? 'Đạt' : outcome === 'FAIL' ? 'Không đạt' : 'Đang chờ';
}

const PCN_EVIDENCE_GROUP_LABELS: Record<string, string> = {
  INTAKE: 'Đề nghị · thương mại · phân công',
  LAB_ROUTING: 'Mẫu · bàn giao PTN',
  TECHNICAL_REVIEW: 'KQTN · xem xét kỹ thuật',
  ISSUANCE: 'Chứng nhận · quyết định',
  DELIVERY: 'Bàn giao khách hàng',
  ARCHIVE: 'Lưu trữ',
};

function buildPcnEvidenceGroups(requirements: PcnDocumentRequirement[], documents: PcnDossierDocument[], waivers: CertificationDossier['documentWaivers'], onOpenTab: (tab: 'overview' | 'documents' | 'lab' | 'issuance') => void): DossierEvidenceGroup[] {
  const groups = new Map<string, DossierEvidenceGroup>();
  const orderedStages = ['INTAKE', 'LAB_ROUTING', 'TECHNICAL_REVIEW', 'ISSUANCE', 'DELIVERY', 'ARCHIVE'];
  for (const requirement of [...requirements].sort((left, right) => left.sortOrder - right.sortOrder)) {
    const stage = requirement.stages[0] || 'INTAKE';
    const document = documents.find((item) => item.requirementId === requirement.id);
    const waiver = waivers?.[requirement.id];
    const currentVersion = document?.versions.find((version) => version.assetId === document.currentVersionId) || document?.versions[document.versions.length - 1];
    const present = document?.status === 'PRESENT';
    const state = waiver ? 'Được miễn' : present ? 'Có bản hiện hành' : requirement.required ? 'Thiếu bắt buộc' : 'Chưa có';
    const stateTone = waiver || present ? 'success' as const : requirement.required ? 'danger' as const : 'neutral' as const;
    const action = stage === 'INTAKE'
      ? { actionLabel: 'Mở tài liệu', onAction: () => onOpenTab('documents') }
      : stage === 'LAB_ROUTING'
        ? { actionLabel: 'Mở mẫu & PYC', onAction: () => onOpenTab('lab') }
        : { actionLabel: 'Mở phát hành', onAction: () => onOpenTab('issuance') };
    const group = groups.get(stage) || { id: stage.toLowerCase(), title: PCN_EVIDENCE_GROUP_LABELS[stage] || stage, ...action, rows: [] };
    group.rows.push({
      id: requirement.id,
      code: requirement.code,
      title: requirement.name,
      state,
      stateTone,
      meta: requirement.required ? 'Bắt buộc' : 'Không bắt buộc',
      detail: currentVersion?.fileName || (present ? 'Có bản ghi tài liệu nhưng chưa có tên file hiện hành.' : requirement.description || 'Chưa có tài liệu hiện hành.'),
    });
    groups.set(stage, group);
  }
  return orderedStages.filter((stage) => groups.has(stage)).map((stage) => groups.get(stage)!);
}

export type PcnDossierBusinessWorkspaceProps = {
  dossier: CertificationDossier;
  proposal?: CertificationProposal;
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  labRequests: OutboundLabRequest[];
  results: ReturnedTestResult[];
  approvalSteps: PcnApprovalStep[];
  issuance?: IssuancePackage;
  sampleLots: PcnSampleLot[];
  sampleItems?: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  activityLogs: ActivityLog[];
  users: PcnUserAccount[];
  ownerLabel: string;
  currentStationKey: string;
  currentStationTitle: string;
  missingRequiredCount: number;
  missingRequiredSummary: string;
  onOpenCurrentStep: () => void;
  onOpenTab: (tab: 'overview' | 'documents' | 'lab' | 'issuance') => void;
  onOpenDocumentOutput?: (kind: PcnGeneratedDocumentKind) => void;
};

export function PcnDossierBusinessWorkspace({
  dossier,
  proposal,
  requirements,
  documents,
  labRequests,
  results,
  approvalSteps,
  issuance,
  sampleLots,
  sampleRoutes,
  activityLogs,
  users,
  ownerLabel,
  currentStationKey,
  currentStationTitle,
  missingRequiredCount,
  missingRequiredSummary,
  onOpenCurrentStep,
  onOpenTab,
  onOpenDocumentOutput,
}: PcnDossierBusinessWorkspaceProps) {
  const customerSnapshot = getPcnDossierCustomerSnapshot(dossier, proposal);
  const inspection = buildPcnDossierInspection({
    dossierId: dossier.id,
    fieldCodes: dossier.fieldCodes,
    requirements,
    documents,
    documentWaivers: dossier.documentWaivers,
    compact: true,
  });
  const commercialRequirements = requirements.filter((requirement) => /(hợp đồng|hóa đơn|invoice|packing|vận đơn|bill|c\/o|tờ khai)/i.test(requirement.name));
  const openLabRequests = labRequests.filter((request) => !['RESULT_RETURNED', 'CANCELLED'].includes(request.status));
  const businessBlockers: DossierBlocker[] = [];
  if (missingRequiredCount > 0) businessBlockers.push({ id: 'pcn-required-documents', title: 'Thiếu tài liệu bắt buộc', reason: missingRequiredSummary || ('Còn ' + missingRequiredCount + ' tài liệu bắt buộc chưa hợp lệ.'), actionLabel: 'Mở checklist', onAction: () => onOpenTab('documents') });
  if (openLabRequests.length > 0) businessBlockers.push({ id: 'pcn-open-lab-requests', title: 'PYC PTN chưa hoàn tất', reason: openLabRequests.length + ' PYC PTN còn đang chờ bàn giao, tiếp nhận hoặc trả kết quả.', actionLabel: 'Mở mẫu & PYC', onAction: () => onOpenTab('lab') });
  if (!dossier.ownerUsername && ['ASSIGNMENT', 'EVALUATION', 'TECHNICAL_REVIEW'].includes(currentStationKey)) businessBlockers.push({ id: 'pcn-owner-missing', title: 'Chưa có chủ hồ sơ', reason: 'Cần phân công người chịu trách nhiệm trước khi xử lý tiếp bước hiện tại.', actionLabel: 'Mở bước hiện tại', onAction: onOpenCurrentStep });


  const contextualActions: DossierSuggestedAction[] = [];
  if (missingRequiredCount > 0) contextualActions.push({
    id: 'pcn-review-before-technical-review',
    title: 'Kiểm tra trước khi thẩm xét',
    reason: 'Còn ' + missingRequiredCount + ' tài liệu bắt buộc cần xác nhận trong checklist.',
    actionLabel: 'Mở checklist',
    onAction: () => onOpenTab('documents'),
    tone: 'warning',
  });
  if (sampleLots.length > 0 && labRequests.length === 0) contextualActions.push({
    id: 'pcn-create-lab-request',
    title: 'Lập PYC PTN từ lô mẫu',
    reason: sampleLots.length + ' lô mẫu đã có nhưng chưa gắn PYC PTN.',
    actionLabel: onOpenDocumentOutput ? 'Sinh PYC PTN' : 'Mở mẫu & PYC',
    onAction: onOpenDocumentOutput ? () => onOpenDocumentOutput('LAB_REQUEST') : () => onOpenTab('lab'),
    tone: 'info',
  });
  if (results.length > 0 && !issuance) contextualActions.push({
    id: 'pcn-draft-evaluation-report',
    title: 'Soạn dự thảo báo cáo đánh giá',
    reason: results.length + ' KQTN đã có trong hồ sơ; có thể mở context sinh báo cáo để người dùng soát xét.',
    actionLabel: onOpenDocumentOutput ? 'Sinh báo cáo' : 'Mở phát hành',
    onAction: onOpenDocumentOutput ? () => onOpenDocumentOutput('EVALUATION_REPORT') : () => onOpenTab('issuance'),
    tone: 'success',
  });
  return <PgdcnDossierBusinessWorkspace
    domain="PCN"
    title="Bản đồ bộ hồ sơ PCN"
    description="Từ Đề nghị và chứng từ đầu vào đến mẫu, KQTN, xem xét, phê duyệt và phát hành; mỗi nhóm chỉ là projection của dữ liệu đang có."
    nextAction={{
      title: currentStationTitle,
      reason: missingRequiredCount > 0 ? 'Bước hiện tại còn bằng chứng hồ sơ chưa hợp lệ.' : 'Đây là vùng công việc được xác định bởi trạng thái hồ sơ hiện tại.',
      owner: ownerLabel,
      missing: missingRequiredCount > 0 ? missingRequiredCount + ' tài liệu bắt buộc' : 'Chưa ghi nhận thiếu hụt cứng',
      actionLabel: 'Mở việc cần làm',
      onAction: onOpenCurrentStep,
    }}
    metrics={[
      { id: 'pcn-documents', label: 'Tài liệu bắt buộc', value: inspection.summary.present + '/' + inspection.summary.requiredTotal, tone: missingRequiredCount > 0 ? 'warning' : 'success' },
      { id: 'pcn-samples', label: 'Lô mẫu', value: sampleLots.length, tone: sampleLots.length > 0 ? 'info' : 'neutral' },
      { id: 'pcn-lab-requests', label: 'PYC PTN', value: labRequests.length, tone: labRequests.length > 0 ? 'info' : 'neutral' },
      { id: 'pcn-results', label: 'KQTN', value: results.length, tone: results.length > 0 ? 'success' : 'neutral' },
    ]}
    blockers={businessBlockers}
    suggestedActions={contextualActions}
    evidenceTracker={{
      title: 'Evidence Tracker · bộ chứng từ hiện hành',
      groups: buildPcnEvidenceGroups(requirements, documents, dossier.documentWaivers, onOpenTab),
      emptyText: 'Chưa có checklist chứng từ trong hồ sơ này.',
    }}
    groups={[
      { id: 'pcn-request', title: '1. Đề nghị / khách hàng', description: 'Đầu vào nghiệp vụ, khách hàng, sản phẩm và phạm vi chứng nhận.', status: proposal ? 'DONE' : 'BLOCKED', statusLabel: proposal ? 'Đã nhận diện' : 'Thiếu đầu vào', countLabel: proposal ? '1 Đề nghị' : 'Chưa có Đề nghị', meta: customerSnapshot?.name || 'Chưa gắn khách hàng', actionLabel: 'Xem tổng quan', onAction: () => onOpenTab('overview') },
      { id: 'pcn-commercial', title: '2. Hàng hóa / thương mại', description: 'Hợp đồng, hóa đơn, packing list, vận đơn và bằng chứng gắn với lô hàng.', status: commercialRequirements.length === 0 ? 'NOT_STARTED' : missingRequiredCount > 0 ? 'IN_PROGRESS' : 'DONE', statusLabel: commercialRequirements.length === 0 ? 'Chưa định tuyến' : missingRequiredCount > 0 ? 'Đang rà soát' : 'Đã đủ theo checklist', countLabel: commercialRequirements.length + ' mục định tuyến', meta: 'Tách dữ liệu cấu trúc khỏi tệp hồ sơ', actionLabel: 'Mở tài liệu', onAction: () => onOpenTab('documents') },
      { id: 'pcn-field', title: '3. Đánh giá hiện trường', description: 'Kế hoạch, phân công, biểu mẫu hiện trường và bằng chứng đánh giá.', status: dossier.operationalForms && Object.keys(dossier.operationalForms).length > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: dossier.operationalForms && Object.keys(dossier.operationalForms).length > 0 ? 'Có dữ liệu' : 'Chưa ghi nhận', countLabel: (dossier.operationalForms ? Object.keys(dossier.operationalForms).length : 0) + ' biểu mẫu', meta: ownerLabel, actionLabel: 'Mở bước hiện tại', onAction: onOpenCurrentStep },
      { id: 'pcn-testing', title: '4. Mẫu & thử nghiệm', description: 'Entity mẫu, tuyến PTN, bàn giao, kết quả và vị trí hiện tại.', status: results.length > 0 ? 'DONE' : labRequests.length > 0 || sampleLots.length > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: results.length > 0 ? 'Có KQTN' : labRequests.length > 0 || sampleLots.length > 0 ? 'Đang xử lý' : 'Chưa có mẫu', countLabel: sampleLots.length + ' lô · ' + labRequests.length + ' PYC · ' + results.length + ' KQTN', meta: openLabRequests.length > 0 ? openLabRequests.length + ' PYC đang mở' : 'Không có PYC đang mở', actionLabel: 'Mở mẫu & PYC', onAction: () => onOpenTab('lab') },
      { id: 'pcn-review', title: '5. Xem xét kỹ thuật', description: 'Kết luận, người soát xét, các bước phê duyệt chuyên môn và lịch sử xử lý.', status: approvalSteps.length > 0 || dossier.reviewerUsername ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: approvalSteps.some((step) => step.status === 'APPROVED') ? 'Đã có phê duyệt' : dossier.reviewerUsername ? 'Đã phân công' : 'Chưa phân công', countLabel: approvalSteps.length + ' bước phê duyệt', meta: dossier.reviewerUsername ? getPcnUserDisplayName(dossier.reviewerUsername, users) : 'Chưa có người soát xét', actionLabel: 'Mở vùng phê duyệt', onAction: () => onOpenTab('issuance') },
      { id: 'pcn-issuance', title: '6. Phê duyệt & phát hành', description: 'Bộ trình duyệt, ký, cấp số, giao và lưu trữ chứng thư/quyết định.', status: issuance ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: issuance ? 'Có gói phát hành' : 'Chưa lập gói', countLabel: issuance ? '1 gói phát hành' : 'Chưa có gói phát hành', meta: issuance ? 'Trạng thái ' + issuance.status : 'Theo dõi từ bước hiện tại', actionLabel: 'Mở phát hành', onAction: () => onOpenTab('issuance') },
    ]}
    sampleTracker={{
      title: 'Sample Tracker · lô và tuyến PTN',
      rows: sampleLots.map((lot) => {
        const routes = sampleRoutes.filter((route) => lot.routeIds.includes(route.id));
        return { id: lot.id, code: lot.lotCode, title: lot.sampleName + ' · ' + lot.quantity + ' ' + (lot.unit || ''), state: lot.currentLocation || lot.status, stateTone: lot.status === 'ISSUE' ? 'danger' : lot.status === 'CLOSED' ? 'success' : routes.length > 0 ? 'info' : 'neutral', meta: routes.length + ' tuyến PTN' + (lot.model ? ' · Model ' + lot.model : ''), detail: lot.notes };
      }),
      emptyText: 'Chưa có lô mẫu được ghi nhận cho hồ sơ này.',
    }}
    testTracker={{
      title: 'Test Tracker · PYC và KQTN',
      rows: labRequests.map((labRequest) => {
        const result = results.find((item) => item.labRequestId === labRequest.id);
        return { id: labRequest.id, code: labRequest.pycNumber, title: labRequest.laboratoryName, state: result ? 'Đã nhận KQTN' : labRequest.status, stateTone: result?.outcome === 'FAIL' ? 'danger' : result?.outcome === 'PASS' ? 'success' : result ? 'info' : 'warning', meta: labRequest.fieldCode + ' · ' + (result?.reportNumber || 'Chưa có số phiếu'), detail: result ? 'Kết quả: ' + outcomeLabel(result.outcome) : 'Đang chờ hoàn tất chuỗi bàn giao → PTN → trả KQTN.' };
      }),
      emptyText: 'Chưa có PYC PTN liên kết với hồ sơ này.',
    }}
    timeline={{
      title: 'Work Log · lịch sử hồ sơ',
      items: activityLogs.map((log) => ({ id: log.id, title: log.summary, occurredAt: log.createdAt, actor: getPcnActorDisplayName(log.actorName, log.actorUsername, users), detail: log.entityLabel ? activityEntityLabels[log.entityType] + ' · ' + log.entityLabel : activityEntityLabels[log.entityType], tone: log.action === 'CREATED' ? 'success' : 'info' })),
      emptyText: 'Chưa có activity log liên kết với hồ sơ này.',
    }}
  />;
}

export default PcnDossierBusinessWorkspace;
