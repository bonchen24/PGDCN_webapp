import type {
  PcnCertificationMethod,
  PcnDossierStatus,
  PcnIssuanceDocumentType,
  PcnResultOutcome,
  PcnCertificationField,
} from '../types.ts';
import { PCN_CERTIFICATION_FIELD_CODES } from '../types.ts';

export const DEFAULT_PCN_CERTIFICATION_FIELDS: PcnCertificationField[] = [
  {
    code: 'QC4',
    name: 'Quy chuẩn 4',
    standardRefs: ['QCVN 4:2009/BKHCN'],
    active: true,
  },
  {
    code: 'QC9',
    name: 'Quy chuẩn 9',
    standardRefs: ['QCVN 9', 'TCVN 7492-1:2018'],
    active: true,
  },
];

export { PCN_CERTIFICATION_FIELD_CODES };

/**
 * Keep the active PCN catalog forward-compatible with a database initialized
 * before a new certification field was added. Database values remain the
 * source for approved metadata, while the product baseline fills omissions.
 */
export function mergePcnCertificationFields(configuredFields: PcnCertificationField[]): PcnCertificationField[] {
  const configuredByCode = new Map(configuredFields.map((field) => [String(field.code).trim().toUpperCase(), field]));
  return PCN_CERTIFICATION_FIELD_CODES
    .map((code) => {
      const baseline = DEFAULT_PCN_CERTIFICATION_FIELDS.find((field) => field.code === code)!;
      const configured = configuredByCode.get(code);
      const merged = configured ? { ...baseline, ...configured, code } : baseline;
      return merged;
    })
    .filter((field) => field.active !== false);
}

const DOSSIER_STATUS_LABELS: Record<PcnDossierStatus, string> = {
  DRAFT: 'Bản nháp',
  INTAKE_REVIEW: 'Đang kiểm tra Đề nghị',
  AWAITING_DOCUMENTS: 'Chờ bổ sung hồ sơ',
  ASSIGNED: 'Đã phân công',
  PLAN_PENDING_APPROVAL: 'Chờ duyệt kế hoạch',
  FIELD_EVALUATION: 'Đang đánh giá',
  AWAITING_SAMPLING: 'Chờ lấy mẫu',
  SENT_TO_LAB: 'Đã gửi PTN',
  AWAITING_RESULTS: 'Chờ KQTN',
  CORRECTIVE_ACTION: 'Đang khắc phục',
  TECHNICAL_REVIEW: 'Đang soát xét kỹ thuật',
  WAITING_APPROVAL: 'Chờ phê duyệt',
  APPROVED: 'Đã phê duyệt',
  ISSUED: 'Đã phát hành',
  DELIVERED: 'Đã giao khách hàng',
  ARCHIVED: 'Đã lưu trữ',
  REJECTED: 'Từ chối / trả lại',
  CANCELLED: 'Đã hủy',
  ON_HOLD: 'Tạm dừng',
};

const DOSSIER_TRANSITIONS: Record<PcnDossierStatus, PcnDossierStatus[]> = {
  DRAFT: ['INTAKE_REVIEW', 'CANCELLED'],
  INTAKE_REVIEW: ['AWAITING_DOCUMENTS', 'ASSIGNED', 'REJECTED', 'CANCELLED'],
  AWAITING_DOCUMENTS: ['INTAKE_REVIEW', 'ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PLAN_PENDING_APPROVAL', 'CANCELLED', 'ON_HOLD'],
  PLAN_PENDING_APPROVAL: ['FIELD_EVALUATION', 'REJECTED', 'ON_HOLD'],
  FIELD_EVALUATION: ['AWAITING_SAMPLING', 'SENT_TO_LAB', 'TECHNICAL_REVIEW', 'ON_HOLD'],
  AWAITING_SAMPLING: ['SENT_TO_LAB', 'FIELD_EVALUATION', 'ON_HOLD'],
  SENT_TO_LAB: ['AWAITING_RESULTS', 'CORRECTIVE_ACTION', 'TECHNICAL_REVIEW', 'ON_HOLD'],
  AWAITING_RESULTS: ['CORRECTIVE_ACTION', 'TECHNICAL_REVIEW', 'ON_HOLD'],
  CORRECTIVE_ACTION: ['SENT_TO_LAB', 'FIELD_EVALUATION', 'TECHNICAL_REVIEW', 'REJECTED', 'ON_HOLD'],
  TECHNICAL_REVIEW: ['WAITING_APPROVAL', 'REJECTED', 'ASSIGNED', 'ON_HOLD'],
  WAITING_APPROVAL: ['APPROVED', 'REJECTED', 'TECHNICAL_REVIEW'],
  APPROVED: ['ISSUED', 'REJECTED'],
  ISSUED: ['DELIVERED'],
  DELIVERED: ['ARCHIVED'],
  ARCHIVED: [],
  REJECTED: ['INTAKE_REVIEW', 'ASSIGNED', 'CANCELLED'],
  CANCELLED: [],
  ON_HOLD: ['INTAKE_REVIEW', 'ASSIGNED', 'FIELD_EVALUATION', 'SENT_TO_LAB', 'TECHNICAL_REVIEW', 'CANCELLED'],
};

