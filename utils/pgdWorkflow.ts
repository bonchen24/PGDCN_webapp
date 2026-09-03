// Author: Codex
// OS support: Browser/Node
// Description: PCN-style operational stations and evidence gates for PGD.

import {
  getPgdTransitionDenial,
  type PgdFieldInspection,
  type PgdInspectionAssignment,
  type PgdInspectionStatus,
  type PgdLabRequest,
  type PgdResultTemplate,
  type PgdResultValue,
  type PgdTransitionContext,
} from './pgdDomain.ts';

export type PgdOperationalStationKey =
  | 'INTAKE_CAPABILITY'
  | 'PREPARATION'
  | 'FIELD_SAMPLING'
  | 'LAB_RESULTS'
  | 'REPORT_APPROVAL_RETURN';

export interface PgdOperationalStation {
  key: PgdOperationalStationKey;
  number: number;
  title: string;
  description: string;
  statuses: readonly PgdInspectionStatus[];
}

export const PGD_OPERATIONAL_STATIONS: readonly PgdOperationalStation[] = [
  {
    key: 'INTAKE_CAPABILITY',
    number: 1,
    title: 'Tiếp nhận & năng lực',
    description: 'Kiểm tra PYC, phạm vi và khả năng thực hiện.',
    statuses: ['DRAFT', 'CAPABILITY_REVIEW'],
  },
  {
    key: 'PREPARATION',
    number: 2,
    title: 'Chuẩn bị & phân công',
    description: 'Phê duyệt phân công và chuẩn bị kế hoạch hiện trường.',
    statuses: ['READY_TO_EXECUTE', 'PREPARING'],
  },
  {
    key: 'FIELD_SAMPLING',
    number: 3,
    title: 'Hiện trường & lấy mẫu',
    description: 'Ghi nhận biên bản hiện trường, lô hàng và mẫu.',
    statuses: ['FIELD_INSPECTION'],
  },
  {
    key: 'LAB_RESULTS',
    number: 4,
    title: 'PTN & xem xét kết quả',
    description: 'Bàn giao mẫu, nhận kết quả và đối chiếu với PYC.',
    statuses: ['WAITING_LAB_RESULTS', 'RESULTS_REVIEW'],
  },
  {
    key: 'REPORT_APPROVAL_RETURN',
    number: 5,
    title: 'Báo cáo, phê duyệt & trả kết quả',
    description: 'Lập báo cáo, duyệt kỹ thuật, ký và trả chứng thư.',
    statuses: ['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL', 'SIGNED', 'RESULT_RETURNED', 'ARCHIVED'],
  },
] as const;

const POST_SIGNATURE_STATUSES = new Set<PgdInspectionStatus>(['SIGNED', 'RESULT_RETURNED', 'ARCHIVED']);

export function getPgdPostSignatureMutationDenial(status: PgdInspectionStatus): string | null {
  return POST_SIGNATURE_STATUSES.has(status)
    ? 'Hồ sơ PGD đã ký/trả kết quả/lưu trữ; mọi tài liệu và bằng chứng nghiệp vụ đã bị khóa.'
    : null;
}

export function getPgdAssignmentApprovalDenial(
  status: PgdInspectionAssignment['status'],
  user: { role?: string; systemRole?: string; pgdRole?: string } = {},
): string | null {
  if (status !== 'APPROVED') return null;
  const systemRole = String(user.systemRole || user.role || '').trim().toLowerCase();
  const pgdRole = String(user.pgdRole || '').trim().toUpperCase();
  if (systemRole === 'admin' || ['PGD_ADMIN', 'PGD_MANAGER'].includes(pgdRole)) return null;
  return 'Chỉ quản lý PGD hoặc Admin mới được phê duyệt phân công PGD.';
}

export function getPgdOperationalStation(status: PgdInspectionStatus): PgdOperationalStation {
  return PGD_OPERATIONAL_STATIONS.find((station) => station.statuses.includes(status)) || PGD_OPERATIONAL_STATIONS[0];
}

