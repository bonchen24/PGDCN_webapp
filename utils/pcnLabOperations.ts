import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnSampleLabCode,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';
import { derivePcnSampleRouteReadiness, sortPcnSampleRoutes } from './pcnSampleFlow.ts';

export interface PcnLabOperationsInput {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  sampleLots: PcnSampleLot[];
  sampleItems?: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
}

export interface PcnLabOperationsRow {
  id: string;
  dossierId: string;
  dossierCode: string;
  proposalCode: string;
  customerName: string;
  productName: string;
  fieldCode: string;
  lotId?: string;
  lotCode?: string;
  sampleName?: string;
  quantity?: number;
  unit?: string;
  laboratoryName: string;
  labCode?: PcnSampleLabCode;
  routeId?: string;
  pycId?: string;
  pycNumber?: string;
  pycStatus?: OutboundLabRequest['status'];
  routeStatus?: PcnSampleRoute['status'];
  currentLocation?: string;
  requestedAt?: string;
  sentAt?: string;
  receivedAt?: string;
  resultReturnedAt?: string;
  resultOutcome?: ReturnedTestResult['outcome'];
  resultReportNumber?: string;
  issueDescription?: string;
  ownerUsername?: string;
}

export interface PcnSampleFlowRouteProjection {
  routeId: string;
  sequence: number;
  labCode: PcnSampleRoute['labCode'];
  labName: string;
  routeStatus: PcnSampleRoute['status'];
  sampleItemIds?: string[];
  readiness: 'COMPLETED' | 'CURRENT' | 'READY' | 'BLOCKED' | 'CANCELLED';
  labRequestId?: string;
  pycId?: string;
  pycNumber?: string;
  pycStatus?: OutboundLabRequest['status'];
  pycSyncStatus?: NonNullable<OutboundLabRequest['integration']>['syncStatus'];
  externalRequestCode?: string;
  hasLabRequest: boolean;
  executionStatus: NonNullable<PcnSampleRoute['execution']>['status'];
  executionScheduledDate?: string;
  executionStartedAt?: string;
  executionCompletedAt?: string;
  executionOutcome?: NonNullable<PcnSampleRoute['execution']>['outcome'];
  executionSourceSystemCode?: string;
  resultOutcome?: ReturnedTestResult['outcome'];
  resultReportNumber?: string;
  requestedAt?: string;
  sentAt?: string;
  receivedAt?: string;
  resultReturnedAt?: string;
  issueDescription?: string;
}

export interface PcnUnlinkedLabRequestProjection {
  requestId: string;
  pycNumber: string;
  laboratoryName: string;
  pycStatus: OutboundLabRequest['status'];
  requestedAt: string;
  issueDescription?: string;
}

