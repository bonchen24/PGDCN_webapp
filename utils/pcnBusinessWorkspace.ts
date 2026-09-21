import type {
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  OutboundLabRequest,
  PcnApprovalStep,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';
import { getPgdcnNextAction, type PgdcnNextAction } from './pgdcnDashboard.ts';

export type PcnBusinessSectionKey = 'REQUEST' | 'COMMERCIAL' | 'FIELD' | 'LAB' | 'REVIEW' | 'ISSUANCE' | 'DELIVERY' | 'ARCHIVE';
export const PCN_BUSINESS_SECTION_LABELS: Record<PcnBusinessSectionKey, string> = {
  REQUEST: 'Yêu cầu & phân công',
  COMMERCIAL: 'Chứng từ lô hàng',
  FIELD: 'Đánh giá hiện trường',
  LAB: 'Mẫu & thử nghiệm',
  REVIEW: 'Xem xét / thẩm xét',
  ISSUANCE: 'Cấp chứng nhận',
  DELIVERY: 'Bàn giao',
  ARCHIVE: 'Lưu trữ',
};

export type PcnBusinessFacts = {
  dossier: CertificationDossier;
  proposal?: CertificationProposal;
  requirements: readonly PcnDocumentRequirement[];
  documents: readonly PcnDossierDocument[];
  sampleLots?: readonly PcnSampleLot[];
  sampleItems?: readonly PcnSampleItem[];
  sampleRoutes?: readonly PcnSampleRoute[];
  labRequests?: readonly OutboundLabRequest[];
  results?: readonly ReturnedTestResult[];
  approvalSteps?: readonly PcnApprovalStep[];
  issuance?: IssuancePackage;
  hasEvaluationReport?: boolean;
};

export type PcnBusinessBlocker = {
  id: string;
  title: string;
  reason: string;
  severity: 'HARD' | 'WARNING';
  target: 'DOCUMENTS' | 'ASSIGNMENT' | 'FIELD' | 'LAB' | 'REVIEW' | 'ISSUANCE' | 'DELIVERY' | 'ARCHIVE' | 'CURRENT_WORK';
  source: string;
  relatedEntityIds: string[];
};

export type PcnEvidenceNextAction = PgdcnNextAction & {
  source: 'EVIDENCE' | 'STATUS_FALLBACK';
  reason: string;
  target: PcnBusinessBlocker['target'];
  blockerIds: string[];
  relatedEntityIds: string[];
};

export type PcnSectionCompleteness = {
  key: PcnBusinessSectionKey;
  label: string;
  totalRequirements: number;
  presentRequirements: number;
  missingRequiredRequirements: number;
  status: 'DONE' | 'IN_PROGRESS' | 'BLOCKED' | 'NOT_STARTED';
  reason: string;
};

export type PcnSampleEvidenceRow = {
  id: string;
  sampleItemId?: string;
  sampleLotId?: string;
  sampleCode: string;
  title: string;
  lotCode?: string;
  routeIds: string[];
  routeLabels: string[];
  pycNumbers: string[];
  resultIds: string[];
  resultOutcomes: ReturnedTestResult['outcome'][];
  state: string;
  stateTone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
};

export type PcnSampleEvidenceSummary = {
  expectedSampleCount?: number;
  sampledSampleCount: number;
  labRequestCount: number;
  resultCount: number;
  pendingResultCount: number;
  rows: PcnSampleEvidenceRow[];
};

export type PcnTestEvidenceRow = {
  id: string;
  pycNumber: string;
  laboratoryName: string;
  sampleCodes: string[];
  routeLabel?: string;
  state: string;
  stateTone: PcnSampleEvidenceRow['stateTone'];
  result?: ReturnedTestResult;
};

function normalizeCode(value?: string): string {
  return String(value || '').trim().toUpperCase();
}

function requirementPresent(requirement: PcnDocumentRequirement, documents: readonly PcnDossierDocument[], waivers?: CertificationDossier['documentWaivers']): boolean {
  return documents.some((document) => document.requirementId === requirement.id && document.status === 'PRESENT') || Boolean(waivers?.[requirement.id]);
}

export function getPcnBusinessSectionForRequirement(requirement: Pick<PcnDocumentRequirement, 'code' | 'name' | 'stages' | 'stationKeys'>): PcnBusinessSectionKey {
  const code = normalizeCode(requirement.code);
  if (code === 'COMMERCIAL' || /hợp đồng|hóa đơn|invoice|packing|vận đơn|bill|c\/o|tờ khai|commercial|customs/i.test(requirement.name)) return 'COMMERCIAL';
  if (['PROPOSAL', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN'].includes(code)) return 'REQUEST';
  if (code === 'FIELD_INSPECTION' || /hiện trường|field/i.test(requirement.name)) return 'FIELD';
  if (['LAB_REQUEST', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN'].includes(code) || /mẫu|PYC.*PTN|lab request/i.test(requirement.name)) return 'LAB';
  if (['TEST_REPORT', 'CERTIFICATION_RESULT', 'EXTENSION_LETTER', 'CORRECTIVE_ACTION_LETTER', 'FAILURE_LETTER'].includes(code) || /KQTN|kết quả|thẩm xét|technical|corrective/i.test(requirement.name)) return 'REVIEW';
  if (['CERTIFICATE', 'DECISION'].includes(code) || /chứng nhận|chứng thư|quyết định|issuance/i.test(requirement.name)) return 'ISSUANCE';
  if (code === 'CLIENT_PACKAGE' || /bàn giao|khách hàng|delivery/i.test(requirement.name)) return 'DELIVERY';
  if (code === 'ARCHIVE_SCAN' || /lưu hồ sơ|archive/i.test(requirement.name)) return 'ARCHIVE';
  const stations = new Set(requirement.stationKeys || []);
  if (stations.has('SAMPLING_LAB')) return 'LAB';
  if (stations.has('RESULTS') || stations.has('TECHNICAL_REVIEW')) return 'REVIEW';
  if (stations.has('APPROVAL') || stations.has('ISSUANCE')) return 'ISSUANCE';
  if (stations.has('DELIVERY_ARCHIVE')) return 'DELIVERY';
  if (requirement.stages[0] === 'LAB_ROUTING') return 'LAB';
  if (requirement.stages[0] === 'TECHNICAL_REVIEW') return 'REVIEW';
  if (requirement.stages[0] === 'ISSUANCE') return 'ISSUANCE';
  if (requirement.stages[0] === 'DELIVERY') return 'DELIVERY';
  if (requirement.stages[0] === 'ARCHIVE') return 'ARCHIVE';
  return 'REQUEST';
}

export function buildPcnSectionCompleteness(input: Pick<PcnBusinessFacts, 'requirements' | 'documents' | 'dossier'>): PcnSectionCompleteness[] {
  return (Object.keys(PCN_BUSINESS_SECTION_LABELS) as PcnBusinessSectionKey[]).map((key) => {
    const requirements = input.requirements.filter((requirement) => getPcnBusinessSectionForRequirement(requirement) === key);
    const present = requirements.filter((requirement) => requirementPresent(requirement, input.documents, input.dossier.documentWaivers)).length;
    const missingRequired = requirements.filter((requirement) => requirement.required && !requirementPresent(requirement, input.documents, input.dossier.documentWaivers)).length;
    const status = missingRequired > 0 ? 'BLOCKED' : present > 0 && present === requirements.length ? 'DONE' : present > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
    return { key, label: PCN_BUSINESS_SECTION_LABELS[key], totalRequirements: requirements.length, presentRequirements: present, missingRequiredRequirements: missingRequired, status, reason: requirements.length === 0 ? 'Chưa có yêu cầu được định tuyến.' : present + '/' + requirements.length + ' yêu cầu có bằng chứng.' };
  });
}

function routesForItem(item: PcnSampleItem, lot: PcnSampleLot | undefined, routes: readonly PcnSampleRoute[]): PcnSampleRoute[] {
  return routes.filter((route) => {
    if (route.sampleItemIds?.includes(item.id)) return true;
    return !route.sampleItemIds?.length && route.sampleLotId === lot?.id;
  });
}

function requestsForItem(item: PcnSampleItem, lot: PcnSampleLot | undefined, routes: readonly PcnSampleRoute[], requests: readonly OutboundLabRequest[]): OutboundLabRequest[] {
  const itemRoutes = routesForItem(item, lot, routes);
  return requests.filter((request) => request.sampleItemIds?.includes(item.id) || (request.sampleRouteId && itemRoutes.some((route) => route.id === request.sampleRouteId)) || (request.sampleLotId && request.sampleLotId === lot?.id && !request.sampleItemIds?.length && !request.sampleRouteId));
}

function resultsForRequests(requests: readonly OutboundLabRequest[], results: readonly ReturnedTestResult[]): ReturnedTestResult[] {
  const requestIds = new Set(requests.map((request) => request.id));
  return results.filter((result) => requestIds.has(result.labRequestId));
}

export function buildPcnSampleEvidence(input: Pick<PcnBusinessFacts, 'sampleLots' | 'sampleItems' | 'sampleRoutes' | 'labRequests' | 'results'>): PcnSampleEvidenceSummary {
  const lots = input.sampleLots || [];
  const items = input.sampleItems || [];
  const routes = input.sampleRoutes || [];
  const requests = input.labRequests || [];
  const results = input.results || [];
  const rows: PcnSampleEvidenceRow[] = [];
  const sourceItems = items.length > 0
    ? items.map((item) => ({ item, lot: lots.find((lot) => lot.id === item.sampleLotId) }))
    : lots.map((lot) => ({ item: undefined, lot }));
  for (const source of sourceItems) {
    const item = source.item;
    const lot = source.lot;
    const itemRoutes = item ? routesForItem(item, lot, routes) : routes.filter((route) => route.sampleLotId === lot?.id);
    const itemRequests = item ? requestsForItem(item, lot, routes, requests) : requests.filter((request) => request.sampleLotId === lot?.id);
    const itemResults = resultsForRequests(itemRequests, results);
    const expectedLabs = item?.testLabCodes || itemRoutes.map((route) => route.labCode);
    const hasNoRoute = expectedLabs.length === 0 && itemRoutes.length === 0;
    const hasMissingRequest = !hasNoRoute && itemRequests.length < new Set(expectedLabs).size;
    const hasMissingResult = itemRequests.some((request) => !itemResults.some((result) => result.labRequestId === request.id));
    const allResultsReturned = itemRequests.length > 0 && itemRequests.every((request) => itemResults.some((result) => result.labRequestId === request.id));
    const state = hasNoRoute ? 'Chưa định tuyến PYC' : hasMissingRequest ? 'Chưa lập đủ PYC' : hasMissingResult ? 'Còn thiếu KQTN' : allResultsReturned ? 'Đã đủ KQTN' : 'Đang xử lý';
    const stateTone = hasNoRoute || hasMissingRequest ? 'warning' : hasMissingResult ? 'warning' : allResultsReturned ? 'success' : 'info';
    rows.push({
      id: item?.id || lot?.id || 'sample-unknown',
      sampleItemId: item?.id,
      sampleLotId: lot?.id,
      sampleCode: item?.sampleCode || lot?.lotCode || 'Mẫu chưa mã hóa',
      title: item ? item.sampleType + (item.model ? ' · Model ' + item.model : '') : lot?.sampleName || 'Lô mẫu',
      lotCode: lot?.lotCode,
      routeIds: itemRoutes.map((route) => route.id),
      routeLabels: itemRoutes.map((route) => route.labName || route.labCode),
      pycNumbers: itemRequests.map((request) => request.pycNumber),
      resultIds: itemResults.map((result) => result.id),
      resultOutcomes: itemResults.map((result) => result.outcome),
      state,
      stateTone,
    });
  }
  const uniqueResults = new Set(results.map((result) => result.id));
  return { expectedSampleCount: sourceItems.length > 0 ? sourceItems.length : undefined, sampledSampleCount: sourceItems.length, labRequestCount: new Set(requests.map((request) => request.id)).size, resultCount: uniqueResults.size, pendingResultCount: rows.filter((row) => row.state === 'Còn thiếu KQTN').length, rows };
}

export function buildPcnTestEvidence(input: Pick<PcnBusinessFacts, 'sampleLots' | 'sampleItems' | 'sampleRoutes' | 'labRequests' | 'results'>): PcnTestEvidenceRow[] {
  const routes = input.sampleRoutes || [];
  const items = input.sampleItems || [];
  const lots = input.sampleLots || [];
  const results = input.results || [];
  return (input.labRequests || []).map((request) => {
    const linkedItems = items.filter((item) => request.sampleItemIds?.includes(item.id));
    const route = routes.find((candidate) => candidate.id === request.sampleRouteId);
    const linkedLot = lots.find((lot) => lot.id === request.sampleLotId) || (route ? lots.find((lot) => lot.id === route.sampleLotId) : undefined);
    const linkedResult = results.find((result) => result.labRequestId === request.id);
    return { id: request.id, pycNumber: request.pycNumber, laboratoryName: request.laboratoryName, sampleCodes: linkedItems.map((item) => item.sampleCode), routeLabel: route?.labName, state: linkedResult ? 'Đã nhận KQTN' : request.status, stateTone: linkedResult?.outcome === 'FAIL' ? 'danger' : linkedResult ? 'success' : 'warning', result: linkedResult };
  });
}

export function buildPcnBusinessBlockers(input: PcnBusinessFacts): PcnBusinessBlocker[] {
  const blockers: PcnBusinessBlocker[] = [];
  const missingDocuments = input.requirements.filter((requirement) => requirement.required && !requirementPresent(requirement, input.documents, input.dossier.documentWaivers));
  if (missingDocuments.length > 0) blockers.push({ id: 'pcn-required-documents', title: 'Thiếu tài liệu bắt buộc', reason: missingDocuments.length + ' yêu cầu bắt buộc chưa có bản hiện hành hoặc miễn lệ hợp lệ.', severity: 'HARD', target: 'DOCUMENTS', source: 'requirements/documents', relatedEntityIds: missingDocuments.map((requirement) => requirement.id) });
  if (!input.dossier.ownerUsername && ['ASSIGNED', 'PLAN_PENDING_APPROVAL', 'FIELD_EVALUATION', 'AWAITING_SAMPLING', 'SENT_TO_LAB', 'AWAITING_RESULTS', 'TECHNICAL_REVIEW', 'WAITING_APPROVAL'].includes(input.dossier.status)) blockers.push({ id: 'pcn-owner-missing', title: 'Chưa có chủ hồ sơ', reason: 'Hồ sơ đang ở bước xử lý nhưng chưa có người chịu trách nhiệm.', severity: 'HARD', target: 'ASSIGNMENT', source: 'dossier.ownerUsername', relatedEntityIds: [input.dossier.id] });
  const summary = buildPcnSampleEvidence(input);
  for (const row of summary.rows.filter((candidate) => candidate.state === 'Chưa lập đủ PYC')) blockers.push({ id: 'pcn-pyc-' + row.id, title: 'Chưa lập đủ PYC PTN ' + row.sampleCode, reason: 'Mẫu đã có tuyến thử nhưng chưa có đủ PYC liên kết.', severity: 'HARD', target: 'LAB', source: 'sampleItems/sampleRoutes/labRequests', relatedEntityIds: [row.id, ...row.routeIds] });
  for (const row of summary.rows.filter((candidate) => candidate.state === 'Còn thiếu KQTN')) blockers.push({ id: 'pcn-result-' + row.id, title: 'Thiếu KQTN ' + row.sampleCode, reason: 'Đã có PYC liên kết nhưng chưa có kết quả trả về cho tất cả tuyến.', severity: 'HARD', target: 'LAB', source: 'labRequests/results', relatedEntityIds: [row.id, ...row.routeIds] });
  for (const result of input.results || []) if (result.outcome === 'FAIL') blockers.push({ id: 'pcn-failed-result-' + result.id, title: 'KQTN không đạt cần xử lý', reason: result.notes || 'Kết quả thử nghiệm có trạng thái không đạt.', severity: 'HARD', target: 'REVIEW', source: 'returnedResults', relatedEntityIds: [result.id, result.labRequestId] });
  return blockers;
}

export function resolvePcnEvidenceNextAction(input: PcnBusinessFacts): PcnEvidenceNextAction {
  const blockers = buildPcnBusinessBlockers(input);
  const summary = buildPcnSampleEvidence(input);
  const hardBlocker = blockers.find((blocker) => blocker.severity === 'HARD');
  if (hardBlocker) {
    const fallback = getPgdcnNextAction('PCN', input.dossier.status, { missingRequiredCount: hardBlocker.target === 'DOCUMENTS' ? 1 : 0 });
    const pendingRow = summary.rows.find((row) => row.state === 'Còn thiếu KQTN');
    const label = hardBlocker.target === 'LAB' && pendingRow ? 'Tiếp nhận KQTN ' + pendingRow.sampleCode : fallback.label;
    return { ...fallback, label, source: 'EVIDENCE', reason: hardBlocker.reason, target: hardBlocker.target, blockerIds: blockers.map((blocker) => blocker.id), relatedEntityIds: hardBlocker.relatedEntityIds };
  }
  if (summary.rows.some((row) => row.state === 'Chưa định tuyến PYC' || row.state === 'Chưa lập đủ PYC')) return { key: 'SAMPLE', label: 'Hoàn thiện tuyến mẫu/PYC', description: 'Bổ sung tuyến PTN và PYC cho từng sample item trước khi chờ KQTN.', source: 'EVIDENCE', reason: 'Có mẫu chưa được định tuyến đầy đủ.', target: 'LAB', blockerIds: [], relatedEntityIds: summary.rows.filter((row) => row.state !== 'Đã đủ KQTN').map((row) => row.id) };
  if (summary.pendingResultCount > 0) return { key: 'RESULTS', label: 'Tiếp nhận KQTN', description: 'Đối chiếu PYC, mẫu và kết quả nhận về.', source: 'EVIDENCE', reason: summary.pendingResultCount + ' sample item còn thiếu kết quả.', target: 'LAB', blockerIds: [], relatedEntityIds: summary.rows.filter((row) => row.state === 'Còn thiếu KQTN').map((row) => row.id) };
  if (summary.resultCount > 0 && !input.dossier.reviewerUsername) return { key: 'REVIEW', label: 'Đánh giá kết quả thử nghiệm', description: 'Phân công và thực hiện xem xét kết quả trước khi phê duyệt.', source: 'EVIDENCE', reason: 'Đã có KQTN nhưng chưa ghi nhận người soát xét.', target: 'REVIEW', blockerIds: [], relatedEntityIds: [...(input.results || []).map((result) => result.id)] };
  if (summary.resultCount > 0 && !input.hasEvaluationReport) return { key: 'REPORT', label: 'Soạn báo cáo', description: 'Tổng hợp sample item, PYC và KQTN để soạn báo cáo đánh giá.', source: 'EVIDENCE', reason: 'KQTN đã có nhưng chưa có báo cáo đánh giá.', target: 'REVIEW', blockerIds: [], relatedEntityIds: [...(input.results || []).map((result) => result.id)] };
  if (input.dossier.status === 'WAITING_APPROVAL' || input.dossier.status === 'APPROVED') return { key: 'APPROVAL', label: 'Soát xét / phê duyệt hồ sơ', description: 'Kiểm tra bước phê duyệt và tình trạng gói cấp chứng nhận.', source: 'STATUS_FALLBACK', reason: 'Hồ sơ đang ở vùng chờ phê duyệt.', target: 'ISSUANCE', blockerIds: [], relatedEntityIds: (input.approvalSteps || []).map((step) => step.id) };
  if (input.dossier.status === 'ISSUED' || input.dossier.status === 'DELIVERED') return { key: 'DELIVERY', label: 'Bàn giao / lưu trữ', description: 'Hoàn tất bàn giao và lưu hồ sơ theo bằng chứng hiện hành.', source: 'STATUS_FALLBACK', reason: 'Hồ sơ đã phát hành và cần hoàn thiện hậu phát hành.', target: input.dossier.status === 'DELIVERED' ? 'ARCHIVE' : 'DELIVERY', blockerIds: [], relatedEntityIds: input.issuance ? [input.issuance.id] : [] };
  const fallback = getPgdcnNextAction('PCN', input.dossier.status);
  return { ...fallback, source: 'STATUS_FALLBACK', reason: 'Chưa có bằng chứng chi tiết hơn để thay thế hành động theo trạng thái.', target: 'CURRENT_WORK', blockerIds: [], relatedEntityIds: [] };
}