export function getPgdOperationalStationByKey(key: PgdOperationalStationKey): PgdOperationalStation {
  return PGD_OPERATIONAL_STATIONS.find((station) => station.key === key) || PGD_OPERATIONAL_STATIONS[0];
}

export interface PgdOperationalStepAccess {
  editable: boolean;
  locked: boolean;
  requiresWithdrawal: boolean;
  reason?: string;
}

export function getPgdOperationalStepAccess(input: {
  status: PgdInspectionStatus;
  targetStationKey: PgdOperationalStationKey;
}): PgdOperationalStepAccess {
  if (getPgdPostSignatureMutationDenial(input.status)) {
    return {
      editable: false,
      locked: true,
      requiresWithdrawal: true,
      reason: 'Hồ sơ đã ký/trả kết quả; phải thực hiện thu hồi có lý do trước khi chỉnh sửa.',
    };
  }

  const currentStation = getPgdOperationalStation(input.status);
  const targetStation = getPgdOperationalStationByKey(input.targetStationKey);
  if (targetStation.number > currentStation.number) {
    return {
      editable: false,
      locked: true,
      requiresWithdrawal: false,
      reason: 'Trạm sau đang bị khóa; hãy hoàn tất trạm hiện tại trước.',
    };
  }

  return { editable: true, locked: false, requiresWithdrawal: false };
}

export interface PgdStepEvidence {
  hasApprovedAssignment?: boolean;
  hasFieldInspection?: boolean;
  hasSampleHandover?: boolean;
  labRequests?: PgdLabRequest[];
  reportReady?: boolean;
  hasCertificate?: boolean;
  signed?: boolean;
}

export interface PgdStepGate {
  stationKey: PgdOperationalStationKey;
  complete: boolean;
  missingEvidence: string[];
}

export function buildPgdStepGate(input: {
  stationKey: PgdOperationalStationKey;
  status: PgdInspectionStatus;
  evidence: PgdStepEvidence;
}): PgdStepGate {
  const missingEvidence: string[] = [];
  const labRequests = input.evidence.labRequests || [];

  if (input.stationKey === 'PREPARATION' && input.status === 'CAPABILITY_REVIEW' && !input.evidence.hasApprovedAssignment) {
    missingEvidence.push('ASSIGNMENT_APPROVED');
  }
  if (input.stationKey === 'FIELD_SAMPLING' && input.status === 'FIELD_INSPECTION') {
    if (!input.evidence.hasFieldInspection) missingEvidence.push('FIELD_INSPECTION');
    if (!input.evidence.hasSampleHandover) missingEvidence.push('SAMPLE_HANDOVER');
  }
  if (input.stationKey === 'LAB_RESULTS' && input.status === 'WAITING_LAB_RESULTS') {
    if (!input.evidence.hasSampleHandover) missingEvidence.push('SAMPLE_HANDOVER');
    if (labRequests.length === 0) missingEvidence.push('LAB_REQUEST');
    for (const request of labRequests) {
      if (!['RESULT_RECEIVED', 'CLOSED'].includes(request.status)) missingEvidence.push(`LAB_RESULT:${request.id}`);
    }
  }
  if (input.stationKey === 'REPORT_APPROVAL_RETURN') {
    if (input.status === 'TECHNICAL_REVIEW' && !input.evidence.reportReady) missingEvidence.push('REPORT_READY');
    if (input.status === 'LEADERSHIP_APPROVAL' && !input.evidence.hasCertificate) missingEvidence.push('CERTIFICATE_DRAFT');
    if (input.status === 'SIGNED' && !input.evidence.signed) missingEvidence.push('CERTIFICATE_SIGNED');
  }

  return {
    stationKey: input.stationKey,
    complete: missingEvidence.length === 0,
    missingEvidence,
  };
}