const TEMPLATE_CODES: Record<PcnCertificationMethod, Record<PcnIssuanceDocumentType, string>> = {
  METHOD_1: { CERTIFICATE: 'BM-QT-03-02a', DECISION: 'BM-QĐ-03-01a' },
  METHOD_5: { CERTIFICATE: 'BM-QT-03-02b', DECISION: 'BM-QĐ-03-01b' },
  METHOD_7: { CERTIFICATE: 'BM-QT-03-02c', DECISION: 'BM-QĐ-03-01c' },
};

export function getPcnDossierStatusLabel(status: PcnDossierStatus): string {
  return DOSSIER_STATUS_LABELS[status];
}

export function isPcnDossierTransitionAllowed(from: PcnDossierStatus, to: PcnDossierStatus): boolean {
  return DOSSIER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getPcnDossierNextStatuses(status: PcnDossierStatus): PcnDossierStatus[] {
  return [...(DOSSIER_TRANSITIONS[status] || [])];
}

const PCN_ISSUANCE_BOUNDARY_TRANSITIONS = new Map<string, string>([
  ['TECHNICAL_REVIEW->WAITING_APPROVAL', 'Lập bộ phát hành và chuyển trình phê duyệt phải thực hiện trong module phát hành.'],
  ['WAITING_APPROVAL->APPROVED', 'Quyết định phê duyệt phải thực hiện trong module phát hành để lưu đủ bằng chứng.'],
  ['WAITING_APPROVAL->TECHNICAL_REVIEW', 'Trả hồ sơ về kỹ thuật phải thực hiện trong module phát hành để lưu lý do phê duyệt.'],
  ['APPROVED->ISSUED', 'Cấp số phát hành phải thực hiện trong module phát hành để kiểm tra người ký và điều kiện cấp số.'],
  ['ISSUED->DELIVERED', 'Giao khách hàng phải thực hiện trong module phát hành để lưu người nhận, thời điểm và ghi chú.'],
  ['DELIVERED->ARCHIVED', 'Lưu trữ phải thực hiện trong module phát hành để lưu đủ bằng chứng giao và metadata lưu trữ.'],
]);

/**
 * Delivery and archive change both the dossier and its issuance package, so
 * the generic dossier metadata endpoint must not perform either transition.
 */
export function getPcnDossierStatusMutationDenial(
  from: PcnDossierStatus,
  to: PcnDossierStatus,
): string | null {
  return PCN_ISSUANCE_BOUNDARY_TRANSITIONS.get(`${from}->${to}`) || null;
}

/** Status buttons shown by the generic dossier detail footer. */
export function getPcnDossierManualNextStatuses(status: PcnDossierStatus): PcnDossierStatus[] {
  return getPcnDossierNextStatuses(status)
    .filter((nextStatus) => !getPcnDossierStatusMutationDenial(status, nextStatus));
}

const PCN_EXCEPTION_STATUSES = new Set<PcnDossierStatus>(['ON_HOLD', 'REJECTED', 'CANCELLED']);

export function getPcnDossierExceptionReasonDenial(status: PcnDossierStatus, reason?: string): string | null {
  if (!PCN_EXCEPTION_STATUSES.has(status)) return null;
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) return 'Hồ sơ ở lane ngoại lệ phải có lý do được xác nhận.';
  if (normalizedReason.length > 1000) return 'Lý do ngoại lệ vượt quá độ dài 1000 ký tự.';
  return null;
}

export function transitionPcnDossier(from: PcnDossierStatus, to: PcnDossierStatus): {
  status: PcnDossierStatus;
  statusLabel: string;
} {
  if (!isPcnDossierTransitionAllowed(from, to)) {
    throw new Error(`Không thể chuyển hồ sơ PCN từ ${from} sang ${to}`);
  }
  return { status: to, statusLabel: getPcnDossierStatusLabel(to) };
}

export function getPcnDossierMethodChangeDenial(
  dossier: { method: PcnCertificationMethod },
  nextMethod: PcnCertificationMethod,
  hasIssuancePackage: boolean,
): string | null {
  if (dossier.method === nextMethod || !hasIssuancePackage) return null;
  return 'Không thể đổi phương thức vì hồ sơ đã có bộ phát hành';
}

export function getPcnTemplateCode(
  method: PcnCertificationMethod,
  documentType: PcnIssuanceDocumentType,
): string {
  return TEMPLATE_CODES[method][documentType];
}

export function getOfficialPcnResultRound(
  results: Array<{ round: number; outcome: PcnResultOutcome }>,
): number | null {
  const ordered = results
    .filter((result) => Number.isInteger(result.round) && result.round > 0 && result.outcome !== 'PENDING')
    .sort((left, right) => left.round - right.round);
  if (ordered.length === 0) return null;

  const firstFailure = ordered.find((result) => result.outcome === 'FAIL');
  if (firstFailure) {
    return ordered.find((result) => result.round > firstFailure.round)?.round ?? firstFailure.round;
  }
  return ordered[0].round;
}
