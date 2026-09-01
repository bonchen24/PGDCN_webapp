// Author: Codex
// OS support: Browser/Node
// Description: The five user-facing PCN workflow stages; detailed statuses remain internal adapters.

import type { CertificationDossier, PcnDossierStatus, PcnDocumentRequirementStage, PcnGeneratedDocumentKind, PcnOperationalFormKind } from '../types.ts';
import type { PcnPipelineStationKey } from './pcnDossierPipeline.ts';

export interface PcnWorkflowStage {
  key: PcnPipelineStationKey;
  number: number;
  title: string;
  description: string;
  actionLabel: string;
  statuses: readonly PcnDossierStatus[];
  detailedStationKeys: readonly PcnPipelineStationKey[];
  requirementStages: readonly PcnDocumentRequirementStage[];
}

export const PCN_WORKFLOW_STAGES: readonly PcnWorkflowStage[] = [
  {
    key: 'INTAKE',
    number: 1,
    title: 'Tiếp nhận & đầu vào',
    description: 'Xử lý Đề nghị, phân công, kế hoạch và kiểm tra đầu vào.',
    actionLabel: 'Xử lý đầu vào',
    statuses: ['DRAFT', 'INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'ASSIGNED', 'PLAN_PENDING_APPROVAL', 'FIELD_EVALUATION'],
    detailedStationKeys: ['INTAKE', 'DOCUMENTS', 'ASSIGNMENT', 'EVALUATION'],
    requirementStages: ['INTAKE'],
  },
  {
    key: 'SAMPLING_LAB',
    number: 2,
    title: 'Lấy mẫu & gửi PTN',
    description: 'Mã hóa theo lô, lập PYC và theo dõi giao mẫu tới PTN.',
    actionLabel: 'Xử lý mẫu & PYC',
    statuses: ['AWAITING_SAMPLING', 'SENT_TO_LAB'],
    detailedStationKeys: ['SAMPLING_LAB'],
    requirementStages: ['LAB_ROUTING'],
  },
  {
    key: 'RESULTS',
    number: 3,
    title: 'KQTN & soát xét',
    description: 'Nhận scan KQTN, xác nhận OCR, xử lý bổ sung và soát xét kỹ thuật.',
    actionLabel: 'Xử lý KQTN & soát xét',
    statuses: ['AWAITING_RESULTS', 'CORRECTIVE_ACTION', 'TECHNICAL_REVIEW'],
    detailedStationKeys: ['RESULTS', 'CORRECTION', 'TECHNICAL_REVIEW'],
    requirementStages: ['TECHNICAL_REVIEW'],
  },
  {
    key: 'APPROVAL',
    number: 4,
    title: 'Phê duyệt & phát hành',
    description: 'Đóng gói, trình duyệt, cấp số và phát hành GCN/QĐ.',
    actionLabel: 'Xử lý phê duyệt & phát hành',
    statuses: ['WAITING_APPROVAL', 'APPROVED', 'ISSUED'],
    detailedStationKeys: ['APPROVAL', 'ISSUANCE'],
    requirementStages: ['ISSUANCE'],
  },
  {
    key: 'DELIVERY_ARCHIVE',
    number: 5,
    title: 'Giao khách hàng & lưu hồ sơ',
    description: 'Giao bộ hồ sơ, ghi nhận bàn giao và hoàn tất bản lưu.',
    actionLabel: 'Hoàn tất giao & lưu hồ sơ',
    statuses: ['DELIVERED', 'ARCHIVED'],
    detailedStationKeys: ['DELIVERY_ARCHIVE'],
    requirementStages: ['DELIVERY', 'ARCHIVE'],
  },
] as const;

export function getPcnWorkflowStage(status: PcnDossierStatus): PcnWorkflowStage | undefined {
  return PCN_WORKFLOW_STAGES.find((stage) => stage.statuses.includes(status));
}

export function getPcnWorkflowStageByKey(key: PcnPipelineStationKey): PcnWorkflowStage | undefined {
  return PCN_WORKFLOW_STAGES.find((stage) => stage.key === key);
}

export function getPcnWorkflowStageIndex(key: PcnPipelineStationKey): number {
  return PCN_WORKFLOW_STAGES.findIndex((stage) => stage.key === key);
}

export const PCN_OPERATIONAL_FORM_STAGE_KEYS: Readonly<Record<PcnOperationalFormKind, PcnPipelineStationKey>> = {
  ASSIGNMENT_FORM: 'INTAKE',
  EVALUATION_PLAN: 'INTAKE',
  FIELD_INSPECTION: 'INTAKE',
  SAMPLE_TAKING: 'SAMPLING_LAB',
  SAMPLE_CODING: 'SAMPLING_LAB',
  EVALUATION_REPORT: 'RESULTS',
  COMMERCIAL: 'DELIVERY_ARCHIVE',
};

export function getPcnOperationalFormWorkflowStageIndex(kind: PcnOperationalFormKind): number {
  return getPcnWorkflowStageIndex(PCN_OPERATIONAL_FORM_STAGE_KEYS[kind]);
}

export function canProcessPcnOperationalForm(dossier: Pick<CertificationDossier, 'status'>, kind: PcnOperationalFormKind): boolean {
  const currentStage = getPcnWorkflowStage(dossier.status);
  if (!currentStage) return true;
  const formStageIndex = getPcnOperationalFormWorkflowStageIndex(kind);
  return formStageIndex >= 0 && formStageIndex <= getPcnWorkflowStageIndex(currentStage.key);
}

/** PYC is a stage-2 action, with the correction lane allowed to issue a retest. */
export function canCreatePcnLabRequest(dossier: Pick<CertificationDossier, 'status'>): boolean {
  return ['AWAITING_SAMPLING', 'SENT_TO_LAB', 'AWAITING_RESULTS', 'CORRECTIVE_ACTION'].includes(dossier.status);
}

export function canProcessPcnSampleFlow(dossier: Pick<CertificationDossier, 'status'>): boolean {
  const currentStage = getPcnWorkflowStage(dossier.status);
  if (!currentStage) return true;
  return getPcnWorkflowStageIndex(currentStage.key) >= getPcnWorkflowStageIndex('SAMPLING_LAB') && dossier.status !== 'ARCHIVED';
}

const PCN_GENERATED_DOCUMENT_STAGE_KEYS: Readonly<Partial<Record<PcnGeneratedDocumentKind, PcnPipelineStationKey>>> = {
  PROPOSAL_SUMMARY: 'INTAKE',
  PROPOSAL_FORM: 'INTAKE',
  ASSIGNMENT_FORM: 'INTAKE',
  EVALUATION_PLAN: 'INTAKE',
  FIELD_INSPECTION: 'INTAKE',
  SAMPLE_TAKING: 'SAMPLING_LAB',
  SAMPLE_CODING: 'SAMPLING_LAB',
  SAMPLE_HANDOVER: 'SAMPLING_LAB',
  SAMPLE_RETURN: 'SAMPLING_LAB',
  LAB_REQUEST: 'SAMPLING_LAB',
  EVALUATION_REPORT: 'RESULTS',
};

export function canProcessPcnGeneratedDocument(
  dossier: Pick<CertificationDossier, 'status'>,
  kind: PcnGeneratedDocumentKind,
): boolean {
  const targetStageKey = PCN_GENERATED_DOCUMENT_STAGE_KEYS[kind];
  const currentStage = getPcnWorkflowStage(dossier.status);
  if (!targetStageKey || !currentStage) return true;
  return getPcnWorkflowStageIndex(targetStageKey) <= getPcnWorkflowStageIndex(currentStage.key);
}

// --- End of pcnWorkflowStages.ts ---
