import { getPgdcnNextAction, type PgdcnNextAction } from './pgdcnDashboard';
import type {
  PgdApprovalStep,
  PgdFieldInspection,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from './pgdDomain';
import type { PgdCaseEvent, PgdFieldActivityLog, PgdInspectionPlan, PgdLabResultReview } from './pgdArtifacts';
import { normalizePgdFieldSession } from './pgdWorkflow';

export type PgdBusinessTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';
export type PgdBusinessTimelineKind = 'CASE_EVENT' | 'FIELD_ACTIVITY' | 'FIELD_SESSION' | 'SAMPLE' | 'LAB_REQUEST' | 'LAB_RESULT' | 'RESULT_REVIEW' | 'REPORT' | 'APPROVAL' | 'CERTIFICATE';
export type PgdBusinessTimelineItem = { id: string; sourceId: string; kind: PgdBusinessTimelineKind; title: string; occurredAt?: string; actor?: string; location?: string; detail?: string; tone: PgdBusinessTone };
export type PgdSampleEvidenceRow = { id: string; sampleCode: string; title: string; quantity: number; unit?: string; lotSummary?: string; location?: string; sessionId?: string; sessionCode?: string; sessionStartedAt?: string; laboratoryName?: string; labRequestId?: string; resultId?: string; resultReportNumber?: string; state: string; stateTone: PgdBusinessTone };
export type PgdSampleEvidenceSummary = { expectedUnits?: number; sampledUnits: number; expectedSampleCount?: number; expectedSampleQuantity?: number; actualSampleCount: number; actualSampleQuantity: number; sampleCount: number; labRequestCount: number; resultCount: number; sampledWithResultCount: number; pendingLabRequestCount: number; rows: PgdSampleEvidenceRow[] };
export type PgdBusinessBlocker = { id: string; title: string; reason: string; severity: 'HARD' | 'WARNING'; target: 'CURRENT_WORK' | 'DOCUMENTS' | 'ASSIGNMENT' | 'FIELD' | 'LAB_RESULTS' | 'REVIEW' | 'REPORT'; source: string };
export type PgdEvidenceNextAction = PgdcnNextAction & { source: 'EVIDENCE' | 'STATUS_FALLBACK'; reason: string; target: PgdBusinessBlocker['target']; blockerIds: string[] };
export type PgdBusinessFacts = {
  request: PgdInspectionRequest;
  inspectionPlans?: readonly PgdInspectionPlan[];
  assignments?: readonly { requestId: string; status?: string; leadInspectorUsername?: string; inspectorUsernames?: readonly string[] }[];
  fieldInspections?: readonly PgdFieldInspection[];
  caseEvents?: readonly PgdCaseEvent[];
  fieldActivityLogs?: readonly PgdFieldActivityLog[];
  samples?: readonly PgdSample[];
  labRequests?: readonly PgdLabRequest[];
  labResults?: readonly PgdLabResult[];
  labResultReview?: PgdLabResultReview;
  report?: PgdInspectionReport;
  certificate?: PgdInspectionCertificate;
  approvals?: readonly PgdApprovalStep[];
  missingRequiredCount?: number;
};

function finiteQuantity(value: unknown): number { const quantity = Number(value); return Number.isFinite(quantity) && quantity > 0 ? quantity : 0; }
function latestPlan(plans: readonly PgdInspectionPlan[], requestId: string): PgdInspectionPlan | undefined { return plans.filter((plan) => plan.requestId === requestId).sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))[0]; }

