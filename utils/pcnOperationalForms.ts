// Author: Codex
// OS support: Web/Node
// Description: Normalization and validation for structured PCN station forms

import type {
  PcnAssignmentForm,
  PcnCommercialForm,
  PcnEvaluationPlanForm,
  PcnEvaluationReportForm,
  PcnFieldInspectionForm,
  PcnOperationalFormKind,
  PcnOperationalForms,
  PcnSampleCodingForm,
  PcnSampleTakingForm,
} from '../types.ts';

type OperationalFormValue =
  | PcnAssignmentForm
  | PcnEvaluationPlanForm
  | PcnFieldInspectionForm
  | PcnSampleTakingForm
  | PcnSampleCodingForm
  | PcnEvaluationReportForm
  | PcnCommercialForm;

export const FORM_REQUIRED_FIELDS: Record<PcnOperationalFormKind, string[]> = {
  ASSIGNMENT_FORM: ['assignmentNumber', 'assignedAt', 'ownerUsername', 'evaluatorUsername', 'scope'],
  EVALUATION_PLAN: ['plannedStartAt', 'location', 'scope', 'criteria'],
  FIELD_INSPECTION: ['inspectedAt', 'location', 'participants', 'findings', 'conclusion'],
  SAMPLE_TAKING: ['sampledAt', 'location', 'samplingMethod', 'participants', 'sampleQuantity', 'sealCode'],
  SAMPLE_CODING: ['codedAt', 'coder', 'lotCode', 'sampleCodes', 'sealCode'],
  EVALUATION_REPORT: ['reportNumber', 'reportedAt', 'findings', 'conclusion'],
  COMMERCIAL: ['contractNumber', 'signedAt', 'customerSigner', 'pcnSigner', 'serviceScope'],
};

const FIELD_LABELS: Record<string, string> = {
  assignmentNumber: 'Số phiếu phân công',
  assignedAt: 'Ngày phân công',
  ownerUsername: 'Chủ hồ sơ',
  evaluatorUsername: 'Trưởng đoàn đánh giá',
  reviewerUsername: 'Người soát xét kỹ thuật',
  scope: 'Phạm vi đánh giá',
  plannedStartAt: 'Ngày bắt đầu đánh giá',
  plannedEndAt: 'Ngày kết thúc đánh giá',
  location: 'Địa điểm đánh giá',
  teamMembers: 'Thành viên đoàn đánh giá',
  criteria: 'Tiêu chí đánh giá',
  customerRepresentative: 'Đại diện khách hàng',
  inspectedAt: 'Ngày kiểm tra hiện trường',
  participants: 'Thành phần tham gia',
  findings: 'Kết quả/nhận xét',
  conclusion: 'Kết luận',
  nonconformities: 'Điểm không phù hợp',
  sampledAt: 'Ngày lấy mẫu',
  samplingMethod: 'Phương pháp lấy mẫu',
  sampleQuantity: 'Số lượng mẫu',
  unit: 'Đơn vị mẫu',
  packaging: 'Tình trạng bao gói',
  sealCode: 'Mã tem niêm phong',
  codedAt: 'Ngày mã hóa mẫu',
  coder: 'Người mã hóa mẫu',
  lotCode: 'Mã hóa mẫu theo lô',
  sampleCodes: 'Mã mẫu vật lý',
  reportNumber: 'Số báo cáo đánh giá',
  reportedAt: 'Ngày lập báo cáo',
  recommendations: 'Kiến nghị',
  contractNumber: 'Số hợp đồng',
  signedAt: 'Ngày ký hợp đồng',
  customerSigner: 'Đại diện khách hàng ký',
  pcnSigner: 'Đại diện PCN ký',
  serviceScope: 'Phạm vi dịch vụ',
};

const FORM_KIND_BY_KEY: Record<keyof PcnOperationalForms, PcnOperationalFormKind> = {
  assignment: 'ASSIGNMENT_FORM',
  evaluationPlan: 'EVALUATION_PLAN',
  fieldInspection: 'FIELD_INSPECTION',
  sampleTaking: 'SAMPLE_TAKING',
  sampleCoding: 'SAMPLE_CODING',
  evaluationReport: 'EVALUATION_REPORT',
  commercial: 'COMMERCIAL',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean);
}

function numberValue(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function requiredValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => text(item));
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  return Boolean(text(value));
}

