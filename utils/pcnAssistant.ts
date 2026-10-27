import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnDocumentRequirement, PcnDossierDocument, PcnSampleLot, PcnSampleRoute, ReturnedTestResult } from '../types.ts';
import { buildPcnDossierCompleteness } from './pcnDossierPipeline.ts';
import { isPcnInternalSampleRequest } from './pcnLabOperations.ts';
import { getPcnWorkflowStage } from './pcnWorkflowStages.ts';

export type PcnAssistantRecommendationKind = 'DOCUMENTS_MISSING' | 'OVERDUE' | 'RESULT_PENDING' | 'PYC_PENDING' | 'SAMPLE_ISSUE' | 'READY_FOR_REVIEW';
export type PcnAssistantSeverity = 'URGENT' | 'ATTENTION' | 'INFO';

export interface PcnAssistantRecommendation {
  id: string;
  kind: PcnAssistantRecommendationKind;
  severity: PcnAssistantSeverity;
  title: string;
  description: string;
  dossierId: string;
  dossierCode: string;
  actionLabel: string;
  initialTab: 'documents' | 'lab' | 'results' | 'issuance';
}

export interface PcnAssistantInput {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  labRequests: OutboundLabRequest[];
  sampleLots: PcnSampleLot[];
  sampleRoutes: PcnSampleRoute[];
  returnedResults: ReturnedTestResult[];
  now?: string;
}

export interface PcnAssistantSnapshot {
  dossiers: Array<{
    code: string;
    proposalCode?: string;
    status: CertificationDossier['status'];
    workflowStage: string;
    fieldCodes: string[];
    customer?: string;
    product?: string;
    owner?: string;
    targetDate?: string;
    completeness: {
      score: number;
      requiredDocumentPresent: number;
      requiredDocumentTotal: number;
      missingDocuments: string[];
      missingCoreFields: string[];
      station: string;
    };
  }>;
  pyc: Array<{ code: string; dossierCode?: string; status: OutboundLabRequest['status']; laboratory?: string; lotCode?: string; routeStatus?: PcnSampleRoute['status']; }>; 
  samples: Array<{ lotCode: string; dossierCode?: string; sampleName: string; quantity: number; unit?: string; status: PcnSampleLot['status']; currentLocation: string; fieldCodes: string[]; }>;
  routes: Array<{ code: string; lotCode?: string; dossierCode?: string; laboratory: string; status: PcnSampleRoute['status']; pycNumber?: string; currentLocation?: string; }>;
  kqtn: Array<{ code: string; dossierCode?: string; pycNumber?: string; outcome: ReturnedTestResult['outcome']; reportNumber?: string; receivedAt: string; }>;
}

/**
 * Creates the bounded, human-readable snapshot sent to the optional AI Q&A
 * boundary. Related records are reduced to stable operational facts; file
 * contents, credentials and research-folder paths never enter this object.
 */