export function buildPgdSampleEvidence(input: Pick<PgdBusinessFacts, 'request' | 'inspectionPlans' | 'fieldInspections' | 'samples' | 'labRequests' | 'labResults'>): PgdSampleEvidenceSummary {
  const requestId = input.request.id;
  const samples = (input.samples || []).filter((sample) => sample.requestId === requestId);
  const labRequests = (input.labRequests || []).filter((item) => item.requestId === requestId);
  const labResults = (input.labResults || []).filter((item) => item.requestId === requestId);
  const plan = latestPlan(input.inspectionPlans || [], requestId);
  const expectedLines = plan?.samplingLines;
  const expectedUnits = expectedLines && expectedLines.length > 0 ? expectedLines.reduce((sum, line) => sum + finiteQuantity(line.quantity), 0) : undefined;
  const expectedSampleCount = expectedUnits;
  const sessionBySampleId = new Map<string, ReturnType<typeof normalizePgdFieldSession>>();
  for (const rawSession of (input.fieldInspections || []).filter((item) => item.requestId === requestId)) {
    const session = normalizePgdFieldSession(rawSession);
    for (const sampleId of session.sampleIds || []) sessionBySampleId.set(sampleId, session);
  }
  const resultByLabRequest = new Map(labResults.map((result) => [result.labRequestId, result]));
  const requestBySample = new Map(labRequests.map((labRequest) => [labRequest.sampleId, labRequest]));
  const rows = samples.map((sample): PgdSampleEvidenceRow => {
    const labRequest = requestBySample.get(sample.id);
    const result = labRequest ? resultByLabRequest.get(labRequest.id) : undefined;
    const state = result ? 'Đã có KQTN' : labRequest?.status === 'ISSUE' ? 'KQTN có vấn đề' : labRequest?.handover?.sentAt ? 'Đang chờ KQTN' : labRequest ? 'Đã lập PYC PTN' : sample.disposition === 'LAB' ? 'Chờ lập PYC PTN' : 'Mẫu lưu';
    const stateTone: PgdBusinessTone = result ? 'success' : labRequest?.status === 'ISSUE' ? 'danger' : labRequest ? 'warning' : 'neutral';
    const session = sessionBySampleId.get(sample.id);
    return { id: sample.id, sampleCode: sample.sampleCode, title: sample.description || sample.sampleTypeLabel || sample.sampleCode, quantity: finiteQuantity(sample.quantity), unit: sample.unit, lotSummary: sample.lotQuantity === undefined ? undefined : String(sample.lotQuantity) + ' ' + (sample.lotUnit || sample.unit || ''), location: sample.samplingLocation || session?.location || input.request.inspectionLocation, sessionId: session?.id, sessionCode: session?.sessionCode, sessionStartedAt: session?.startedAt || session?.performedAt, laboratoryName: labRequest?.laboratoryName || sample.laboratoryName, labRequestId: labRequest?.id, resultId: result?.id, resultReportNumber: result?.reportNumber, state, stateTone };
  });
  const resultSampleIds = new Set(rows.filter((row) => row.resultId).map((row) => row.id));
  const actualSampleQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  return { expectedUnits, sampledUnits: actualSampleQuantity, expectedSampleCount, actualSampleCount: rows.length, actualSampleQuantity, sampleCount: rows.length, labRequestCount: labRequests.length, resultCount: new Set(labResults.map((result) => result.id)).size, sampledWithResultCount: resultSampleIds.size, pendingLabRequestCount: labRequests.filter((item) => !resultByLabRequest.has(item.id) && item.status !== 'CLOSED').length, rows };
}

function timelineItem(input: Omit<PgdBusinessTimelineItem, 'tone'> & { tone?: PgdBusinessTone }): PgdBusinessTimelineItem { return { ...input, tone: input.tone || 'info' }; }