export function getPgdOperationalStepGateDenial(input: {
  currentStatus: PgdInspectionStatus;
  nextStatus: PgdInspectionStatus;
  evidence: PgdStepEvidence;
}): string | null {
  const currentStation = getPgdOperationalStation(input.currentStatus);
  const nextStation = getPgdOperationalStation(input.nextStatus);
  if (nextStation.number > currentStation.number && nextStation.number !== currentStation.number + 1) {
    return getPgdTransitionDenial(input.currentStatus, input.nextStatus, input.evidence as PgdTransitionContext);
  }

  const gate = buildPgdStepGate({ stationKey: currentStation.key, status: input.currentStatus, evidence: input.evidence });
  if (!gate.complete) {
    return `Chưa hoàn tất trạm ${currentStation.title}: ${gate.missingEvidence.join(', ')}.`;
  }

  return getPgdTransitionDenial(input.currentStatus, input.nextStatus, input.evidence as PgdTransitionContext);
}

function isEmpty(value: PgdResultValue['value'] | undefined): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

export interface PgdResultValueIssue {
  key: string;
  message: string;
}

export function validatePgdResultValues(template: PgdResultTemplate, values: PgdResultValue[]): PgdResultValueIssue[] {
  const byKey = new Map(values.map((value) => [value.key, value]));
  const issues: PgdResultValueIssue[] = [];
  for (const field of template.fields) {
    const value = byKey.get(field.key)?.value;
    if (field.required && isEmpty(value)) {
      issues.push({ key: field.key, message: `Thiếu trường bắt buộc “${field.label}”.` });
      continue;
    }
    if (isEmpty(value)) continue;
    if (field.type === 'NUMBER' && (typeof value === 'boolean' || !Number.isFinite(typeof value === 'number' ? value : Number(String(value))))) {
      issues.push({ key: field.key, message: `Trường “${field.label}” phải là số.` });
    }
    if (field.type === 'BOOLEAN' && typeof value !== 'boolean' && !['true', 'false'].includes(String(value).trim().toLowerCase())) {
      issues.push({ key: field.key, message: `Trường “${field.label}” phải là Có/Không.` });
    }
  }
  return issues;
}

export function buildPgdResultValues(
  template: PgdResultTemplate,
  inputs: Record<string, string | number | boolean | null | undefined>,
): PgdResultValue[] {
  return template.fields.map((field) => {
    const rawValue = inputs[field.key];
    let value: PgdResultValue['value'] = rawValue === undefined ? null : rawValue;
    if (field.type === 'NUMBER' && typeof rawValue === 'string' && rawValue.trim() !== '') {
      value = Number(rawValue);
    }
    if (field.type === 'BOOLEAN' && typeof rawValue === 'string') {
      const normalized = rawValue.trim().toLowerCase();
      value = normalized === 'true' ? true : normalized === 'false' ? false : rawValue;
    }
    return { key: field.key, label: field.label, value, unit: field.unit };
  });
}

export function buildPgdFieldInspection(
  input: Omit<PgdFieldInspection, 'domain' | 'completed'> & { completed?: boolean },
): PgdFieldInspection {
  const location = String(input.location || '').trim();
  if (!location) throw new Error('Biên bản hiện trường PGD cần có địa điểm.');
  const inspectorUsernames = Array.from(new Set(input.inspectorUsernames.map((username) => String(username).trim()).filter(Boolean)));
  if (inspectorUsernames.length === 0) throw new Error('Biên bản hiện trường PGD cần có giám định viên.');
  const nonconformities = (input.nonconformities || []).map((value) => String(value).trim()).filter(Boolean);
  return {
    ...input,
    domain: 'pgd',
    location,
    inspectorUsernames,
    measurements: input.measurements ? { ...input.measurements } : undefined,
    nonconformities,
    inspectionResult: String(input.inspectionResult || '').trim() || undefined,
    customerRepresentative: String(input.customerRepresentative || '').trim() || undefined,
    sampleIds: Array.from(new Set(input.sampleIds.map((sampleId) => String(sampleId).trim()).filter(Boolean))),
    completed: input.completed !== false,
  };
}

// --- End of pgdWorkflow.ts ---
