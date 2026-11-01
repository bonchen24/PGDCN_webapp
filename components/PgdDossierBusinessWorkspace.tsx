'use client';

import React from 'react';
import type { PcnUserAccount } from '../types';
import { getPgdDossierRequirementForTemplate, getPgdDossierRequirements, type PgdDossierDocument } from '../utils/pgdDossier';
import type { PgdInspectionRequest } from '../utils/pgdDomain';
import { normalizePgdFieldSession } from '../utils/pgdWorkflow';
import { buildPgdBusinessBlockers, buildPgdBusinessTimeline, buildPgdSampleEvidence, resolvePgdEvidenceNextAction } from '../utils/pgdBusinessWorkspace';
import type { PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import { usePgdStore } from '../store-pgd';
import PgdcnDossierBusinessWorkspace, { type DossierBlocker, type DossierEvidenceGroup, type DossierSuggestedAction } from './PgdcnDossierBusinessWorkspace';

const PGD_EVIDENCE_GROUP_LABELS: Record<string, string> = {
  REQUEST: 'PYC · tiếp nhận',
  COMMERCIAL_CUSTOMS: 'Thương mại · hải quan',
  TECHNICAL: 'Kỹ thuật · tiêu chuẩn',
  FIELD: 'Hiện trường · lấy mẫu',
  LAB_SUBCONTRACTOR: 'Bàn giao PTN',
  RESULT_ISSUANCE: 'KQTN · báo cáo · chứng thư',
  ARCHIVE: 'Lưu trữ',
};

function buildPgdEvidenceGroups(requirements: Array<{ code: string; group: string; title: string; required: boolean; description?: string }>, checklist: Array<{ requirementCode: string; status: string }>, documents: Array<{ requirementCode: string; fileName: string; documentNumber?: string; documentDate?: string }>, onOpenCurrentWork: () => void): DossierEvidenceGroup[] {
  const groups = new Map<string, DossierEvidenceGroup>();
  for (const requirement of requirements) {
    const checklistItem = checklist.find((item) => item.requirementCode === requirement.code);
    const document = documents.find((item) => item.requirementCode === requirement.code);
    const present = Boolean(document) || checklistItem?.status === 'PRESENT';
    const waived = checklistItem?.status === 'WAIVED';
    const state = waived ? 'Được miễn' : present ? 'Có bản hiện hành' : requirement.required ? 'Thiếu bắt buộc' : 'Chưa có';
    const stateTone = waived || present ? 'success' as const : requirement.required ? 'danger' as const : 'neutral' as const;
    const group = groups.get(requirement.group) || { id: requirement.group.toLowerCase(), title: PGD_EVIDENCE_GROUP_LABELS[requirement.group] || requirement.group, actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork, rows: [] };
    group.rows.push({
      id: requirement.code,
      code: requirement.code,
      title: requirement.title,
      state,
      stateTone,
      meta: requirement.required ? 'Bắt buộc' : 'Không bắt buộc',
      detail: document ? [document.fileName, document.documentNumber ? 'Số ' + document.documentNumber : '', document.documentDate ? 'Ngày ' + document.documentDate : ''].filter(Boolean).join(' · ') : requirement.description || 'Chưa có tài liệu hiện hành.',
    });
    groups.set(requirement.group, group);
  }
  return Array.from(groups.values());
}

export type PgdDossierBusinessWorkspaceProps = {
  request: PgdInspectionRequest;
  currentUser?: PcnUserAccount;
  onOpenCurrentWork: () => void;
  onOpenDrafting?: (input: { templateKind: PgdDocumentTemplateKind; requirementCode: string }) => string | undefined;
};

export function PgdDossierBusinessWorkspace({ request, onOpenCurrentWork, onOpenDrafting }: PgdDossierBusinessWorkspaceProps) {
  const pgd = usePgdStore();
  const requirements = getPgdDossierRequirements(request.productGroup);
  const dossierDocuments = pgd.dossierDocuments.filter((document) => document.requestId === request.id);
  const samples = pgd.samples.filter((sample) => sample.requestId === request.id);
  const labRequests = pgd.labRequests.filter((labRequest) => labRequest.requestId === request.id);
  const labResults = pgd.labResults.filter((labResult) => labResult.requestId === request.id);
  const assignment = pgd.assignments.find((item) => item.requestId === request.id);
  const fieldInspections = pgd.fieldInspections.filter((item) => item.requestId === request.id).sort((left, right) => String(right.startedAt || right.performedAt || '').localeCompare(String(left.startedAt || left.performedAt || '')));
  const fieldInspection = fieldInspections[0];
  const report = pgd.reports.find((item) => item.requestId === request.id);
  const certificate = pgd.certificates.find((item) => item.requestId === request.id);
  const labResultReview = pgd.labResultReviews.find((item) => item.requestId === request.id);
  const checklist = request.dossierChecklist || [];
  const presentRequirementCodes = new Set([...checklist.filter((item) => item.status === 'PRESENT' || item.status === 'WAIVED').map((item) => item.requirementCode), ...dossierDocuments.map((document) => document.requirementCode)]);
  const missingRequired = requirements.filter((requirement) => requirement.required && !presentRequirementCodes.has(requirement.code));
  const sampleEvidence = buildPgdSampleEvidence({ request, inspectionPlans: pgd.inspectionPlans, fieldInspections, samples, labRequests, labResults });
  const businessFacts = { request, inspectionPlans: pgd.inspectionPlans, assignments: pgd.assignments, fieldInspections, caseEvents: pgd.caseEvents, fieldActivityLogs: pgd.fieldActivityLogs, samples, labRequests, labResults, labResultReview, report, certificate, approvals: pgd.approvals, missingRequiredCount: missingRequired.length };
  const evidenceBlockers = buildPgdBusinessBlockers(businessFacts);
  const evidenceNextAction = resolvePgdEvidenceNextAction(businessFacts);
  const blockers: DossierBlocker[] = evidenceBlockers.map((blocker) => ({ ...blocker, actionLabel: blocker.target === 'DOCUMENTS' ? 'Mở chứng từ' : blocker.target === 'ASSIGNMENT' ? 'Mở phân công' : blocker.target === 'LAB_RESULTS' ? 'Mở KQTN' : blocker.target === 'REVIEW' ? 'Mở xem xét' : 'Mở việc hiện tại', onAction: onOpenCurrentWork }));
  const openLabRequests = labRequests.filter((labRequest) => !labRequest.resultId && labRequest.status !== 'CLOSED');
  const owner = request.ownerUsername || assignment?.leadInspectorUsername || 'Chưa phân công';
  const timelineItems = buildPgdBusinessTimeline(businessFacts);
  const openPgdDrafting = (templateKind: PgdDocumentTemplateKind) => {
    const requirement = getPgdDossierRequirementForTemplate(templateKind, request.productGroup);
    const href = requirement && onOpenDrafting ? onOpenDrafting({ templateKind, requirementCode: requirement.code }) : undefined;
    if (href && typeof window !== 'undefined') window.location.assign(href);
    else onOpenCurrentWork();
  };
  const contextualActions: DossierSuggestedAction[] = [];
  if (missingRequired.length > 0) contextualActions.push({
    id: 'pgd-review-dossier-before-next-step',
    title: 'Kiểm tra bộ hồ sơ trước khi đi tiếp',
    reason: 'Còn ' + missingRequired.length + ' tài liệu bắt buộc chưa có bản hiện hành.',
    actionLabel: 'Mở việc hiện tại',
    onAction: onOpenCurrentWork,
    tone: 'warning',
  });
  if (samples.length > 0 && labRequests.length === 0) contextualActions.push({
    id: 'pgd-create-lab-request',
    title: 'Lập PYC PTN',
    reason: samples.length + ' mẫu đã ghi nhận nhưng chưa có yêu cầu PTN liên kết.',
    actionLabel: onOpenDrafting ? 'Soạn PYC PTN' : 'Mở việc hiện tại',
    onAction: onOpenDrafting ? () => openPgdDrafting('LAB_REQUEST') : onOpenCurrentWork,
    tone: 'info',
  });
  if (openLabRequests.length > 0) contextualActions.push({
    id: 'pgd-track-lab-results',
    title: 'Theo dõi KQTN',
    reason: openLabRequests.length + ' PYC PTN chưa liên kết kết quả trả về.',
    actionLabel: 'Mở việc hiện tại',
    onAction: onOpenCurrentWork,
    tone: 'warning',
  });
  if (labResults.length > 0 && !report && !certificate) contextualActions.push({
    id: 'pgd-draft-inspection-report',
    title: 'Soạn báo cáo giám định',
    reason: labResults.length + ' KQTN đã có; có thể mở biểu mẫu báo cáo để người dùng soát xét.',
    actionLabel: onOpenDrafting ? 'Soạn báo cáo' : 'Mở việc hiện tại',
    onAction: onOpenDrafting ? () => openPgdDrafting('INSPECTION_REPORT') : onOpenCurrentWork,
    tone: 'success',
  });
  return <PgdcnDossierBusinessWorkspace
    domain="PGD"
    title="Bản đồ bộ hồ sơ PGD"
    description="PYC, phân công, nhiều phiên hiện trường, mẫu, PTN, KQTN, báo cáo và chứng thư được nhìn như một bộ hồ sơ điện tử có sự kiện."
    nextAction={{ title: evidenceNextAction.label, reason: evidenceNextAction.reason, owner, missing: evidenceNextAction.source === 'EVIDENCE' ? evidenceNextAction.reason : 'Chưa ghi nhận thiếu hụt cứng', actionLabel: 'Mở việc cần làm', onAction: onOpenCurrentWork }}
    metrics={[
      { id: 'pgd-documents', label: 'Tài liệu bắt buộc', value: presentRequirementCodes.size + '/' + requirements.filter((item) => item.required).length, tone: missingRequired.length > 0 ? 'warning' : 'success' },
      { id: 'pgd-sessions', label: 'Phiên hiện trường', value: fieldInspections.length, tone: fieldInspections.some((item) => item.status === 'COMPLETED' || item.completed) ? 'success' : fieldInspections.length > 0 ? 'warning' : 'neutral' },
      { id: 'pgd-samples', label: 'Mẫu', value: samples.length, tone: samples.length > 0 ? 'info' : 'neutral' },
      { id: 'pgd-lab-results', label: 'KQTN', value: labResults.length, tone: labResults.length > 0 ? 'success' : 'neutral' },
    ]}
    blockers={blockers}
    suggestedActions={contextualActions}
    evidenceTracker={{ title: 'Evidence Tracker · bộ chứng từ hiện hành', groups: buildPgdEvidenceGroups(requirements, checklist, dossierDocuments, onOpenCurrentWork), emptyText: 'Chưa có danh mục chứng từ trong hồ sơ PGD.' }}
    groups={[
      { id: 'pgd-request', title: '1. PYC / khách hàng', description: 'Mã PYC, khách hàng, hàng hóa, lô, phạm vi và chứng từ thương mại đầu vào.', status: request.customerSnapshot?.name && request.productName ? 'DONE' : 'BLOCKED', statusLabel: request.customerSnapshot?.name && request.productName ? 'Đã nhận diện' : 'Thiếu đầu vào', countLabel: request.requestCode, meta: request.customerSnapshot?.name, actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-assignment', title: '2. Phân công & năng lực', description: 'KTV, trưởng đoàn, người soát xét và phương thức giám định gắn với PYC.', status: assignment?.status === 'APPROVED' ? 'DONE' : assignment ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: assignment?.status === 'APPROVED' ? 'Đã duyệt' : assignment ? 'Đang xử lý' : 'Chưa có', countLabel: assignment ? assignment.inspectorUsernames.length + ' KTV' : 'Chưa phân công', meta: assignment?.technicalReviewerUsername || 'Chưa có người soát xét', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-field', title: '3. Phiên hiện trường', description: 'Ngày/địa điểm, người thực hiện, quan sát, đo đạc, điểm không phù hợp, mẫu và biên bản.', status: fieldInspections.some((item) => item.status === 'COMPLETED' || item.completed) ? 'DONE' : fieldInspections.length ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: fieldInspections.some((item) => item.status === 'COMPLETED' || item.completed) ? 'Đã có phiên hoàn tất' : fieldInspections.length ? 'Đang ghi nhận' : 'Chưa có phiên', countLabel: fieldInspections.length ? fieldInspections.length + ' phiên' : 'Chưa có phiên', meta: fieldInspection?.location || request.inspectionLocation || 'Chưa xác định', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-sampling', title: '4. Mẫu & bàn giao PTN', description: 'Mã mẫu, số lượng, niêm phong, mẫu lưu, bàn giao và liên kết yêu cầu PTN.', status: samples.length > 0 && labRequests.length > 0 ? 'DONE' : samples.length > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: labRequests.length > 0 ? 'Đã lập PYC PTN' : samples.length > 0 ? 'Đã có mẫu' : 'Chưa có mẫu', countLabel: samples.length + ' mẫu · ' + labRequests.length + ' PYC', meta: samples.filter((sample) => sample.handedOverAt).length + ' mẫu đã bàn giao', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-results', title: '5. KQTN & xem xét', description: 'Kết quả nhận về, độ đầy đủ, phù hợp/không phù hợp và yêu cầu thử lại.', status: labResultReview?.status === 'FINAL' ? 'DONE' : labResults.length > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: labResultReview?.status === 'FINAL' ? 'Đã chốt xem xét' : labResults.length > 0 ? 'Có KQTN' : 'Chưa có KQTN', countLabel: labResults.length + ' KQTN', meta: labResultReview?.conformity || 'Chưa xem xét', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-issuance', title: '6. Báo cáo / chứng thư', description: 'Dữ liệu có cấu trúc, snapshot mẫu, phê duyệt, ký và trả kết quả.', status: certificate?.status === 'SIGNED' ? 'DONE' : report || certificate ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: certificate?.status === 'SIGNED' ? 'Đã ký' : report || certificate ? 'Có dự thảo' : 'Chưa lập', countLabel: certificate ? '1 chứng thư' : report ? '1 báo cáo' : 'Chưa có output', meta: report?.reportNumber || certificate?.documentNumber || 'Chưa có số', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
    ]}
    sampleSummary={sampleEvidence}
    testSummary={{ requestCount: labRequests.length, resultCount: labResults.length, pendingCount: sampleEvidence.pendingLabRequestCount }}
    sampleTracker={{ title: 'Sample Tracker · mã mẫu và vị trí', rows: sampleEvidence.rows.map((row) => ({ id: row.id, code: row.sampleCode, title: row.title, state: row.state, stateTone: row.stateTone, session: row.sessionCode || 'Chưa gắn phiên', date: row.sessionStartedAt ? row.sessionStartedAt.slice(0, 10) : 'Chưa có ngày', lot: row.lotSummary || 'Chưa có thông tin lô', meta: [row.quantity + ' ' + (row.unit || ''), row.lotSummary ? 'Lô ' + row.lotSummary : '', row.sessionCode ? 'Phiên ' + row.sessionCode : '', row.location, row.laboratoryName].filter(Boolean).join(' · '), detail: [row.sessionStartedAt ? 'Lấy lúc ' + row.sessionStartedAt : '', row.labRequestId ? 'PYC ' + row.labRequestId : '', row.resultReportNumber ? 'Phiếu ' + row.resultReportNumber : ''].filter(Boolean).join(' · ') || 'Chưa có liên kết KQTN.' })), emptyText: 'Chưa có mẫu entity trong hồ sơ PGD.' }}
    testTracker={{ title: 'Test Tracker · PYC và KQTN', rows: labRequests.map((labRequest) => { const result = labResults.find((item) => item.labRequestId === labRequest.id); return { id: labRequest.id, code: labRequest.id, title: labRequest.laboratoryName, state: result ? 'Đã nhận KQTN' : labRequest.status, stateTone: result ? 'success' : 'warning', meta: labRequest.testItems.join(', '), detail: result ? (result.reportNumber || 'Đã nhận phiếu không số') + ' · ' + result.values.length + ' chỉ tiêu' : 'Chưa có kết quả liên kết.' }; }), emptyText: 'Chưa có yêu cầu PTN trong hồ sơ PGD.' }}
    fieldSession={{ exists: false, status: 'Chưa có phiên', actionLabel: 'Mở work panel', onAction: onOpenCurrentWork }}
    fieldSessions={fieldInspections.map((raw) => {
      const session = normalizePgdFieldSession(raw);
      const sessionDate = session.startedAt ? session.startedAt.slice(0, 10) : undefined;
      return {
        id: session.id,
        exists: true,
        sessionCode: session.sessionCode,
        activityType: session.activityType,
        status: session.status === 'COMPLETED' ? 'Đã hoàn tất' : session.status === 'CANCELLED' ? 'Đã hủy' : 'Đang ghi nhận',
        statusTone: session.status === 'COMPLETED' ? 'success' : session.status === 'CANCELLED' ? 'danger' : 'warning',
        occurredAt: session.startedAt || session.performedAt,
        endedAt: session.endedAt,
        location: session.location,
        inspectors: session.inspectorUsernames.join(', '),
        objectLabel: session.objectDescription || request.productName,
        quantity: session.inspectedQuantity ? session.inspectedQuantity + ' ' + (session.inspectedUnit || '') : request.quantity + ' ' + (request.unit || ''),
        observations: [session.lotObservation, session.packaging, session.labeling, session.inspectionResult].filter(Boolean).join(' · '),
        measurements: Object.entries(session.measurements || {}).map(([key, value]) => key + ': ' + value).join(' · '),
        sampleSummary: session.sampleIds.length + ' mẫu liên quan',
        sampleCount: session.sampleIds.length,
        evidenceSummary: (session.evidenceAssetIds?.length || 0) + ' bằng chứng',
        onView: onOpenCurrentWork,
        onEdit: onOpenCurrentWork,
      };
    })}    timeline={{ title: 'Event Timeline / Work Log · toàn bộ hồ sơ', items: timelineItems, emptyText: 'Chưa có sự kiện nghiệp vụ nào được ghi nhận.' }}
  />;
}
export default PgdDossierBusinessWorkspace;