export function buildPgdBusinessTimeline(input: Pick<PgdBusinessFacts, 'request' | 'caseEvents' | 'fieldActivityLogs' | 'fieldInspections' | 'samples' | 'labRequests' | 'labResults' | 'labResultReview' | 'report' | 'certificate' | 'approvals'>): PgdBusinessTimelineItem[] {
  const requestId = input.request.id;
  const items: PgdBusinessTimelineItem[] = [];
  for (const event of (input.caseEvents || []).filter((item) => item.requestId === requestId)) items.push(timelineItem({ id: `case:${event.id}`, sourceId: event.id, kind: 'CASE_EVENT', title: event.activity, occurredAt: event.occurredAt, actor: event.actorUsername, detail: event.note, tone: event.customerConfirmed ? 'success' : 'info' }));
  for (const log of (input.fieldActivityLogs || []).filter((item) => item.requestId === requestId)) for (const [index, entry] of log.entries.entries()) { const occurredAt = log.date && entry.time ? `${log.date}T${entry.time}:00` : log.date; items.push(timelineItem({ id: `field-log:${log.id}:${index}`, sourceId: log.id, kind: 'FIELD_ACTIVITY', title: entry.activity, occurredAt, actor: log.auditorUsername, location: log.session === 'MORNING' ? 'Phiên sáng' : 'Phiên chiều', detail: entry.comments })); }
  for (const raw of (input.fieldInspections || []).filter((item) => item.requestId === requestId)) { const session = normalizePgdFieldSession(raw); items.push(timelineItem({ id: `field-session:${session.id}`, sourceId: session.id, kind: 'FIELD_SESSION', title: session.status === 'COMPLETED' ? 'Hoàn tất phiên hiện trường' : 'Đang ghi nhận phiên hiện trường', occurredAt: session.startedAt || session.performedAt, actor: session.inspectorUsernames.join(', '), location: session.location, detail: [session.objectDescription, session.inspectionResult, session.note].filter(Boolean).join(' · '), tone: session.status === 'COMPLETED' ? 'success' : 'warning' })); }
  for (const sample of (input.samples || []).filter((item) => item.requestId === requestId && item.sampledAt)) items.push(timelineItem({ id: `sample:${sample.id}`, sourceId: sample.id, kind: 'SAMPLE', title: `Đã ghi nhận mẫu ${sample.sampleCode}`, occurredAt: sample.sampledAt, actor: sample.sampledByUsername, location: sample.samplingLocation, detail: `${sample.quantity} ${sample.unit || ''} · ${sample.disposition === 'LAB' ? 'Gửi PTN' : 'Mẫu lưu'}`, tone: 'info' }));
  for (const labRequest of (input.labRequests || []).filter((item) => item.requestId === requestId && item.handover?.sentAt)) items.push(timelineItem({ id: `lab-request:${labRequest.id}`, sourceId: labRequest.id, kind: 'LAB_REQUEST', title: `Đã lập PYC PTN tại ${labRequest.laboratoryName}`, occurredAt: labRequest.handover?.sentAt, actor: labRequest.handover?.senderUsername, detail: labRequest.testItems.join(', '), tone: 'info' }));
  for (const result of (input.labResults || []).filter((item) => item.requestId === requestId)) items.push(timelineItem({ id: `lab-result:${result.id}`, sourceId: result.id, kind: 'LAB_RESULT', title: result.reportNumber ? `Đã nhận KQTN ${result.reportNumber}` : 'Đã nhận KQTN', occurredAt: result.receivedAt, actor: result.acceptedByUsername, detail: result.issue || `${result.values.length} chỉ tiêu`, tone: result.issue ? 'warning' : 'success' }));
  if (input.labResultReview?.requestId === requestId) items.push(timelineItem({ id: `result-review:${input.labResultReview.id}`, sourceId: input.labResultReview.id, kind: 'RESULT_REVIEW', title: input.labResultReview.status === 'FINAL' ? 'Đã chốt xem xét KQTN' : 'Đang xem xét KQTN', occurredAt: input.labResultReview.reviewedAt || input.labResultReview.updatedAt, actor: input.labResultReview.reviewerUsername, detail: input.labResultReview.conclusion, tone: input.labResultReview.status === 'FINAL' ? 'success' : 'warning' }));
  if (input.report?.requestId === requestId) items.push(timelineItem({ id: `report:${input.report.id}`, sourceId: input.report.id, kind: 'REPORT', title: input.report.status === 'APPROVED' ? 'Báo cáo đã được duyệt' : 'Đã lập báo cáo giám định', occurredAt: input.report.updatedAt || input.report.createdAt, detail: input.report.reportNumber || input.report.conclusion, tone: input.report.status === 'APPROVED' ? 'success' : 'info' }));
  for (const approval of (input.approvals || []).filter((item) => item.requestId === requestId && item.actedAt)) items.push(timelineItem({ id: `approval:${approval.id}`, sourceId: approval.id, kind: 'APPROVAL', title: approval.status === 'APPROVED' ? 'Đã phê duyệt ' + approval.role : 'Đã xử lý bước ' + approval.role, occurredAt: approval.actedAt, actor: approval.actedByUsername, detail: approval.comment, tone: approval.status === 'APPROVED' ? 'success' : 'warning' }));
  if (input.certificate?.requestId === requestId) items.push(timelineItem({ id: `certificate:${input.certificate.id}`, sourceId: input.certificate.id, kind: 'CERTIFICATE', title: input.certificate.status === 'SIGNED' ? 'Đã ký chứng thư' : 'Đã lập chứng thư', occurredAt: input.certificate.signedAt || input.certificate.updatedAt || input.certificate.createdAt, actor: input.certificate.signedByUsername, detail: input.certificate.documentNumber || input.certificate.conclusion, tone: input.certificate.status === 'SIGNED' ? 'success' : 'info' }));
  return items.sort((left, right) => String(right.occurredAt || '').localeCompare(String(left.occurredAt || '')) || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id)).filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
}

