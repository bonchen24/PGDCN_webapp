import type {
  PcnSampleFlowEvent,
  PcnSampleFlowEventType,
  PcnSampleLabCode,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleLotStatus,
  PcnSampleRoute,
  PcnSampleRouteStatus,
  PcnQc20LotDefinition,
} from '../types.ts';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types.ts';
import { getPcnTimestampDenial } from './pcnDossierDate.ts';

const STANDARD_ELECTRICAL_LABS: readonly PcnSampleLabCode[] = ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY'];
const STANDARD_QC20_LABS: readonly PcnSampleLabCode[] = ['CHEMICAL_ANALYSIS'];

/**
 * Return the default route set for the selected fields. QC20 is a material
 * conformity profile, so it must not silently inherit the three electrical
 * testing-room routes used by QC4/QC9.
 */
export function getPcnSampleLabCodesForFields(fieldCodes: readonly string[]): PcnSampleLabCode[] {
  const normalized = new Set(fieldCodes.map((code) => String(code || '').trim().toUpperCase()).filter(Boolean));
  const result: PcnSampleLabCode[] = [];
  const append = (codes: readonly PcnSampleLabCode[]) => {
    for (const code of codes) if (!result.includes(code)) result.push(code);
  };
  if (normalized.has('QC4') || normalized.has('QC9')) append(STANDARD_ELECTRICAL_LABS);
  if (normalized.has('QC20')) append(STANDARD_QC20_LABS);
  return result;
}

export interface PcnSampleLotDraft {
  id: string;
  dossierId: string;
  lotCode: string;
  /** Legacy single-item input; new callers should use sampleItems. */
  sampleName?: string;
  model?: string;
  brand?: string;
  quantity: number;
  unit?: string;
  sampleItems?: PcnSampleItemDraft[];
  fieldCodes?: string[];
  labCodes: PcnSampleLabCode[];
  qc20Snapshot?: {
    grade?: string;
    nominalDimensions?: string;
    manufacturerLotCode?: string;
    lotDefinition?: PcnQc20LotDefinition;
  };
  receivedAt?: string;
  notes?: string;
}

export interface PcnSampleItemDraft {
  id?: string;
  sampleCode?: string;
  sampleType: string;
  model: string;
  brand?: string;
  quantity: number;
  unit?: string;
  testLabCodes?: PcnSampleLabCode[];
  serialNumbers?: string[];
  notes?: string;
}

export interface PcnSampleRouteUpdate {
  labRequestId?: string;
  note?: string;
}

const ROUTE_TRANSITIONS: Record<PcnSampleRouteStatus, PcnSampleRouteStatus[]> = {
  PENDING: ['SENT', 'CANCELLED'],
  SENT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['RESULT_RETURNED'],
  RESULT_RETURNED: ['RETURNED_TO_PCN'],
  RETURNED_TO_PCN: ['CLOSED'],
  CLOSED: [],
  ISSUE: ['RECEIVED', 'CANCELLED'],
  CANCELLED: [],
};

function sampleLabName(code: PcnSampleLabCode): string {
  return PCN_SAMPLE_LAB_OPTIONS.find((item) => item.code === code)?.name || code;
}

function uniqueLabCodes(codes: PcnSampleLabCode[]): PcnSampleLabCode[] {
  return Array.from(new Set(codes));
}

export type PcnSampleRouteReadiness = 'COMPLETED' | 'CURRENT' | 'READY' | 'BLOCKED' | 'CANCELLED';
export type PcnSampleExecutionMode = 'SEQUENTIAL' | 'PARALLEL';

export function getPcnSampleExecutionMode(sampleItem?: Pick<PcnSampleItem, 'quantity'>): PcnSampleExecutionMode {
  return Number(sampleItem?.quantity) > 1 ? 'PARALLEL' : 'SEQUENTIAL';
}