export interface PcnSampleFlowProjection {
  id: string;
  dossierId: string;
  dossierCode: string;
  proposalCode: string;
  customerName: string;
  productName: string;
  lotId: string;
  lotCode: string;
  sampleItemId: string;
  sampleCode: string;
  sampleType: string;
  model: string;
  /** Legacy display alias retained for downstream document/search callers. */
  sampleName?: string;
  brand?: string;
  quantity: number;
  unit?: string;
  lotStatus: PcnSampleLot['status'];
  currentLocation: string;
  activeRouteId?: string;
  activeRouteCount: number;
  hasDataIssue: boolean;
  routes: PcnSampleFlowRouteProjection[];
  unlinkedPyc: PcnUnlinkedLabRequestProjection[];
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function getSampleItemsForLot(sampleItems: PcnSampleItem[], lot: PcnSampleLot): PcnSampleItem[] {
  const linked = sampleItems.filter((item) => item.sampleLotId === lot.id && (!lot.sampleItemIds || lot.sampleItemIds.includes(item.id)));
  if (linked.length > 0) return linked;
  return [{
    id: `${lot.id}-legacy-item`,
    sampleLotId: lot.id,
    sampleCode: lot.lotCode,
    sampleType: clean(lot.sampleName) || 'Chưa cập nhật loại mẫu',
    model: clean(lot.model) || clean(lot.sampleName) || 'Chưa cập nhật model',
    ...(clean(lot.brand) ? { brand: clean(lot.brand) } : {}),
    quantity: lot.quantity,
    ...(clean(lot.unit) ? { unit: clean(lot.unit) } : {}),
  }];
}

function routeAppliesToItem(route: PcnSampleRoute, sampleItemId: string): boolean {
  return !route.sampleItemIds || route.sampleItemIds.length === 0 || route.sampleItemIds.includes(sampleItemId);
}

function routeSnapshotForItem(route: PcnSampleRoute, sampleItemId: string): PcnSampleRoute {
  const itemSnapshot = route.itemSnapshots?.[sampleItemId];
  if (!itemSnapshot) return route;
  return { ...route, ...itemSnapshot };
}

function derivePcnSampleItemLocation(routes: PcnSampleRoute[], fallback: string): string {
  if (routes.length === 0) return fallback;
  if (routes.some((route) => route.status === 'ISSUE' || route.execution?.status === 'BLOCKED')) return 'Cần xử lý mẫu';
  if (routes.every((route) => route.status === 'CLOSED' || route.status === 'CANCELLED')) return 'Đã hoàn tất';
  const receivedLabs = routes.filter((route) => route.status === 'RECEIVED').map((route) => route.labName).filter(Boolean);
  if (receivedLabs.length > 0) return Array.from(new Set(receivedLabs)).join(' · ');
  const inTransitLabs = routes.filter((route) => route.status === 'SENT').map((route) => route.labName).filter(Boolean);
  if (inTransitLabs.length > 0) return `Đang luân chuyển tới ${Array.from(new Set(inTransitLabs)).join(' · ')}`;
  if (routes.some((route) => route.status === 'RESULT_RETURNED')) return 'Chờ PCN tiếp nhận KQTN';
  if (routes.some((route) => route.status === 'RETURNED_TO_PCN')) return 'Kho PCN';
  return fallback;
}

function resultForRequest(results: ReturnedTestResult[], requestId?: string): ReturnedTestResult | undefined {
  return results
    .filter((result) => Boolean(requestId) && result.labRequestId === requestId)
    .sort((left, right) => String(right.receivedAt || '').localeCompare(String(left.receivedAt || '')))[0];
}

/**
 * Read-only compatibility projection for older PYC consumers.
 * A route remains the primary row here; the active management view uses the
 * item-centered projection below. An outbound PYC without a route is retained so
 * that management can see and resolve incomplete linkage instead of losing it.
 */
export function buildPcnLabOperationsRows(input: PcnLabOperationsInput): PcnLabOperationsRow[] {
  const proposals = new Map(input.proposals.map((proposal) => [proposal.id, proposal]));
  const lots = new Map(input.sampleLots.map((lot) => [lot.id, lot]));
  const routesByLot = new Map<string, PcnSampleRoute[]>();
  for (const route of input.sampleRoutes) routesByLot.set(route.sampleLotId, [...(routesByLot.get(route.sampleLotId) || []), route]);
  const requestsById = new Map(input.labRequests.map((request) => [request.id, request]));
  const usedRequestIds = new Set<string>();
  const rows: PcnLabOperationsRow[] = [];

  for (const dossier of input.dossiers) {
    const proposal = proposals.get(dossier.proposalId);
    const dossierLots = input.sampleLots.filter((lot) => lot.dossierId === dossier.id || dossier.sampleLotIds?.includes(lot.id));
    const dossierLotIds = new Set(dossierLots.map((lot) => lot.id));
    const dossierRoutes = input.sampleRoutes.filter((route) => dossierLotIds.has(route.sampleLotId));
    const dossierRequests = input.labRequests.filter((request) => request.dossierId === dossier.id || dossier.labRequestIds.includes(request.id));
    const base = {
      dossierId: dossier.id,
      dossierCode: dossier.dossierCode,
      proposalCode: proposal?.proposalCode || 'Chưa có mã Đề nghị',
      customerName: (dossier.customerSnapshot || proposal?.customerSnapshot)?.name || 'Chưa cập nhật',
      productName: proposal?.productName || 'Chưa cập nhật',
      ownerUsername: dossier.ownerUsername,
    };

    for (const route of dossierRoutes) {
      const lot = lots.get(route.sampleLotId);
      const request = route.labRequestId ? requestsById.get(route.labRequestId) : dossierRequests.find((item) => item.sampleRouteId === route.id);
      if (request) usedRequestIds.add(request.id);
      const result = resultForRequest(input.returnedResults, request?.id);
      rows.push({
        id: `route:${route.id}`,
        ...base,
        fieldCode: request?.fieldCode || lot?.fieldCodes?.join(', ') || dossier.fieldCodes.join(', '),
        ...(lot ? { lotId: lot.id, lotCode: lot.lotCode, sampleName: lot.sampleName, quantity: lot.quantity, unit: lot.unit, currentLocation: lot.currentLocation } : {}),
        laboratoryName: route.labName || request?.laboratoryName || 'Chưa xác định phòng thử',
        labCode: route.labCode,
        routeId: route.id,
        ...(request ? { pycId: request.id, pycNumber: request.pycNumber, pycStatus: request.status, requestedAt: request.requestedAt, issueDescription: request.sampleIssue?.description } : {}),
        routeStatus: route.status,
        sentAt: route.sentAt,
        receivedAt: route.receivedAt,
        resultReturnedAt: route.resultReturnedAt,
        ...(result ? { resultOutcome: result.outcome, resultReportNumber: result.reportNumber } : {}),
      });
    }

    for (const request of dossierRequests) {
      if (usedRequestIds.has(request.id)) continue;
      const lot = request.sampleLotId ? lots.get(request.sampleLotId) : undefined;
      const route = request.sampleRouteId ? input.sampleRoutes.find((item) => item.id === request.sampleRouteId) : undefined;
      const result = resultForRequest(input.returnedResults, request.id);
      rows.push({
        id: `pyc:${request.id}`,
        ...base,
        fieldCode: request.fieldCode,
        ...(lot ? { lotId: lot.id, lotCode: lot.lotCode, sampleName: lot.sampleName, quantity: lot.quantity, unit: lot.unit, currentLocation: lot.currentLocation } : {}),
        laboratoryName: request.laboratoryName || route?.labName || 'Chưa xác định phòng thử',
        ...(route ? { labCode: route.labCode, routeId: route.id, routeStatus: route.status, sentAt: route.sentAt, receivedAt: route.receivedAt, resultReturnedAt: route.resultReturnedAt } : {}),
        pycId: request.id,
        pycNumber: request.pycNumber,
        pycStatus: request.status,
        requestedAt: request.requestedAt,
        ...(request.sampleIssue?.description ? { issueDescription: request.sampleIssue.description } : {}),
        ...(result ? { resultOutcome: result.outcome, resultReportNumber: result.reportNumber } : {}),
      });
    }
  }

  return rows.sort((left, right) => String(right.sentAt || right.requestedAt || '').localeCompare(String(left.sentAt || left.requestedAt || '')) || left.dossierCode.localeCompare(right.dossierCode, 'vi'));
}

export function filterPcnLabOperationsRows(rows: PcnLabOperationsRow[], query = ''): PcnLabOperationsRow[] {
  const normalized = clean(query).toLocaleLowerCase('vi-VN');
  if (!normalized) return rows;
  return rows.filter((row) => [row.dossierCode, row.proposalCode, row.customerName, row.productName, row.fieldCode, row.lotCode, row.sampleName, row.laboratoryName, row.pycNumber, row.currentLocation, row.resultReportNumber, row.issueDescription].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(normalized));
}

function exactRequestForRoute(
  route: PcnSampleRoute,
  lot: PcnSampleLot,
  dossier: CertificationDossier,
  requestsById: Map<string, OutboundLabRequest>,
  requests: OutboundLabRequest[],
): OutboundLabRequest | undefined {
  const matches = (request: OutboundLabRequest) => request.dossierId === dossier.id
    && request.sampleLotId === lot.id
    && (!request.sampleRouteId || request.sampleRouteId === route.id);
  if (route.labRequestId) {
    const request = requestsById.get(route.labRequestId);
    return request && matches(request) ? request : undefined;
  }
  return requests.find((request) => request.sampleRouteId === route.id && matches(request));
}

function projectUnlinkedPyc(request: OutboundLabRequest): PcnUnlinkedLabRequestProjection {
  return {
    requestId: request.id,
    pycNumber: request.pycNumber,
    laboratoryName: request.laboratoryName,
    pycStatus: request.status,
    requestedAt: request.requestedAt,
    ...(request.sampleIssue?.description ? { issueDescription: request.sampleIssue.description } : {}),
  };
}

/** Sample-centered, read-only projection for the management screen. */
export function buildPcnSampleFlowProjections(input: PcnLabOperationsInput): PcnSampleFlowProjection[] {
  const proposals = new Map(input.proposals.map((proposal) => [proposal.id, proposal]));
  const requestsById = new Map(input.labRequests.map((request) => [request.id, request]));
  const sampleItems = input.sampleItems || [];
  const usedRequestIds = new Set<string>();
  const projections: PcnSampleFlowProjection[] = [];

  for (const dossier of input.dossiers) {
    const proposal = proposals.get(dossier.proposalId);
    const dossierLots = input.sampleLots.filter((lot) => lot.dossierId === dossier.id || dossier.sampleLotIds?.includes(lot.id));
    const dossierRequests = input.labRequests.filter((request) => request.dossierId === dossier.id || dossier.labRequestIds?.includes(request.id));
    const base = {
      dossierId: dossier.id,
      dossierCode: dossier.dossierCode,
      proposalCode: proposal?.proposalCode || 'Chưa có mã Đề nghị',
      customerName: dossier.customerSnapshot?.name || proposal?.customerSnapshot?.name || 'Chưa cập nhật',
      productName: proposal?.productName || 'Chưa cập nhật',
    };

    for (const lot of dossierLots) {
      const lotRoutes = sortPcnSampleRoutes(input.sampleRoutes.filter((route) => route.sampleLotId === lot.id));
      for (const [itemIndex, item] of getSampleItemsForLot(sampleItems, lot).entries()) {
        const itemRoutes = lotRoutes.filter((route) => routeAppliesToItem(route, item.id)).map((route) => routeSnapshotForItem(route, item.id));
        const readiness = derivePcnSampleRouteReadiness(itemRoutes);
        const routes: PcnSampleFlowRouteProjection[] = itemRoutes.map((route, index) => {
          const request = exactRequestForRoute(route, lot, dossier, requestsById, dossierRequests);
          if (request) usedRequestIds.add(request.id);
          const formalResult = resultForRequest(input.returnedResults, request?.id);
          const execution = route.execution;
          return {
            routeId: route.id,
            sequence: Number.isInteger(route.sequence) && (route.sequence || 0) > 0 ? route.sequence as number : index + 1,
            labCode: route.labCode,
            labName: route.labName,
            routeStatus: route.status,
            ...(route.sampleItemIds?.length ? { sampleItemIds: route.sampleItemIds } : {}),
            readiness: readiness[route.id],
            ...(request ? { labRequestId: request.id, pycId: request.id, pycNumber: request.pycNumber, pycStatus: request.status, hasLabRequest: true, requestedAt: request.requestedAt } : { hasLabRequest: false }),
            ...(request?.integration?.syncStatus ? { pycSyncStatus: request.integration.syncStatus } : {}),
            ...(request?.integration?.externalRequestCode ? { externalRequestCode: request.integration.externalRequestCode } : {}),
            executionStatus: execution?.status || 'UNSCHEDULED',
            ...(execution?.scheduledDate ? { executionScheduledDate: execution.scheduledDate } : {}),
            ...(execution?.startedAt ? { executionStartedAt: execution.startedAt } : {}),
            ...(execution?.completedAt ? { executionCompletedAt: execution.completedAt } : {}),
            ...(execution?.outcome ? { executionOutcome: execution.outcome } : {}),
            ...(execution?.sourceSystemCode ? { executionSourceSystemCode: execution.sourceSystemCode } : {}),
            ...(formalResult ? { resultOutcome: formalResult.outcome, resultReportNumber: formalResult.reportNumber } : {}),
            ...(route.sentAt ? { sentAt: route.sentAt } : {}),
            ...(route.receivedAt ? { receivedAt: route.receivedAt } : {}),
            ...(route.resultReturnedAt ? { resultReturnedAt: route.resultReturnedAt } : {}),
            ...(request?.sampleIssue?.description ? { issueDescription: request.sampleIssue.description } : {}),
          };
        });
        const activeRoutes = routes.filter((route) => route.readiness === 'CURRENT');
        const unlinkedPyc = itemIndex === 0 ? dossierRequests.filter((request) => !usedRequestIds.has(request.id)).map(projectUnlinkedPyc) : [];
        const linkedOrWrongRouteRequests = dossierRequests.filter((request) => request.sampleRouteId && !usedRequestIds.has(request.id));
        const currentLocation = derivePcnSampleItemLocation(itemRoutes, String(lot.currentLocation || '').trim() || 'Chưa cập nhật');
        projections.push({
          id: `sample:${lot.id}:${item.id}`,
          ...base,
          lotId: lot.id,
          lotCode: lot.lotCode,
          sampleItemId: item.id,
          sampleCode: item.sampleCode,
          sampleType: item.sampleType,
          model: item.model,
          sampleName: item.sampleType,
          ...(item.brand ? { brand: item.brand } : {}),
          quantity: item.quantity,
          ...(item.unit ? { unit: item.unit } : {}),
          lotStatus: lot.status,
          currentLocation,
          ...(activeRoutes[0] ? { activeRouteId: activeRoutes[0].routeId } : {}),
          activeRouteCount: activeRoutes.length,
          hasDataIssue: activeRoutes.length > 1 || linkedOrWrongRouteRequests.length > 0,
          routes,
          unlinkedPyc,
        });
      }
    }

    const unlinkedRequests = dossierRequests.filter((request) => !usedRequestIds.has(request.id));
    if (dossierLots.length === 0 && unlinkedRequests.length > 0) {
      projections.push({
        id: `sample:unlinked:${dossier.id}`,
        ...base,
        lotId: `unlinked:${dossier.id}`,
        lotCode: 'Chưa gắn lô mẫu',
        sampleItemId: `unlinked-item:${dossier.id}`,
        sampleCode: '—',
        sampleType: 'PYC chưa gắn lô mẫu',
        model: '—',
        sampleName: 'PYC chưa gắn tuyến mẫu',
        quantity: 0,
        lotStatus: 'ISSUE',
        currentLocation: 'Cần xử lý liên kết PYC',
        activeRouteCount: 0,
        hasDataIssue: true,
        routes: [],
        unlinkedPyc: unlinkedRequests.map(projectUnlinkedPyc),
      });
    }
  }
  return projections.sort((left, right) => left.dossierCode.localeCompare(right.dossierCode, 'vi') || left.lotCode.localeCompare(right.lotCode, 'vi'));
}

export function filterPcnSampleFlowProjections(projections: PcnSampleFlowProjection[], query = ''): PcnSampleFlowProjection[] {
  const normalized = clean(query).toLocaleLowerCase('vi-VN');
  if (!normalized) return projections;
  return projections.filter((projection) => {
    const values = [
      projection.dossierCode, projection.proposalCode, projection.customerName, projection.productName,
      projection.lotCode, projection.sampleCode, projection.sampleType, projection.sampleName, projection.model, projection.brand, projection.currentLocation,
      ...projection.routes.flatMap((route) => [route.labCode, route.labName, route.pycNumber, route.externalRequestCode, route.issueDescription, route.executionSourceSystemCode]),
      ...projection.unlinkedPyc.flatMap((request) => [request.pycNumber, request.laboratoryName, request.issueDescription]),
    ];
    return values.filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(normalized);
  });
}

export function getPcnLabRequestStatusLabel(status?: OutboundLabRequest['status']): string {
  return status === 'SENT' ? 'Đã gửi' : status === 'RECEIVED' ? 'PTN đã nhận' : status === 'RESULT_RETURNED' ? 'Đã trả KQTN' : status === 'CANCELLED' ? 'Đã hủy' : 'Bản nháp';
}

export function getPcnSampleRouteStatusLabel(status?: PcnSampleRoute['status']): string {
  return status === 'SENT' ? 'Đã giao PTN' : status === 'RECEIVED' ? 'PTN đã nhận mẫu' : status === 'RESULT_RETURNED' ? 'Đã có KQTN' : status === 'RETURNED_TO_PCN' ? 'Đã trả PCN' : status === 'CLOSED' ? 'Đã đóng tuyến' : status === 'ISSUE' ? 'Có sự cố' : status === 'CANCELLED' ? 'Đã hủy' : 'Chờ xử lý';
}

export function getPcnSampleExecutionStatusLabel(status?: PcnSampleFlowRouteProjection['executionStatus']): string {
  return status === 'SCHEDULED' ? 'Đã lên lịch' : status === 'IN_PROGRESS' ? 'Đang thử' : status === 'COMPLETED' ? 'Đã hoàn tất' : status === 'BLOCKED' ? 'Bị chặn' : status === 'CANCELLED' ? 'Đã hủy' : 'Chưa lên lịch';
}

export function getPcnSampleExecutionOutcomeLabel(outcome?: PcnSampleFlowRouteProjection['executionOutcome']): string {
  return outcome === 'PASS' ? 'PASS' : outcome === 'FAIL' ? 'FAIL' : 'Chưa có KQ';
}