export function buildPgdBusinessBlockers(input: PgdBusinessFacts): PgdBusinessBlocker[] {
  const requestId = input.request.id;
  const blockers: PgdBusinessBlocker[] = [];
  const missingRequiredCount = input.missingRequiredCount || 0;
  if (missingRequiredCount > 0) blockers.push({ id: 'pgd-required-documents', title: 'Thiếu tài liệu hồ sơ', reason: `${missingRequiredCount} tài liệu bắt buộc chưa có bản hiện hành trong checklist PGD.`, severity: 'HARD', target: 'DOCUMENTS', source: 'dossierChecklist' });
  const assignment = (input.assignments || []).find((item) => item.requestId === requestId);
  if (new Set(['FIELD_INSPECTION', 'WAITING_LAB_RESULTS', 'RESULTS_REVIEW', 'TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', 'SIGNED']).has(String(input.request.status)) && !assignment) blockers.push({ id: 'pgd-assignment-missing', title: 'Chưa có phân công hiện trường', reason: 'Hồ sơ đã tới vùng thực hiện nhưng chưa có assignment gắn người phụ trách.', severity: 'HARD', target: 'ASSIGNMENT', source: 'assignments' });
  const summary = buildPgdSampleEvidence(input);
  if (summary.pendingLabRequestCount > 0) blockers.push({ id: 'pgd-lab-results-pending', title: 'Còn PYC PTN thiếu kết quả', reason: `${summary.pendingLabRequestCount} yêu cầu PTN chưa liên kết kết quả nhận về.`, severity: 'HARD', target: 'LAB_RESULTS', source: 'labRequests/labResults' });
  if (input.labResultReview?.conformity === 'NON_CONFORMING') blockers.push({ id: 'pgd-nonconforming-result', title: 'Kết quả cần xử lý không phù hợp', reason: input.labResultReview.conclusion || 'Bản xem xét KQTN đang đánh dấu không phù hợp.', severity: 'HARD', target: 'REVIEW', source: 'labResultReviews' });
  return blockers;
}

export function resolvePgdEvidenceNextAction(input: PgdBusinessFacts): PgdEvidenceNextAction {
  const blockers = buildPgdBusinessBlockers(input);
  const summary = buildPgdSampleEvidence(input);
  const hardBlocker = blockers.find((blocker) => blocker.severity === 'HARD');
  if (hardBlocker) { const fallback = hardBlocker.target === 'DOCUMENTS' ? getPgdcnNextAction('PGD', input.request.status, { missingRequiredCount: input.missingRequiredCount }) : getPgdcnNextAction('PGD', input.request.status); const pendingCodes = hardBlocker.target === 'LAB_RESULTS' ? summary.rows.filter((row) => row.labRequestId && !row.resultId).map((row) => row.sampleCode).filter(Boolean) : []; const label = pendingCodes.length > 0 ? 'Tiếp nhận KQTN ' + pendingCodes.join(', ') : fallback.label; return { ...fallback, label, source: 'EVIDENCE', reason: hardBlocker.reason, target: hardBlocker.target, blockerIds: blockers.map((item) => item.id) }; }
  if (summary.expectedUnits !== undefined && summary.sampledUnits < summary.expectedUnits) return { key: 'SAMPLE', label: 'Tiếp tục lấy mẫu', description: 'Tiếp tục ghi nhận các mẫu còn thiếu theo kế hoạch lấy mẫu.', source: 'EVIDENCE', reason: summary.sampledUnits + '/' + summary.expectedUnits + ' đơn vị mẫu đã ghi nhận.', target: 'FIELD', blockerIds: blockers.map((item) => item.id) };
  if (summary.pendingLabRequestCount > 0) return { key: 'RESULTS', label: 'Tiếp nhận KQTN', description: 'Đối chiếu và tiếp nhận các kết quả còn thiếu từ PTN.', source: 'EVIDENCE', reason: `${summary.pendingLabRequestCount} PYC PTN chưa có kết quả liên kết.`, target: 'LAB_RESULTS', blockerIds: blockers.map((item) => item.id) };
  if (summary.resultCount > 0 && input.labResultReview?.status !== 'FINAL') return { key: 'REVIEW_RESULTS', label: 'Đánh giá kết quả thử nghiệm', description: 'Kiểm tra độ đầy đủ và kết luận trên các KQTN đã nhận.', source: 'EVIDENCE', reason: `${summary.resultCount} kết quả đã nhận nhưng chưa có bản xem xét cuối.`, target: 'REVIEW', blockerIds: blockers.map((item) => item.id) };
  if (summary.resultCount > 0 && !input.report && !input.certificate) return { key: 'REPORT', label: 'Soạn báo cáo', description: 'Tổng hợp bằng chứng hiện có để soạn báo cáo giám định.', source: 'EVIDENCE', reason: 'KQTN đã có nhưng chưa có báo cáo hoặc chứng thư.', target: 'REPORT', blockerIds: blockers.map((item) => item.id) };
  const fallback = getPgdcnNextAction('PGD', input.request.status);
  return { ...fallback, source: 'STATUS_FALLBACK', reason: 'Chưa có bằng chứng chi tiết hơn để thay thế hành động theo trạng thái.', target: 'CURRENT_WORK', blockerIds: blockers.map((item) => item.id) };
}