export function buildPcnAssistantSnapshot(input: PcnAssistantInput): PcnAssistantSnapshot {
  const proposalsById = new Map(input.proposals.map((proposal) => [proposal.id, proposal]));
  const activeDossierIds = new Set(input.dossiers.map((dossier) => dossier.id));
  const dossiersById = new Map(input.dossiers.map((dossier) => [dossier.id, dossier]));
  const activeLots = input.sampleLots.filter((lot) => activeDossierIds.has(lot.dossierId));
  const activeLotIds = new Set(activeLots.map((lot) => lot.id));
  const activeRequests = input.labRequests.filter((request) => activeDossierIds.has(request.dossierId) && isPcnInternalSampleRequest(request, input.sampleRoutes));
  const activeRequestIds = new Set(activeRequests.map((request) => request.id));
  const activeRoutes = input.sampleRoutes.filter((route) => activeLotIds.has(route.sampleLotId));
  const activeResults = input.returnedResults.filter((result) => activeDossierIds.has(result.dossierId) || activeRequestIds.has(result.labRequestId));
  const lotsById = new Map(activeLots.map((lot) => [lot.id, lot]));
  const requestsById = new Map(activeRequests.map((request) => [request.id, request]));
  const stageLabel = (status: CertificationDossier['status']): string => {
    const stage = getPcnWorkflowStage(status);
    return stage ? `Bước ${stage.number} · ${stage.title}` : 'Ngoại lệ / chưa xác định bước';
  };

  return {
    dossiers: input.dossiers.map((dossier) => {
      const proposal = proposalsById.get(dossier.proposalId);
      const completeness = buildPcnDossierCompleteness({ dossier, proposal, requirements: input.requirements, documents: input.documents });
      return {
        code: dossier.dossierCode,
        ...(proposal?.proposalCode ? { proposalCode: proposal.proposalCode } : {}),
        status: dossier.status,
        workflowStage: stageLabel(dossier.status),
        fieldCodes: [...dossier.fieldCodes],
        ...(dossier.customerSnapshot?.name || proposal?.customerSnapshot?.name ? { customer: dossier.customerSnapshot?.name || proposal?.customerSnapshot?.name } : {}),
        ...(proposal?.productName ? { product: proposal.productName } : {}),
        ...(dossier.ownerUsername ? { owner: dossier.ownerUsername } : {}),
        ...(dossier.targetDate ? { targetDate: dossier.targetDate } : {}),
        completeness: {
          score: completeness.score,
          requiredDocumentPresent: completeness.requiredDocumentPresent,
          requiredDocumentTotal: completeness.requiredDocumentTotal,
          missingDocuments: [...completeness.missingLabels],
          missingCoreFields: [...completeness.missingCoreLabels],
          station: completeness.station.title,
        },
      };
    }),
    pyc: activeRequests.map((request) => {
      const route = request.sampleRouteId ? input.sampleRoutes.find((candidate) => candidate.id === request.sampleRouteId) : undefined;
      const lot = request.sampleLotId ? lotsById.get(request.sampleLotId) : undefined;
      return {
        code: request.pycNumber,
        dossierCode: dossiersById.get(request.dossierId)?.dossierCode,
        status: request.status,
        ...(request.laboratoryName ? { laboratory: request.laboratoryName } : {}),
        ...(lot?.lotCode ? { lotCode: lot.lotCode } : {}),
        ...(route?.status ? { routeStatus: route.status } : {}),
      };
    }),
    samples: activeLots.map((lot) => ({
      lotCode: lot.lotCode,
      dossierCode: dossiersById.get(lot.dossierId)?.dossierCode,
      sampleName: lot.sampleName,
      quantity: lot.quantity,
      ...(lot.unit ? { unit: lot.unit } : {}),
      status: lot.status,
      currentLocation: lot.currentLocation,
      fieldCodes: [...lot.fieldCodes],
    })),
    routes: activeRoutes.map((route) => {
      const lot = lotsById.get(route.sampleLotId);
      const request = route.labRequestId ? requestsById.get(route.labRequestId) : undefined;
      return {
        code: route.id,
        ...(lot?.lotCode ? { lotCode: lot.lotCode } : {}),
        dossierCode: lot ? dossiersById.get(lot.dossierId)?.dossierCode : undefined,
        laboratory: route.labName,
        status: route.status,
        ...(request?.pycNumber ? { pycNumber: request.pycNumber } : {}),
        ...(lot?.currentLocation ? { currentLocation: lot.currentLocation } : {}),
      };
    }),
    kqtn: activeResults.map((result) => ({
      code: result.id,
      dossierCode: dossiersById.get(result.dossierId)?.dossierCode,
      pycNumber: requestsById.get(result.labRequestId)?.pycNumber,
      outcome: result.outcome,
      ...(result.reportNumber ? { reportNumber: result.reportNumber } : {}),
      receivedAt: result.receivedAt,
    })),
  };
}

function isPast(value: string | undefined, now: number): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time < now;
}

