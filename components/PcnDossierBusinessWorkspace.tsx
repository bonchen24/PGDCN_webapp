'use client';

import React from 'react';
import type { ActivityLog, CertificationDossier, CertificationProposal, IssuancePackage, OutboundLabRequest, PcnApprovalStep, PcnDocumentRequirement, PcnDossierDocument, PcnGeneratedDocumentKind, PcnSampleItem, PcnSampleLot, PcnSampleRoute, PcnUserAccount, ReturnedTestResult } from '../types';
import { activityEntityLabels } from '../utils/activityLog';
import { buildPcnDossierInspection } from '../utils/pcnDossierInspection';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { getPcnActorDisplayName, getPcnUserDisplayName } from '../utils/pcnUserIdentity';
import { getPcnDossierStatusLabel } from '../utils/pcnWorkflow';
import { buildPcnBusinessBlockers, buildPcnSampleEvidence, buildPcnSectionCompleteness, buildPcnTestEvidence, getPcnBusinessSectionForRequirement, PCN_BUSINESS_SECTION_LABELS, resolvePcnEvidenceNextAction, type PcnBusinessFacts, type PcnBusinessSectionKey } from '../utils/pcnBusinessWorkspace';
import PgdcnDossierBusinessWorkspace, { type DossierBlocker, type DossierEvidenceGroup, type DossierSuggestedAction } from './PgdcnDossierBusinessWorkspace';

function outcomeLabel(outcome: ReturnedTestResult['outcome']): string {
  return outcome === 'PASS' ? 'Đạt' : outcome === 'FAIL' ? 'Không đạt' : 'Đang chờ';
}

const PCN_EVIDENCE_GROUP_LABELS: Record<string, string> = {
  INTAKE: 'Yêu cầu & phân công',
  LAB_ROUTING: 'Mẫu & thử nghiệm',
  TECHNICAL_REVIEW: 'Xem xét / thẩm xét',
  ISSUANCE: 'Cấp chứng nhận',
  DELIVERY: 'Bàn giao khách hàng',
  ARCHIVE: 'Lưu trữ',
};