function formForKind(kind: PcnOperationalFormKind, value: Record<string, unknown>): OperationalFormValue {
  const metadata = {
    ...(text(value.savedAt) ? { savedAt: text(value.savedAt) } : {}),
    ...(text(value.savedByUsername) ? { savedByUsername: text(value.savedByUsername) } : {}),
  };
  switch (kind) {
    case 'ASSIGNMENT_FORM':
      return {
        ...metadata,
        assignmentNumber: text(value.assignmentNumber),
        assignedAt: text(value.assignedAt),
        assignedBy: text(value.assignedBy),
        ownerUsername: text(value.ownerUsername),
        evaluatorUsername: text(value.evaluatorUsername),
        reviewerUsername: text(value.reviewerUsername),
        scope: text(value.scope),
        notes: text(value.notes),
      };
    case 'EVALUATION_PLAN':
      return {
        ...metadata,
        plannedStartAt: text(value.plannedStartAt),
        plannedEndAt: text(value.plannedEndAt),
        location: text(value.location),
        teamMembers: textArray(value.teamMembers),
        scope: text(value.scope),
        criteria: text(value.criteria),
        customerRepresentative: text(value.customerRepresentative),
        notes: text(value.notes),
      };
    case 'FIELD_INSPECTION':
      return {
        ...metadata,
        inspectedAt: text(value.inspectedAt),
        location: text(value.location),
        participants: textArray(value.participants),
        findings: text(value.findings),
        conclusion: text(value.conclusion),
        nonconformities: textArray(value.nonconformities),
        notes: text(value.notes),
      };
    case 'SAMPLE_TAKING':
      return {
        ...metadata,
        sampledAt: text(value.sampledAt),
        location: text(value.location),
        samplingMethod: text(value.samplingMethod),
        participants: textArray(value.participants),
        sampleQuantity: numberValue(value.sampleQuantity),
        unit: text(value.unit),
        packaging: text(value.packaging),
        sealCode: text(value.sealCode),
        notes: text(value.notes),
      };
    case 'SAMPLE_CODING':
      return {
        ...metadata,
        codedAt: text(value.codedAt),
        coder: text(value.coder),
        lotCode: text(value.lotCode),
        sampleCodes: textArray(value.sampleCodes),
        sealCode: text(value.sealCode),
        notes: text(value.notes),
      };
    case 'EVALUATION_REPORT':
      return {
        ...metadata,
        reportNumber: text(value.reportNumber),
        reportedAt: text(value.reportedAt),
        findings: text(value.findings),
        conclusion: text(value.conclusion),
        nonconformities: textArray(value.nonconformities),
        recommendations: text(value.recommendations),
        notes: text(value.notes),
      };
    case 'COMMERCIAL':
      return {
        ...metadata,
        contractNumber: text(value.contractNumber),
        signedAt: text(value.signedAt),
        customerSigner: text(value.customerSigner),
        pcnSigner: text(value.pcnSigner),
        serviceScope: text(value.serviceScope),
        serviceValue: text(value.serviceValue),
        paymentTerms: text(value.paymentTerms),
        notes: text(value.notes),
      };
  }
}

function formKey(kind: PcnOperationalFormKind): keyof PcnOperationalForms {
  switch (kind) {
    case 'ASSIGNMENT_FORM': return 'assignment';
    case 'EVALUATION_PLAN': return 'evaluationPlan';
    case 'FIELD_INSPECTION': return 'fieldInspection';
    case 'SAMPLE_TAKING': return 'sampleTaking';
    case 'SAMPLE_CODING': return 'sampleCoding';
    case 'EVALUATION_REPORT': return 'evaluationReport';
    case 'COMMERCIAL': return 'commercial';
  }
}

export function validatePcnOperationalForm(kind: PcnOperationalFormKind, value: unknown): Record<string, string> {
  const normalized = formForKind(kind, value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
  const errors: Record<string, string> = {};
  for (const field of FORM_REQUIRED_FIELDS[kind]) {
    if (!requiredValue((normalized as unknown as Record<string, unknown>)[field])) {
      const label = FIELD_LABELS[field] || field;
      errors[field] = `${label} là bắt buộc.`;
    }
  }
  return errors;
}

export function mergePcnOperationalForm(current: PcnOperationalForms | undefined, kind: PcnOperationalFormKind, value: unknown): PcnOperationalForms {
  const normalized = formForKind(kind, value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
  const key = formKey(kind);
  return { ...(current || {}), [key]: normalized } as PcnOperationalForms;
}

export function getPcnOperationalFormKey(kind: PcnOperationalFormKind): keyof PcnOperationalForms {
  return formKey(kind);
}

export function getPcnOperationalFormKind(key: string): PcnOperationalFormKind | undefined {
  const entry = Object.entries(FORM_KIND_BY_KEY).find(([formKeyName]) => formKeyName === key);
  return entry?.[1];
}

export function normalizePcnOperationalFormsPatch(value: unknown): { forms: PcnOperationalForms; errors: Record<string, string> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { forms: {}, errors: { operationalForms: 'Dữ liệu form nghiệp vụ phải là một đối tượng.' } };
  }
  const forms: PcnOperationalForms = {};
  const errors: Record<string, string> = {};
  for (const [key, formValue] of Object.entries(value)) {
    const kind = FORM_KIND_BY_KEY[key as keyof PcnOperationalForms];
    if (!kind) {
      errors[`operationalForms.${key}`] = 'Form nghiệp vụ không được hỗ trợ.';
      continue;
    }
    const formErrors = validatePcnOperationalForm(kind, formValue);
    for (const [field, message] of Object.entries(formErrors)) errors[`operationalForms.${key}.${field}`] = message;
    const normalized = mergePcnOperationalForm(forms, kind, formValue)[key as keyof PcnOperationalForms];
    if (normalized) (forms as Record<string, unknown>)[key] = normalized;
  }
  return { forms, errors };
}

// --- End of pcnOperationalForms.ts ---
