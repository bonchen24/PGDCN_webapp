import type {
  PcnSampleFlowEvent,
  PcnSampleFlowEventType,
  PcnSampleLabCode,
  PcnSampleLot,
  PcnSampleLotStatus,
  PcnSampleRoute,
  PcnSampleRouteStatus,
} from '../types.ts';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types.ts';
import { getPcnTimestampDenial } from './pcnDossierDate.ts';

export interface PcnSampleLotDraft {
  id: string;
  dossierId: string;
  lotCode: string;
  sampleName: string;
  model?: string;
  brand?: string;
  quantity: number;
  unit?: string;
  fieldCodes?: string[];
  labCodes: PcnSampleLabCode[];
  receivedAt?: string;
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

export function getNextPcnSampleRouteStatuses(status: PcnSampleRouteStatus): PcnSampleRouteStatus[] {
  return [...(ROUTE_TRANSITIONS[status] || [])];
}

export function buildPcnSampleLot(
  draft: PcnSampleLotDraft,
  now: string = new Date().toISOString(),
): { lot: PcnSampleLot; routes: PcnSampleRoute[] } {
  const lotCode = String(draft.lotCode || '').trim();
  const sampleName = String(draft.sampleName || '').trim();
  const dossierId = String(draft.dossierId || '').trim();
  const quantity = Number(draft.quantity);
  const fieldCodes = Array.from(new Set((draft.fieldCodes || []).map((code) => String(code).trim()).filter(Boolean)));
  const labCodes = uniqueLabCodes(draft.labCodes || []);
  const receivedAt = draft.receivedAt?.trim() || '';
  if (!dossierId) throw new Error('Lô mẫu phải thuộc một hồ sơ PCN');
  if (!lotCode) throw new Error('Mẫu PCN phải có mã hóa theo lô');
  if (!sampleName) throw new Error('Mẫu PCN phải có tên mẫu');
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Số lượng mẫu phải là số nguyên dương');
  if (fieldCodes.length === 0) throw new Error('Lô mẫu phải có ít nhất một Lĩnh vực thuộc hồ sơ PCN');
  if (labCodes.length === 0) throw new Error('Phải chọn ít nhất một phòng thử nghiệm nhận mẫu');
  const receivedAtDenial = getPcnTimestampDenial('Thời điểm tiếp nhận lô mẫu', receivedAt);
  if (receivedAtDenial) throw new Error(receivedAtDenial);
  const routeIds = labCodes.map((code) => `${draft.id}-${code.toLowerCase()}`);
  const lot: PcnSampleLot = {
    id: draft.id,
    dossierId,
    lotCode,
    sampleName,
    quantity,
    fieldCodes,
    routeIds,
    status: 'PREPARED',
    currentLocation: 'Kho PCN',
    createdAt: now,
    updatedAt: now,
  };
  for (const [key, value] of Object.entries({ model: draft.model, brand: draft.brand, unit: draft.unit, receivedAt, notes: draft.notes })) {
    const normalized = String(value || '').trim();
    if (normalized) Object.assign(lot, { [key]: normalized });
  }
  const routes: PcnSampleRoute[] = labCodes.map((labCode, index) => ({
    id: routeIds[index],
    sampleLotId: draft.id,
    labCode,
    labName: sampleLabName(labCode),
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  }));
  return { lot, routes };
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
    type: draft.type,
    ...(draft.fromStatus ? { fromStatus: draft.fromStatus } : {}),
    ...(draft.toStatus ? { toStatus: draft.toStatus } : {}),
    location: String(draft.location || '').trim() || 'Chưa xác định',
    ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
    ...(draft.actorUsername?.trim() ? { actorUsername: draft.actorUsername.trim() } : {}),
    occurredAt,
  };
}
