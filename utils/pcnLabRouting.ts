import type { OutboundLabRequest, PcnLabRequestStatus, PcnCertificationFieldCode } from '../types.ts';
import { getPcnDossierDateDenial, getPcnTimestampDenial } from './pcnDossierDate.ts';

export interface PcnLabRequestDraft {
  id: string;
  dossierId: string;
  fieldCode: PcnCertificationFieldCode;
  laboratoryName: string;
  sampleLotId?: string;
  sampleRouteId?: string;
  pycNumber?: string;
  targetDate?: string;
  criteria?: string;
  handoverAt?: string;
  handoverNote?: string;
}

const LAB_REQUEST_TRANSITIONS: Record<PcnLabRequestStatus, PcnLabRequestStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['RESULT_RETURNED'],
  RESULT_RETURNED: [],
  CANCELLED: [],
};

/**
 * Resolve the field selected for a PYC without inventing a primary field for a
 * multi-field dossier. Preserve an explicit valid selection, auto-select only
 * when there is exactly one available field, and otherwise require the user
 * to choose one.
 */
export function getPcnLabFieldSelection(availableFieldCodes: readonly string[], currentFieldCode = ''): string {
  const normalizedCodes = availableFieldCodes
    .map((code) => String(code || '').trim().toUpperCase())
    .filter(Boolean);
  const normalizedCurrent = String(currentFieldCode || '').trim().toUpperCase();
  if (normalizedCurrent && normalizedCodes.includes(normalizedCurrent)) return normalizedCurrent;
  return normalizedCodes.length === 1 ? normalizedCodes[0] : '';
}

export function getNextPcnLabRequestStatuses(status: PcnLabRequestStatus): PcnLabRequestStatus[] {
  return [...(LAB_REQUEST_TRANSITIONS[status] || [])];
}

export function transitionPcnLabRequest(from: PcnLabRequestStatus, to: PcnLabRequestStatus): { status: PcnLabRequestStatus } {
  if (!LAB_REQUEST_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Không thể chuyển PYC từ ${from} sang ${to}`);
  }
  return { status: to };
}

export function buildPcnLabRequest(
  draft: PcnLabRequestDraft,
  now: string = new Date().toISOString(),
): OutboundLabRequest {
  const id = String(draft.id || '').trim();
  const dossierId = String(draft.dossierId || '').trim();
  const fieldCode = String(draft.fieldCode || '').trim().toUpperCase();
  const laboratoryName = draft.laboratoryName.trim();
  const targetDate = draft.targetDate?.trim() || '';
  const handoverAt = draft.handoverAt?.trim() || '';
  if (!id) throw new Error('PYC phải có mã định danh');
  if (!dossierId) throw new Error('PYC phải liên kết với hồ sơ PCN');
  if (!fieldCode) throw new Error('PYC phải có Lĩnh vực');
  if (!laboratoryName) throw new Error('PYC phải có tên phòng thử nghiệm nhận');
  const targetDateDenial = getPcnDossierDateDenial('Hạn trả KQTN', targetDate);
  if (targetDateDenial) throw new Error(targetDateDenial);
  const handoverAtDenial = getPcnTimestampDenial('Thời điểm bàn giao PYC', handoverAt);
  if (handoverAtDenial) throw new Error(handoverAtDenial);
  const request: OutboundLabRequest = {
    id,
    pycNumber: draft.pycNumber?.trim() || `PYC-${new Date(now).getFullYear()}-${id.slice(-6)}`,
    dossierId,
    fieldCode,
    laboratoryName,
    ...(draft.sampleLotId?.trim() ? { sampleLotId: draft.sampleLotId.trim() } : {}),
    ...(draft.sampleRouteId?.trim() ? { sampleRouteId: draft.sampleRouteId.trim() } : {}),
    status: 'DRAFT',
    requestedAt: now,
  };
  if (targetDate) request.targetDate = targetDate;
  if (draft.criteria?.trim()) request.criteria = draft.criteria.trim();
  if (handoverAt) request.handoverAt = handoverAt;
  if (draft.handoverNote?.trim()) request.handoverNote = draft.handoverNote.trim();
  return request;
}