function buildPcnEvidenceGroups(requirements: PcnDocumentRequirement[], documents: PcnDossierDocument[], waivers: CertificationDossier['documentWaivers'], onOpenTab: (tab: 'overview' | 'documents' | 'lab' | 'issuance') => void): DossierEvidenceGroup[] {
  const groups = new Map<PcnBusinessSectionKey, DossierEvidenceGroup>();
  const orderedSections: PcnBusinessSectionKey[] = ['REQUEST', 'COMMERCIAL', 'FIELD', 'LAB', 'REVIEW', 'ISSUANCE', 'DELIVERY', 'ARCHIVE'];
  for (const requirement of [...requirements].sort((left, right) => left.sortOrder - right.sortOrder)) {
    const section = getPcnBusinessSectionForRequirement(requirement);
    const document = documents.find((item) => item.requirementId === requirement.id);
    const waiver = waivers?.[requirement.id];
    const currentVersion = document?.versions.find((version) => version.assetId === document.currentVersionId) || document?.versions[document.versions.length - 1];
    const present = document?.status === 'PRESENT';
    const state = waiver ? 'Được miễn' : present ? 'Có bản hiện hành' : requirement.required ? 'Thiếu bắt buộc' : 'Chưa có';
    const stateTone = waiver || present ? 'success' as const : requirement.required ? 'danger' as const : 'neutral' as const;
    const action = section === 'LAB' || section === 'FIELD'
      ? { actionLabel: section === 'LAB' ? 'Mở mẫu & PYC' : 'Mở bước hiện tại', onAction: () => section === 'LAB' ? onOpenTab('lab') : onOpenTab('overview') }
      : section === 'ISSUANCE' || section === 'DELIVERY' || section === 'ARCHIVE'
        ? { actionLabel: 'Mở phát hành', onAction: () => onOpenTab('issuance') }
        : { actionLabel: 'Mở tài liệu', onAction: () => onOpenTab('documents') };
    const group = groups.get(section) || { id: section.toLowerCase(), title: PCN_BUSINESS_SECTION_LABELS[section], ...action, rows: [] };
    group.rows.push({
      id: requirement.id,
      code: requirement.code,
      title: requirement.name,
      state,
      stateTone,
      meta: requirement.required ? 'Bắt buộc' : 'Không bắt buộc',
      detail: currentVersion?.fileName || (present ? 'Có bản ghi tài liệu nhưng chưa có tên file hiện hành.' : waiver ? waivers?.[requirement.id]?.reason : requirement.description || 'Chưa có tài liệu hiện hành.'),
    });
    groups.set(section, group);
  }
  return orderedSections.map((section) => groups.get(section) || { id: section.toLowerCase(), title: PCN_BUSINESS_SECTION_LABELS[section], rows: [], actionLabel: 'Mở tài liệu', onAction: () => onOpenTab(section === 'LAB' || section === 'FIELD' ? 'lab' : section === 'ISSUANCE' || section === 'DELIVERY' || section === 'ARCHIVE' ? 'issuance' : 'documents') }).filter((group) => group.rows.length > 0);
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
  showTimeline?: boolean;
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
  sampleItems = [],
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
  showTimeline = true,
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
  const pcnFacts: PcnBusinessFacts = {
    dossier,
    proposal,
    requirements,
    documents,
    sampleLots,
    sampleItems,
    sampleRoutes,
    labRequests,
    results,
    approvalSteps,
    issuance,
    hasEvaluationReport: documents.some((document) => {
      const requirement = requirements.find((candidate) => candidate.id === document.requirementId);
      return requirement?.code === 'TEST_REPORT' && document.status === 'PRESENT';
    }),
  };
  const sections = buildPcnSectionCompleteness(pcnFacts);
  const sampleEvidence = buildPcnSampleEvidence(pcnFacts);
  const testEvidence = buildPcnTestEvidence(pcnFacts);
  const evidenceBlockers = buildPcnBusinessBlockers(pcnFacts);
  const evidenceNextAction = resolvePcnEvidenceNextAction(pcnFacts);
  const section = (key: PcnBusinessSectionKey) => sections.find((candidate) => candidate.key === key)!;
  const openTarget = (target: string) => target === 'DOCUMENTS' ? onOpenTab('documents') : target === 'LAB' ? onOpenTab('lab') : target === 'ISSUANCE' || target === 'DELIVERY' || target === 'ARCHIVE' ? onOpenTab('issuance') : onOpenCurrentStep;
  const blockers: DossierBlocker[] = evidenceBlockers.map((blocker) => ({
    id: blocker.id,
    title: blocker.title,
    reason: blocker.reason,
    severity: blocker.severity,
    source: blocker.source,
    target: blocker.target,
    actionLabel: blocker.target === 'DOCUMENTS' ? 'Mở danh sách tài liệu' : blocker.target === 'LAB' ? 'Mở mẫu & PYC' : blocker.target === 'REVIEW' ? 'Mở xem xét' : 'Mở việc hiện tại',
    onAction: () => openTarget(blocker.target),
  }));
  const contextualActions: DossierSuggestedAction[] = [
    ...(evidenceBlockers.some((blocker) => blocker.target === 'DOCUMENTS') ? [{
      id: 'pcn-missing-documents',
      title: 'Hồ sơ còn thiếu',
      reason: 'Kiểm tra các yêu cầu bắt buộc chưa có bản hiện hành hoặc miễn lệ.',
      actionLabel: 'Mở danh sách tài liệu',
      onAction: () => onOpenTab('documents'),
      tone: 'warning' as const,
    }] : []),
    ...(sampleEvidence.rows.length > 0 ? [{
      id: 'pcn-check-before-review',
      title: 'Kiểm tra trước thẩm xét',
      reason: 'Đối chiếu sample item, tuyến PYC và KQTN hiện hành trước khi kết luận.',
      actionLabel: 'Mở mẫu & PYC',
      onAction: () => onOpenTab('lab'),
      tone: 'info' as const,
    }] : []),
    ...(sampleEvidence.pendingResultCount > 0 ? [{
      id: 'pcn-missing-results',
      title: 'KQTN còn thiếu',
      reason: sampleEvidence.pendingResultCount + ' sample item chưa có đủ kết quả trả về.',
      actionLabel: 'Mở KQTN',
      onAction: () => onOpenTab('lab'),
      tone: 'warning' as const,
    }] : []),
    ...(sampleEvidence.resultCount > 0 ? [{
      id: 'pcn-evidence-summary',
      title: 'Tóm tắt hồ sơ',
      reason: sampleEvidence.resultCount + ' KQTN đã liên kết với ' + sampleEvidence.sampledSampleCount + ' sample item.',
      actionLabel: 'Mở tổng quan',
      onAction: () => onOpenTab('overview'),
      tone: 'success' as const,
    }] : []),
    ...(sampleEvidence.resultCount > 0 && onOpenDocumentOutput && !pcnFacts.hasEvaluationReport ? [{
      id: 'pcn-open-report',
      title: 'Mở soạn báo cáo',
      reason: 'KQTN đã có nhưng chưa có bản báo cáo đánh giá hiện hành.',
      actionLabel: 'Sinh báo cáo',
      onAction: () => onOpenDocumentOutput('EVALUATION_REPORT'),
      tone: 'success' as const,
    }] : []),
  ];
  const testingStatus = sampleEvidence.pendingResultCount > 0 ? 'IN_PROGRESS' : sampleEvidence.resultCount > 0 ? 'DONE' : sampleEvidence.sampledSampleCount > 0 ? 'IN_PROGRESS' : section('LAB').status;
  const testingStatusLabel = sampleEvidence.pendingResultCount > 0 ? 'Còn thiếu KQTN' : sampleEvidence.resultCount > 0 ? 'Đã có KQTN' : sampleEvidence.sampledSampleCount > 0 ? 'Đang xử lý' : 'Chưa có mẫu';
  return <PgdcnDossierBusinessWorkspace
    domain="PCN"
    title="Bản đồ bộ hồ sơ PCN"
    description="Ngữ cảnh → Hành động tiếp theo → Trở ngại → Dữ liệu hỗ trợ → Chi tiết; mỗi vùng là dữ liệu tổng hợp của thực thể hiện hành."
    nextAction={{
      title: evidenceNextAction.label,
      reason: evidenceNextAction.reason,
      owner: ownerLabel,
      missing: evidenceNextAction.relatedEntityIds.length > 0 ? evidenceNextAction.relatedEntityIds.length + ' bằng chứng liên quan' : missingRequiredCount > 0 ? missingRequiredSummary || missingRequiredCount + ' yêu cầu bắt buộc' : 'Chưa ghi nhận thiếu hụt cứng',
      actionLabel: 'Mở việc cần làm',
      onAction: () => openTarget(evidenceNextAction.target),
    }}
    metrics={[
      { id: 'pcn-documents', label: 'Tài liệu bắt buộc', value: inspection.summary.present + '/' + inspection.summary.requiredTotal, tone: evidenceBlockers.some((blocker) => blocker.target === 'DOCUMENTS') ? 'warning' : 'success' },
      { id: 'pcn-sample-items', label: 'Sample item', value: sampleEvidence.sampledSampleCount, tone: sampleEvidence.sampledSampleCount > 0 ? 'info' : 'neutral' },
      { id: 'pcn-lab-requests', label: 'PYC PTN', value: sampleEvidence.labRequestCount, tone: sampleEvidence.labRequestCount > 0 ? 'info' : 'neutral' },
      { id: 'pcn-results', label: 'KQTN', value: sampleEvidence.resultCount + '/' + sampleEvidence.labRequestCount, tone: sampleEvidence.pendingResultCount > 0 ? 'warning' : sampleEvidence.resultCount > 0 ? 'success' : 'neutral' },
    ]}
    blockers={blockers}
    suggestedActions={contextualActions}
    evidenceTracker={{
      title: 'Evidence Tracker · theo nhóm nghiệp vụ',
      groups: buildPcnEvidenceGroups(requirements, documents, dossier.documentWaivers, onOpenTab),
      emptyText: 'Chưa có danh mục chứng từ trong hồ sơ này.',
    }}
    groups={[
      { id: 'pcn-request', title: '1. ' + PCN_BUSINESS_SECTION_LABELS.REQUEST, description: 'Đề nghị, phân công và dữ liệu đầu vào để xác định chủ hồ sơ.', status: proposal ? section('REQUEST').status : 'BLOCKED', statusLabel: proposal ? section('REQUEST').reason : 'Thiếu Đề nghị', countLabel: proposal ? '1 Đề nghị' : 'Chưa có Đề nghị', meta: customerSnapshot?.name || 'Chưa gắn khách hàng', actionLabel: 'Xem tổng quan', onAction: () => onOpenTab('overview') },
      { id: 'pcn-commercial', title: '2. ' + PCN_BUSINESS_SECTION_LABELS.COMMERCIAL, description: 'Chứng từ thương mại/hải quan và tài liệu gắn với lô hàng.', status: section('COMMERCIAL').status, statusLabel: section('COMMERCIAL').reason, countLabel: section('COMMERCIAL').presentRequirements + '/' + section('COMMERCIAL').totalRequirements + ' mục', meta: 'Taxonomy requirement hiện hành', actionLabel: 'Mở tài liệu', onAction: () => onOpenTab('documents') },
      { id: 'pcn-field', title: '3. ' + PCN_BUSINESS_SECTION_LABELS.FIELD, description: 'Kế hoạch, phân công và bằng chứng đánh giá tại hiện trường.', status: section('FIELD').status, statusLabel: section('FIELD').reason, countLabel: section('FIELD').presentRequirements + '/' + section('FIELD').totalRequirements + ' yêu cầu', meta: currentStationKey + ' · ' + ownerLabel, actionLabel: 'Mở bước hiện tại', onAction: onOpenCurrentStep },
      { id: 'pcn-testing', title: '4. ' + PCN_BUSINESS_SECTION_LABELS.LAB, description: 'Sample item → route → PYC → PTN → KQTN theo từng mẫu.', status: testingStatus, statusLabel: testingStatusLabel, countLabel: sampleEvidence.sampledSampleCount + ' mẫu · ' + sampleEvidence.labRequestCount + ' PYC · ' + sampleEvidence.resultCount + ' KQTN', meta: sampleEvidence.pendingResultCount > 0 ? sampleEvidence.pendingResultCount + ' mẫu còn thiếu KQTN' : section('LAB').reason, actionLabel: 'Mở mẫu & PYC', onAction: () => onOpenTab('lab') },
      { id: 'pcn-review', title: '5. ' + PCN_BUSINESS_SECTION_LABELS.REVIEW, description: 'Kết luận KQTN, người soát xét, phê duyệt chuyên môn và lịch sử xử lý.', status: section('REVIEW').status, statusLabel: evidenceNextAction.key === 'REVIEW' ? 'Cần đánh giá' : section('REVIEW').reason, countLabel: sampleEvidence.resultCount + ' KQTN · ' + approvalSteps.length + ' bước phê duyệt', meta: dossier.reviewerUsername ? getPcnUserDisplayName(dossier.reviewerUsername, users) : 'Chưa có người soát xét', actionLabel: 'Mở vùng phê duyệt', onAction: () => onOpenTab('issuance') },
      { id: 'pcn-issuance', title: '6. ' + PCN_BUSINESS_SECTION_LABELS.ISSUANCE, description: 'Gói chứng nhận, quyết định, ký và cấp số.', status: section('ISSUANCE').status === 'DONE' || issuance ? 'IN_PROGRESS' : section('ISSUANCE').status, statusLabel: issuance ? 'Có gói phát hành' : section('ISSUANCE').reason, countLabel: issuance ? '1 gói phát hành' : section('ISSUANCE').totalRequirements + ' yêu cầu', meta: issuance ? 'Trạng thái ' + issuance.status : 'Theo dõi từ bước hiện tại', actionLabel: 'Mở phát hành', onAction: () => onOpenTab('issuance') },
      { id: 'pcn-delivery', title: '7. ' + PCN_BUSINESS_SECTION_LABELS.DELIVERY, description: 'Bộ hồ sơ bàn giao khách hàng sau khi phát hành.', status: section('DELIVERY').status, statusLabel: section('DELIVERY').reason, countLabel: section('DELIVERY').presentRequirements + '/' + section('DELIVERY').totalRequirements + ' yêu cầu', meta: 'Chỉ hiện khi có requirement tương ứng', actionLabel: 'Mở phát hành', onAction: () => onOpenTab('issuance') },
      { id: 'pcn-archive', title: '8. ' + PCN_BUSINESS_SECTION_LABELS.ARCHIVE, description: 'Bằng chứng lưu trữ và hoàn tất hồ sơ.', status: section('ARCHIVE').status, statusLabel: section('ARCHIVE').reason, countLabel: section('ARCHIVE').presentRequirements + '/' + section('ARCHIVE').totalRequirements + ' yêu cầu', meta: 'Chỉ hiện khi có evidence tương ứng', actionLabel: 'Mở phát hành', onAction: () => onOpenTab('issuance') },
    ]}
    sampleTracker={{
      title: 'Sample Tracker · sample item và tuyến PTN',
      rows: sampleEvidence.rows.map((row) => ({
        id: row.id,
        code: row.sampleCode,
        title: row.title,
        state: row.state,
        stateTone: row.stateTone,
        lot: row.lotCode || 'Chưa có lô',
        meta: [row.lotCode ? 'Lô ' + row.lotCode : '', row.routeLabels.join(', '), row.pycNumbers.join(', ')].filter(Boolean).join(' · '),
        detail: row.resultIds.length > 0 ? 'KQTN: ' + row.resultIds.join(', ') : 'Chưa có đủ liên kết PYC/KQTN.',
      })),
      emptyText: 'Chưa có sample item/lô mẫu được ghi nhận cho hồ sơ này.',
    }}
    testTracker={{
      title: 'Test Tracker · PYC → KQTN',
      rows: testEvidence.map((row) => ({
        id: row.id,
        code: row.pycNumber,
        title: row.laboratoryName,
        state: row.state,
        stateTone: row.stateTone,
        lot: row.sampleCodes.join(', '),
        meta: [row.sampleCodes.join(', '), row.routeLabel].filter(Boolean).join(' · '),
        detail: row.result ? 'KQTN: ' + (row.result.reportNumber || 'Đã nhận phiếu không số') + ' · ' + row.result.outcome : 'Chưa có kết quả liên kết.',
      })),
      emptyText: 'Chưa có PYC PTN liên kết với hồ sơ này.',
    }}
    timeline={showTimeline ? {
      title: 'Work Log · lịch sử hồ sơ',
      items: activityLogs.map((log) => ({ id: log.id, title: log.summary, occurredAt: log.createdAt, actor: getPcnActorDisplayName(log.actorName, log.actorUsername, users), detail: log.entityLabel ? activityEntityLabels[log.entityType] + ' · ' + log.entityLabel : activityEntityLabels[log.entityType], tone: log.action === 'CREATED' ? 'success' : 'info' })),
      emptyText: 'Chưa có activity log liên kết với hồ sơ này.',
    } : undefined}
  />;
}
export default PcnDossierBusinessWorkspace;