function getPcnSampleRouteCatalogOrder(route: PcnSampleRoute): number {
  const index = PCN_SAMPLE_LAB_OPTIONS.findIndex((item) => item.code === route.labCode);
  return index < 0 ? PCN_SAMPLE_LAB_OPTIONS.length : index;
}

/** Sort route nodes deterministically while preserving a stable fallback for legacy rows. */
export function sortPcnSampleRoutes(routes: PcnSampleRoute[]): PcnSampleRoute[] {
  return [...routes].sort((left, right) => {
    const leftSequence = Number.isInteger(left.sequence) && (left.sequence || 0) > 0 ? left.sequence as number : Number.MAX_SAFE_INTEGER;
    const rightSequence = Number.isInteger(right.sequence) && (right.sequence || 0) > 0 ? right.sequence as number : Number.MAX_SAFE_INTEGER;
    return leftSequence - rightSequence
      || getPcnSampleRouteCatalogOrder(left) - getPcnSampleRouteCatalogOrder(right)
      || String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
      || left.id.localeCompare(right.id);
  });
}

export function isPcnSampleRouteCompleteForNext(route: PcnSampleRoute): boolean {
  return ['RESULT_RETURNED', 'RETURNED_TO_PCN', 'CLOSED'].includes(route.status);
}

export function getPcnSampleRouteStartDenial(
  route: PcnSampleRoute,
  siblingRoutes: PcnSampleRoute[],
  sampleItems: PcnSampleItem[],
): string | undefined {
  if (route.status !== 'PENDING' || !route.sampleItemIds?.length) return undefined;
  const assignedItems = sampleItems.filter((item) => route.sampleItemIds?.includes(item.id));
  if (assignedItems.length === 0) return 'Tuyến mẫu không xác định được mẫu/model được gán.';
  const blockedItem = assignedItems.find((item) => {
    const itemRoutes = siblingRoutes.filter((candidate) => candidate.sampleItemIds?.includes(item.id));
    return derivePcnSampleRouteReadiness(itemRoutes, item)[route.id] !== 'READY';
  });
  return blockedItem
    ? `Mẫu/model quantity bằng 1 phải chạy tuần tự; chặng trước của ${blockedItem.sampleCode} chưa kết thúc.`
    : undefined;
}

/** Derive which route is complete, active, ready, blocked or cancelled for one sample/model. */
export function derivePcnSampleRouteReadiness(
  routes: PcnSampleRoute[],
  sampleItem?: Pick<PcnSampleItem, 'id' | 'quantity'>,
): Record<string, PcnSampleRouteReadiness> {
  const readiness: Record<string, PcnSampleRouteReadiness> = {};
  const executionMode = getPcnSampleExecutionMode(sampleItem);
  let previous: PcnSampleRoute | undefined;
  for (const route of sortPcnSampleRoutes(routes)) {
    let value: PcnSampleRouteReadiness;
    if (route.status === 'CANCELLED') value = 'CANCELLED';
    else if (['RESULT_RETURNED', 'RETURNED_TO_PCN', 'CLOSED'].includes(route.status)) value = 'COMPLETED';
    else if (route.status === 'ISSUE' || route.execution?.status === 'BLOCKED') value = 'BLOCKED';
    else if (route.status === 'PENDING') {
      value = executionMode === 'PARALLEL'
        ? 'READY'
        : (!previous || isPcnSampleRouteCompleteForNext(previous) ? 'READY' : 'BLOCKED');
    }
    else value = 'CURRENT';
    readiness[route.id] = value;
    if (route.status !== 'CANCELLED') previous = route;
  }
  return readiness;
}

export function getNextPcnSampleRouteStatuses(status: PcnSampleRouteStatus): PcnSampleRouteStatus[] {
  return [...(ROUTE_TRANSITIONS[status] || [])];
}