/** Explainable read-only recommendations; no mutation or external AI call. */
export function buildPcnAssistantRecommendations(input: PcnAssistantInput): PcnAssistantRecommendation[] {
  const now = Date.parse(input.now || new Date().toISOString());
  const proposals = new Map(input.proposals.map((proposal) => [proposal.id, proposal]));
  const recommendations: PcnAssistantRecommendation[] = [];
  for (const dossier of input.dossiers) {
    const proposal = proposals.get(dossier.proposalId);
    const completeness = buildPcnDossierCompleteness({ dossier, proposal, requirements: input.requirements, documents: input.documents });
    const workflowStage = getPcnWorkflowStage(dossier.status);
    const workflowLabel = workflowStage ? `Bước ${workflowStage.number} · ${workflowStage.title}` : 'nhánh ngoại lệ';
    if (completeness.missingRequirementIds.length > 0) {
      recommendations.push({ id: `${dossier.id}:documents`, kind: 'DOCUMENTS_MISSING', severity: 'ATTENTION', title: 'Hồ sơ còn tài liệu bắt buộc', description: `Còn ${completeness.missingRequirementIds.length} mục bắt buộc chưa có phiên hiện hành hoặc waiver hợp lệ.`, dossierId: dossier.id, dossierCode: dossier.dossierCode, actionLabel: 'Mở tài liệu hồ sơ', initialTab: 'documents' });
    }
    if (isPast(dossier.targetDate, now) && !['ARCHIVED', 'DELIVERED', 'CANCELLED', 'REJECTED'].includes(dossier.status)) {
      recommendations.push({ id: `${dossier.id}:overdue`, kind: 'OVERDUE', severity: 'URGENT', title: 'Hồ sơ đã quá hạn', description: `Hạn xử lý ${dossier.targetDate} đã qua; cần chủ hồ sơ xác định việc tiếp theo tại ${workflowLabel}.`, dossierId: dossier.id, dossierCode: dossier.dossierCode, actionLabel: 'Mở hồ sơ', initialTab: 'documents' });
    }
    const requests = input.labRequests.filter((request) => (request.dossierId === dossier.id || dossier.labRequestIds.includes(request.id)) && isPcnInternalSampleRequest(request, input.sampleRoutes));
    const results = input.returnedResults.filter((result) => result.dossierId === dossier.id);
    const routes = input.sampleRoutes.filter((route) => input.sampleLots.some((lot) => lot.id === route.sampleLotId && lot.dossierId === dossier.id));
    if (['AWAITING_SAMPLING', 'SENT_TO_LAB'].includes(dossier.status) && (requests.length === 0 || routes.some((route) => ['PENDING', 'ISSUE'].includes(route.status)))) {
      recommendations.push({ id: `${dossier.id}:pyc`, kind: 'PYC_PENDING', severity: 'ATTENTION', title: 'PYC hoặc tuyến mẫu cần xử lý', description: 'Hồ sơ đang ở bước lấy mẫu & gửi PTN nhưng còn PYC/tuyến mẫu chờ giao hoặc có sự cố.', dossierId: dossier.id, dossierCode: dossier.dossierCode, actionLabel: 'Mở Mẫu & PYC', initialTab: 'lab' });
    }
    if (['AWAITING_RESULTS', 'CORRECTIVE_ACTION'].includes(dossier.status) && results.length === 0) {
      recommendations.push({ id: `${dossier.id}:results`, kind: 'RESULT_PENDING', severity: 'URGENT', title: 'Đang chờ KQTN từ PTN', description: 'PYC đã gửi/đã được PTN nhận nhưng chưa có kết quả scan được tiếp nhận.', dossierId: dossier.id, dossierCode: dossier.dossierCode, actionLabel: 'Mở KQTN', initialTab: 'results' });
    }
    const issue = requests.find((request) => request.sampleIssue?.description) || routes.find((route) => route.status === 'ISSUE');
    if (issue) {
      recommendations.push({ id: `${dossier.id}:issue`, kind: 'SAMPLE_ISSUE', severity: 'URGENT', title: 'Có sự cố mẫu cần giải quyết', description: 'Kiểm tra biên bản giao nhận, tình trạng mẫu và ghi nhận hướng xử lý trong card hồ sơ.', dossierId: dossier.id, dossierCode: dossier.dossierCode, actionLabel: 'Mở Mẫu & PYC', initialTab: 'lab' });
    }
    if (dossier.status === 'TECHNICAL_REVIEW' && completeness.missingRequirementIds.length === 0) {
      recommendations.push({ id: `${dossier.id}:review`, kind: 'READY_FOR_REVIEW', severity: 'INFO', title: 'Hồ sơ đủ điều kiện soát xét', description: 'Danh mục tài liệu bắt buộc đã đủ; người soát xét có thể kiểm tra trực quan và chuyển bộ trình phê duyệt.', dossierId: dossier.id, dossierCode: dossier.dossierCode, actionLabel: 'Mở hồ sơ', initialTab: 'documents' });
    }
  }
  return recommendations.sort((left, right) => (left.severity === 'URGENT' ? -1 : left.severity === 'ATTENTION' && right.severity !== 'URGENT' ? -1 : 1) || left.dossierCode.localeCompare(right.dossierCode, 'vi'));
}

export function filterPcnAssistantRecommendations(items: PcnAssistantRecommendation[], query = ''): PcnAssistantRecommendation[] {
  const normalized = String(query || '').trim().toLocaleLowerCase('vi-VN');
  if (!normalized) return items;
  return items.filter((item) => `${item.title} ${item.description} ${item.dossierCode}`.toLocaleLowerCase('vi-VN').includes(normalized));
}
