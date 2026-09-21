'use client';

import React from 'react';
import type { PcnUserAccount } from '../types';
import { getPgdDossierRequirementForTemplate, getPgdDossierRequirements, type PgdDossierDocument } from '../utils/pgdDossier';
import { PGD_WORKFLOW_STATES, getPgdStatusLabel, type PgdInspectionRequest } from '../utils/pgdDomain';
import type { PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import { usePgdStore } from '../store-pgd';
import PgdcnDossierBusinessWorkspace, { type DossierBlocker, type DossierEvidenceGroup, type DossierSuggestedAction, type DossierTimelineItem } from './PgdcnDossierBusinessWorkspace';

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

function formatPgdSampleState(sample: { disposition: string; handedOverAt?: string }, hasResult: boolean): { state: string; stateTone: 'neutral' | 'info' | 'warning' | 'success' } {
  if (hasResult) return { state: 'Đã có KQTN', stateTone: 'success' };
  if (sample.disposition === 'LAB' && sample.handedOverAt) return { state: 'Đang chờ KQTN', stateTone: 'warning' };
  if (sample.disposition === 'LAB') return { state: 'Chờ bàn giao PTN', stateTone: 'info' };
  return { state: 'Mẫu lưu', stateTone: 'neutral' };
}

export function PgdDossierBusinessWorkspace({ request, onOpenCurrentWork, onOpenDrafting }: PgdDossierBusinessWorkspaceProps) {
  const pgd = usePgdStore();
  const requirements = getPgdDossierRequirements(request.productGroup);
  const dossierDocuments = pgd.dossierDocuments.filter((document) => document.requestId === request.id);
  const samples = pgd.samples.filter((sample) => sample.requestId === request.id);
  const labRequests = pgd.labRequests.filter((labRequest) => labRequest.requestId === request.id);
  const labResults = pgd.labResults.filter((labResult) => labResult.requestId === request.id);
  const assignment = pgd.assignments.find((item) => item.requestId === request.id);
  const fieldInspection = pgd.fieldInspections.find((item) => item.requestId === request.id);
  const report = pgd.reports.find((item) => item.requestId === request.id);
  const certificate = pgd.certificates.find((item) => item.requestId === request.id);
  const labResultReview = pgd.labResultReviews.find((item) => item.requestId === request.id);
  const checklist = request.dossierChecklist || [];
  const presentRequirementCodes = new Set([
    ...checklist.filter((item) => item.status === 'PRESENT' || item.status === 'WAIVED').map((item) => item.requirementCode),
    ...dossierDocuments.map((document) => document.requirementCode),
  ]);
  const missingRequired = requirements.filter((requirement) => requirement.required && !presentRequirementCodes.has(requirement.code));
  const currentOrder = PGD_WORKFLOW_STATES.find((state) => state.code === request.status)?.order || 0;
  const statusOrder = (code: string) => PGD_WORKFLOW_STATES.find((state) => state.code === code)?.order || 0;
  const openLabRequests = labRequests.filter((labRequest) => !labRequest.resultId && !['CLOSED'].includes(labRequest.status));
  const owner = request.ownerUsername || assignment?.leadInspectorUsername || 'Chưa phân công';
  const blockers: DossierBlocker[] = [];
  if (missingRequired.length > 0) blockers.push({ id: 'pgd-required-documents', title: 'Thiếu tài liệu hồ sơ', reason: missingRequired.length + ' tài liệu bắt buộc chưa có bản hiện hành trong checklist PGD.', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork });
  if (currentOrder >= statusOrder('FIELD_INSPECTION') && !assignment) blockers.push({ id: 'pgd-assignment-missing', title: 'Chưa có phân công hiện trường', reason: 'Hồ sơ đã tới vùng hiện trường nhưng chưa có bản phân công gắn KTV/người soát xét.', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork });
  if (currentOrder >= statusOrder('WAITING_LAB_RESULTS') && openLabRequests.length > 0) blockers.push({ id: 'pgd-lab-results-pending', title: 'Còn PYC PTN thiếu kết quả', reason: openLabRequests.length + ' yêu cầu PTN chưa liên kết kết quả nhận về.', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork });
  if (labResultReview?.conformity === 'NON_CONFORMING') blockers.push({ id: 'pgd-nonconforming-result', title: 'Kết quả cần xử lý không phù hợp', reason: labResultReview.conclusion || 'Bản xem xét KQTN đang đánh dấu không phù hợp.', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork });
  const timelineItems: DossierTimelineItem[] = [
    ...(pgd.caseEvents.filter((event) => event.requestId === request.id).map((event) => ({ id: event.id, title: event.activity, occurredAt: event.occurredAt, actor: event.actorUsername, detail: event.note, tone: event.customerConfirmed ? 'success' as const : 'info' as const }))),
    ...(pgd.fieldActivityLogs.filter((log) => log.requestId === request.id).flatMap((log) => log.entries.map((entry, index) => ({ id: log.id + '-' + index, title: entry.activity, occurredAt: log.date, actor: log.auditorUsername, detail: entry.comments, location: log.session === 'MORNING' ? 'Phiên sáng' : 'Phiên chiều', tone: 'info' as const })))),
    ...(fieldInspection ? [{ id: fieldInspection.id, title: fieldInspection.completed ? 'Hoàn tất phiên hiện trường' : 'Đang ghi nhận phiên hiện trường', occurredAt: fieldInspection.performedAt, actor: fieldInspection.inspectorUsernames.join(', '), location: fieldInspection.location, detail: fieldInspection.inspectionResult || fieldInspection.note, tone: fieldInspection.completed ? 'success' as const : 'warning' as const }] : []),
  ].sort((left, right) => String(right.occurredAt || '').localeCompare(String(left.occurredAt || '')));


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
    description="PYC, phân công, phiên hiện trường, mẫu, PTN, KQTN, báo cáo và chứng thư được nhìn như một bộ hồ sơ điện tử có sự kiện."
    nextAction={{
      title: getPgdStatusLabel(request.status),
      reason: blockers.length > 0 ? 'Hồ sơ đang có bằng chứng cần xử lý trước khi đi tiếp.' : 'Vùng công việc được xác định bởi trạng thái PGD hiện tại.',
      owner,
      missing: missingRequired.length > 0 ? missingRequired.length + ' tài liệu bắt buộc' : openLabRequests.length > 0 ? openLabRequests.length + ' PYC thiếu KQTN' : 'Chưa ghi nhận thiếu hụt cứng',
      actionLabel: 'Mở việc cần làm',
      onAction: onOpenCurrentWork,
    }}
    metrics={[
      { id: 'pgd-documents', label: 'Tài liệu bắt buộc', value: presentRequirementCodes.size + '/' + requirements.filter((item) => item.required).length, tone: missingRequired.length > 0 ? 'warning' : 'success' },
      { id: 'pgd-sessions', label: 'Phiên hiện trường', value: fieldInspection ? 1 : 0, tone: fieldInspection?.completed ? 'success' : fieldInspection ? 'warning' : 'neutral' },
      { id: 'pgd-samples', label: 'Mẫu', value: samples.length, tone: samples.length > 0 ? 'info' : 'neutral' },
      { id: 'pgd-lab-results', label: 'KQTN', value: labResults.length, tone: labResults.length > 0 ? 'success' : 'neutral' },
    ]}
    blockers={blockers}
    suggestedActions={contextualActions}
    evidenceTracker={{
      title: 'Evidence Tracker · bộ chứng từ hiện hành',
      groups: buildPgdEvidenceGroups(requirements, checklist, dossierDocuments, onOpenCurrentWork),
      emptyText: 'Chưa có checklist chứng từ trong hồ sơ PGD.',
    }}
    groups={[
      { id: 'pgd-request', title: '1. PYC / khách hàng', description: 'Mã PYC, khách hàng, hàng hóa, lô, phạm vi và chứng từ thương mại đầu vào.', status: request.customerSnapshot.name && request.productName ? 'DONE' : 'BLOCKED', statusLabel: request.customerSnapshot.name && request.productName ? 'Đã nhận diện' : 'Thiếu đầu vào', countLabel: request.requestCode, meta: request.customerSnapshot.name, actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-assignment', title: '2. Phân công & năng lực', description: 'KTV, trưởng đoàn, người soát xét và phương thức giám định gắn với PYC.', status: assignment?.status === 'APPROVED' ? 'DONE' : assignment ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: assignment?.status === 'APPROVED' ? 'Đã duyệt' : assignment ? 'Đang xử lý' : 'Chưa có', countLabel: assignment ? assignment.inspectorUsernames.length + ' KTV' : 'Chưa phân công', meta: assignment?.technicalReviewerUsername || 'Chưa có người soát xét', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-field', title: '3. Phiên hiện trường', description: 'Ngày/địa điểm, người thực hiện, quan sát, đo đạc, điểm không phù hợp, mẫu và biên bản.', status: fieldInspection?.completed ? 'DONE' : fieldInspection ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: fieldInspection?.completed ? 'Đã hoàn tất' : fieldInspection ? 'Đang ghi nhận' : 'Chưa có phiên', countLabel: fieldInspection ? '1 phiên' : 'Chưa có phiên', meta: fieldInspection?.location || request.inspectionLocation || 'Chưa xác định', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-sampling', title: '4. Mẫu & bàn giao PTN', description: 'Mã mẫu, số lượng, niêm phong, mẫu lưu, bàn giao và liên kết yêu cầu PTN.', status: samples.length > 0 && labRequests.length > 0 ? 'DONE' : samples.length > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: labRequests.length > 0 ? 'Đã lập PYC PTN' : samples.length > 0 ? 'Đã có mẫu' : 'Chưa có mẫu', countLabel: samples.length + ' mẫu · ' + labRequests.length + ' PYC', meta: samples.filter((sample) => sample.handedOverAt).length + ' mẫu đã bàn giao', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-results', title: '5. KQTN & xem xét', description: 'Kết quả nhận về, độ đầy đủ, phù hợp/không phù hợp và yêu cầu thử lại.', status: labResultReview?.status === 'FINAL' ? 'DONE' : labResults.length > 0 ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: labResultReview?.status === 'FINAL' ? 'Đã chốt xem xét' : labResults.length > 0 ? 'Có KQTN' : 'Chưa có KQTN', countLabel: labResults.length + ' KQTN', meta: labResultReview?.conformity || 'Chưa xem xét', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
      { id: 'pgd-issuance', title: '6. Báo cáo / chứng thư', description: 'Dữ liệu có cấu trúc, snapshot mẫu, phê duyệt, ký và trả kết quả.', status: certificate?.status === 'SIGNED' ? 'DONE' : report || certificate ? 'IN_PROGRESS' : 'NOT_STARTED', statusLabel: certificate?.status === 'SIGNED' ? 'Đã ký' : report || certificate ? 'Có dự thảo' : 'Chưa lập', countLabel: certificate ? '1 chứng thư' : report ? '1 báo cáo' : 'Chưa có output', meta: report?.reportNumber || certificate?.documentNumber || 'Chưa có số', actionLabel: 'Mở việc hiện tại', onAction: onOpenCurrentWork },
    ]}
    sampleTracker={{
      title: 'Sample Tracker · mã mẫu và vị trí',
      rows: samples.map((sample) => {
        const requestForSample = labRequests.find((item) => item.sampleId === sample.id);
        const result = requestForSample ? labResults.find((item) => item.labRequestId === requestForSample.id) : undefined;
        const state = formatPgdSampleState(sample, Boolean(result));
        return { id: sample.id, code: sample.sampleCode, title: sample.description, state: state.state, stateTone: state.stateTone, meta: sample.quantity + ' ' + (sample.unit || '') + ' · ' + (sample.samplingLocation || request.inspectionLocation || 'Chưa rõ nơi lấy'), detail: [sample.laboratoryName, sample.sealNumber ? 'Niêm phong ' + sample.sealNumber : '', sample.retainedUntil ? 'Mẫu lưu đến ' + sample.retainedUntil : ''].filter(Boolean).join(' · ') };
      }),
      emptyText: 'Chưa có mẫu entity trong hồ sơ PGD.',
    }}
    testTracker={{
      title: 'Test Tracker · PYC và KQTN',
      rows: labRequests.map((labRequest) => {
        const result = labResults.find((item) => item.labRequestId === labRequest.id);
        return { id: labRequest.id, code: labRequest.id, title: labRequest.laboratoryName, state: result ? 'Đã nhận KQTN' : labRequest.status, stateTone: result ? 'success' : 'warning', meta: labRequest.testItems.join(', '), detail: result ? (result.reportNumber || 'Đã nhận phiếu không số') + ' · ' + result.values.length + ' chỉ tiêu' : 'Chưa có kết quả liên kết.' };
      }),
      emptyText: 'Chưa có yêu cầu PTN trong hồ sơ PGD.',
    }}
    fieldSession={{
      exists: Boolean(fieldInspection),
      status: fieldInspection?.completed ? 'Đã hoàn tất' : fieldInspection ? 'Đang ghi nhận' : 'Chưa có phiên',
      statusTone: fieldInspection?.completed ? 'success' : fieldInspection ? 'warning' : 'neutral',
      occurredAt: fieldInspection?.performedAt,
      location: fieldInspection?.location || request.inspectionLocation,
      inspectors: fieldInspection?.inspectorUsernames.join(', ') || assignment?.inspectorUsernames.join(', '),
      objectLabel: request.productName,
      quantity: request.quantity + ' ' + (request.unit || '') + (request.weight ? ' · ' + request.weight + ' ' + (request.weightUnit || '') : ''),
      observations: fieldInspection ? [fieldInspection.lotObservation, fieldInspection.packaging, fieldInspection.labeling].filter(Boolean).join(' · ') : undefined,
      measurements: fieldInspection ? Object.entries(fieldInspection.measurements || {}).map(([key, value]) => key + ': ' + value).join(' · ') : undefined,
      sampleSummary: (fieldInspection?.sampleIds.length || samples.length) + ' mẫu liên quan',
      evidenceSummary: (fieldInspection?.evidenceAssetIds?.length || 0) + ' bằng chứng',
      actionLabel: 'Mở work panel',
      onAction: onOpenCurrentWork,
    }}
    timeline={{ title: 'Event Timeline / Work Log · phiên hiện trường', items: timelineItems, emptyText: 'Chưa có case event, field activity log hoặc phiên hiện trường được ghi nhận.' }}
  />;
}

export default PgdDossierBusinessWorkspace;