export function buildPcnSampleLot(
  draft: PcnSampleLotDraft,
  now: string = new Date().toISOString(),
): { lot: PcnSampleLot; items: PcnSampleItem[]; routes: PcnSampleRoute[] } {
  const lotCode = String(draft.lotCode || '').trim();
  const legacySampleName = String(draft.sampleName || '').trim();
  const dossierId = String(draft.dossierId || '').trim();
  const fieldCodes = Array.from(new Set((draft.fieldCodes || []).map((code) => String(code).trim().toUpperCase()).filter(Boolean)));
  const labCodes = uniqueLabCodes(draft.labCodes || []);
  const receivedAt = draft.receivedAt?.trim() || '';
  if (!dossierId) throw new Error('Lô mẫu phải thuộc một hồ sơ PCN');
  if (!lotCode) throw new Error('Mẫu PCN phải có mã hóa theo lô');
  if (fieldCodes.length === 0) throw new Error('Lô mẫu phải có ít nhất một Lĩnh vực thuộc hồ sơ PCN');
  const itemDrafts = draft.sampleItems && draft.sampleItems.length > 0
    ? draft.sampleItems
    : [{ sampleCode: lotCode, sampleType: legacySampleName, model: String(draft.model || '').trim() || legacySampleName, brand: draft.brand, quantity: draft.quantity, unit: draft.unit }];
  if (!draft.sampleItems?.length && !legacySampleName) throw new Error('Mẫu PCN phải có tên mẫu');
  if (itemDrafts.length === 0) throw new Error('Lô mẫu phải có ít nhất một mẫu/model');
  const items: PcnSampleItem[] = itemDrafts.map((itemDraft, index) => {
    const sampleType = String(itemDraft.sampleType || '').trim();
    const model = String(itemDraft.model || '').trim();
    const sampleCode = String(itemDraft.sampleCode || '').trim() || `${lotCode}-M${index + 1}`;
    const quantity = Number(itemDraft.quantity);
    if (!sampleType) throw new Error(`Mẫu/model thứ ${index + 1} phải có loại mẫu`);
    if (!model) throw new Error(`Mẫu/model thứ ${index + 1} phải có model`);
    if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Số lượng mỗi mẫu phải là số nguyên dương');
    const id = String(itemDraft.id || `${draft.id}-item-${index + 1}`).trim();
    if (!id) throw new Error(`Mẫu/model thứ ${index + 1} phải có mã định danh`);
    const testLabCodes = uniqueLabCodes(itemDraft.testLabCodes === undefined ? labCodes : itemDraft.testLabCodes);
    if (testLabCodes.length === 0) throw new Error(`Mẫu/model thứ ${index + 1} phải được gán ít nhất một phép thử nội bộ`);
    return {
      id,
      sampleLotId: draft.id,
      sampleCode,
      sampleType,
      model,
      ...(String(itemDraft.brand || '').trim() ? { brand: String(itemDraft.brand).trim() } : {}),
      quantity,
      testLabCodes,
      ...(String(itemDraft.unit || '').trim() ? { unit: String(itemDraft.unit).trim() } : {}),
      ...(itemDraft.serialNumbers?.length ? { serialNumbers: itemDraft.serialNumbers.map((value) => String(value).trim()).filter(Boolean) } : {}),
      ...(String(itemDraft.notes || '').trim() ? { notes: String(itemDraft.notes).trim() } : {}),
      createdAt: now,
      updatedAt: now,
    };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('Mã mẫu/model trong cùng một lô không được trùng');
  if (new Set(items.map((item) => item.sampleCode)).size !== items.length) throw new Error('Mã mẫu trong cùng một lô không được trùng');
  const quantity = items.reduce((total, item) => total + item.quantity, 0);
  const assignedLabCodes = uniqueLabCodes(items.flatMap((item) => item.testLabCodes || []));
  const allowedLabCodes = new Set(getPcnSampleLabCodesForFields(fieldCodes));
  const unsupportedLabCodes = assignedLabCodes.filter((code) => !allowedLabCodes.has(code));
  if (unsupportedLabCodes.length > 0) {
    throw new Error(`Tuyến phòng thử không phù hợp với Lĩnh vực: ${unsupportedLabCodes.join(', ')}`);
  }
  if (fieldCodes.includes('QC20')) {
    const qc20Snapshot = draft.qc20Snapshot;
    if (!String(qc20Snapshot?.grade || '').trim()) throw new Error('Lô QC20 phải có mác thép đã xác nhận');
    if (!String(qc20Snapshot?.nominalDimensions || '').trim()) throw new Error('Lô QC20 phải có kích thước danh nghĩa');
    if (!String(qc20Snapshot?.manufacturerLotCode || '').trim()) throw new Error('Lô QC20 phải có số lô nhà sản xuất hoặc lô hàng');
    const lotDefinition = String(qc20Snapshot?.lotDefinition || '').trim().toUpperCase();
    if (!['PRODUCT_LOT', 'SHIPMENT_LOT'].includes(lotDefinition)) throw new Error('Lô QC20 phải xác định là lô sản phẩm hoặc lô hàng hóa');
  }
  const receivedAtDenial = getPcnTimestampDenial('Thời điểm tiếp nhận lô mẫu', receivedAt);
  if (receivedAtDenial) throw new Error(receivedAtDenial);
  const routeIds = assignedLabCodes.map((code) => `${draft.id}-${code.toLowerCase()}`);
  const lot: PcnSampleLot = {
    id: draft.id,
    dossierId,
    lotCode,
    sampleName: items[0].sampleType,
    quantity,
    sampleItemIds: items.map((item) => item.id),
    fieldCodes,
    routeIds,
    status: 'PREPARED',
    currentLocation: 'Kho PCN',
    createdAt: now,
    updatedAt: now,
  };
  for (const [key, value] of Object.entries({ model: items.length === 1 ? items[0].model : undefined, brand: items.length === 1 ? items[0].brand : undefined, unit: items.length === 1 ? items[0].unit : undefined, receivedAt, notes: draft.notes })) {
    const normalized = String(value || '').trim();
    if (normalized) Object.assign(lot, { [key]: normalized });
  }
  if (fieldCodes.includes('QC20') && draft.qc20Snapshot) {
    lot.qc20Snapshot = {
      grade: String(draft.qc20Snapshot.grade || '').trim(),
      nominalDimensions: String(draft.qc20Snapshot.nominalDimensions || '').trim(),
      manufacturerLotCode: String(draft.qc20Snapshot.manufacturerLotCode || '').trim(),
      lotDefinition: String(draft.qc20Snapshot.lotDefinition || '').trim().toUpperCase() as PcnQc20LotDefinition,
    };
  }
  const routes: PcnSampleRoute[] = assignedLabCodes.map((labCode, index) => ({
    id: routeIds[index],
    sampleLotId: draft.id,
    labCode,
    labName: sampleLabName(labCode),
    status: 'PENDING',
    sequence: index + 1,
    sampleItemIds: items.filter((item) => item.testLabCodes?.includes(labCode)).map((item) => item.id),
    createdAt: now,
    updatedAt: now,
  }));
  return { lot, items, routes };
}

export function transitionPcnSampleRoute(
  route: PcnSampleRoute,
  nextStatus: PcnSampleRouteStatus,
  update: PcnSampleRouteUpdate = {},
  now: string = new Date().toISOString(),
): PcnSampleRoute {
  if (!ROUTE_TRANSITIONS[route.status]?.includes(nextStatus)) {
    throw new Error(`Không thể chuyển tuyến mẫu từ ${route.status} sang ${nextStatus}`);
  }
  const next: PcnSampleRoute = { ...route, status: nextStatus, updatedAt: now };
  if (update.labRequestId?.trim()) next.labRequestId = update.labRequestId.trim();
  if (update.note?.trim()) next.note = update.note.trim();
  if (nextStatus === 'SENT') next.sentAt = now;
  if (nextStatus === 'RECEIVED') next.receivedAt = now;
  if (nextStatus === 'RESULT_RETURNED') next.resultReturnedAt = now;
  if (nextStatus === 'RETURNED_TO_PCN') next.returnedAt = now;
  return next;
}

export function derivePcnSampleLotStatus(routes: PcnSampleRoute[]): { status: PcnSampleLotStatus; currentLocation: string } {
  if (routes.length === 0 || routes.every((route) => route.status === 'PENDING')) return { status: 'PREPARED', currentLocation: 'Kho PCN' };
  if (routes.some((route) => route.status === 'ISSUE')) return { status: 'ISSUE', currentLocation: 'Cần xử lý mẫu' };
  if (routes.every((route) => route.status === 'CLOSED' || route.status === 'CANCELLED')) return { status: 'CLOSED', currentLocation: 'Đã hoàn tất' };
  if (routes.every((route) => ['RETURNED_TO_PCN', 'CLOSED', 'CANCELLED'].includes(route.status))) return { status: 'RETURNED_TO_PCN', currentLocation: 'Kho PCN' };
  const receivedRoute = routes.find((route) => route.status === 'RECEIVED');
  if (receivedRoute) return { status: 'AT_LAB', currentLocation: receivedRoute.labName };
  if (routes.some((route) => route.status === 'RESULT_RETURNED')) return { status: 'RESULTS_PENDING', currentLocation: 'Chờ PCN tiếp nhận KQTN' };
  if (routes.some((route) => route.status === 'SENT')) return { status: 'IN_TRANSIT', currentLocation: 'Đang luân chuyển tới PTN' };
  return { status: 'PREPARED', currentLocation: 'Kho PCN' };
}

export interface PcnSampleFlowEventDraft {
  id: string;
  sampleLotId: string;
  routeId?: string;
  labRequestId?: string;
  idempotencyFingerprint?: string;
  sourceSystemCode?: string;
  externalEventId?: string;
  externalRequestId?: string;
  externalSequence?: number;
  sampleItemIds?: string[];
  type: PcnSampleFlowEventType;
  fromStatus?: PcnSampleRouteStatus;
  toStatus?: PcnSampleRouteStatus;
  location: string;
  note?: string;
  actorUsername?: string;
}

export function buildPcnSampleFlowEvent(
  draft: PcnSampleFlowEventDraft,
  occurredAt: string = new Date().toISOString(),
): PcnSampleFlowEvent {
  if (!String(draft.sampleLotId || '').trim()) throw new Error('Flow mẫu phải liên kết mã lô');
  return {
    id: draft.id,
    sampleLotId: draft.sampleLotId,
    ...(draft.routeId ? { routeId: draft.routeId } : {}),
    ...(draft.labRequestId ? { labRequestId: draft.labRequestId } : {}),
    ...(draft.idempotencyFingerprint ? { idempotencyFingerprint: draft.idempotencyFingerprint } : {}),
    ...(draft.sourceSystemCode ? { sourceSystemCode: draft.sourceSystemCode } : {}),
    ...(draft.externalEventId ? { externalEventId: draft.externalEventId } : {}),
    ...(draft.externalRequestId ? { externalRequestId: draft.externalRequestId } : {}),
    ...(draft.externalSequence !== undefined ? { externalSequence: draft.externalSequence } : {}),
    ...(draft.sampleItemIds?.length ? { sampleItemIds: Array.from(new Set(draft.sampleItemIds.map((value) => String(value).trim()).filter(Boolean))) } : {}),
    type: draft.type,
    ...(draft.fromStatus ? { fromStatus: draft.fromStatus } : {}),
    ...(draft.toStatus ? { toStatus: draft.toStatus } : {}),
    location: String(draft.location || '').trim() || 'Chưa xác định',
    ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
    ...(draft.actorUsername?.trim() ? { actorUsername: draft.actorUsername.trim() } : {}),
    occurredAt,
  };
}
