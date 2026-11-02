// Author: Codex
// OS support: Browser/Node
// Description: Shared PCN dossier station mapping and manager-facing completeness policy

import type {
  CertificationDossier,
  CertificationProposal,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDossierDocumentVersion,
  PcnDossierDocumentWaiver,
  PcnDossierStatus,
  PcnDocumentRequirementStage,
  PcnDossierStationKey,
} from '../types.ts';
import { getPcnDossierAssignmentDenial, type PcnDossierAssignmentInput } from './pcnDossierAssignment.ts';
import { reviewPcnCodes, type PcnCodeReview } from './pcnCodePolicy.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS, getPcnDocumentRequirements, getPcnDossierRequirementsWithCustom, isPcnDossierDocumentCurrentAndConfirmed } from './pcnDossierDocuments.ts';
import { getPcnWorkflowStageByKey } from './pcnWorkflowStages.ts';
import { isPcnDocumentWaiverValid } from './pcnDocumentWaivers.ts';

export type PcnPipelineStationKey = PcnDossierStationKey;

export interface PcnPipelineStation {
  key: PcnPipelineStationKey;
  number?: number;
  title: string;
  description: string;
  actionLabel: string;
  statuses: readonly PcnDossierStatus[];
  requirementStages: readonly PcnDocumentRequirementStage[];
}

const EXCEPTION_STATION: PcnPipelineStation = {
  key: 'EXCEPTIONS',
  title: 'Ngoại lệ / cần xử lý',
  description: 'Hồ sơ tạm dừng, bị trả lại hoặc đã hủy.',
  actionLabel: 'Mở để xử lý ngoại lệ',
  statuses: ['ON_HOLD', 'REJECTED', 'CANCELLED'],
  requirementStages: [],
};

/** Main business stations. Exception statuses are kept in a separate lane. */
export const PCN_PIPELINE_STATIONS: readonly PcnPipelineStation[] = [
  { key: 'INTAKE', number: 1, title: 'Tiếp nhận Đề nghị', description: 'Kiểm tra đầu vào và mở mã hồ sơ.', actionLabel: 'Kiểm tra Đề nghị', statuses: ['DRAFT', 'INTAKE_REVIEW'], requirementStages: ['INTAKE'] },
  { key: 'DOCUMENTS', number: 2, title: 'Bổ sung hồ sơ', description: 'Thu đủ tài liệu bắt buộc trước khi phân công.', actionLabel: 'Tải tài liệu còn thiếu', statuses: ['AWAITING_DOCUMENTS'], requirementStages: ['INTAKE'] },
  { key: 'ASSIGNMENT', number: 3, title: 'Phân công & kế hoạch', description: 'Giao chủ hồ sơ, chuyên gia và kế hoạch thực hiện.', actionLabel: 'Xác nhận phân công', statuses: ['ASSIGNED', 'PLAN_PENDING_APPROVAL'], requirementStages: ['INTAKE'] },
  { key: 'EVALUATION', number: 4, title: 'Đánh giá', description: 'Thực hiện đánh giá theo lĩnh vực và phương thức.', actionLabel: 'Ghi nhận đánh giá', statuses: ['FIELD_EVALUATION'], requirementStages: ['INTAKE'] },
  { key: 'SAMPLING_LAB', number: 5, title: 'Lấy mẫu & gửi PTN', description: 'Lập biên bản, PYC và theo dõi đường đi của mẫu.', actionLabel: 'Hoàn tất chuyển PTN', statuses: ['AWAITING_SAMPLING', 'SENT_TO_LAB'], requirementStages: ['LAB_ROUTING'] },
  { key: 'RESULTS', number: 6, title: 'Chờ kết quả', description: 'Đối chiếu kết quả trả về với hồ sơ.', actionLabel: 'Đối chiếu KQTN', statuses: ['AWAITING_RESULTS'], requirementStages: ['LAB_ROUTING', 'TECHNICAL_REVIEW'] },
  { key: 'CORRECTION', number: 7, title: 'Khắc phục', description: 'Theo dõi công văn và bằng chứng khắc phục nếu có.', actionLabel: 'Theo dõi khắc phục', statuses: ['CORRECTIVE_ACTION'], requirementStages: ['TECHNICAL_REVIEW'] },
  { key: 'TECHNICAL_REVIEW', number: 8, title: 'Soát xét kỹ thuật', description: 'Kiểm tra tính đầy đủ và nhất quán trước phê duyệt.', actionLabel: 'Mở kiểm tra trực quan', statuses: ['TECHNICAL_REVIEW'], requirementStages: ['TECHNICAL_REVIEW'] },
  { key: 'APPROVAL', number: 9, title: 'Trình phê duyệt', description: 'Đóng gói và trình lãnh đạo kiểm tra, phê duyệt.', actionLabel: 'Mở gói trình duyệt', statuses: ['WAITING_APPROVAL', 'APPROVED'], requirementStages: ['ISSUANCE'] },
  { key: 'ISSUANCE', number: 10, title: 'Phát hành', description: 'Phát hành giấy chứng nhận, quyết định theo biểu mẫu đã duyệt.', actionLabel: 'Kiểm tra phát hành', statuses: ['ISSUED'], requirementStages: ['ISSUANCE'] },
  { key: 'DELIVERY_ARCHIVE', number: 11, title: 'Giao & lưu trữ', description: 'Giao khách hàng, hoàn thiện bản lưu và đóng hồ sơ.', actionLabel: 'Đóng gói lưu trữ', statuses: ['DELIVERED', 'ARCHIVED'], requirementStages: ['DELIVERY', 'ARCHIVE'] },
] as const;

const ALL_STATIONS = [...PCN_PIPELINE_STATIONS, EXCEPTION_STATION];

export function getPcnPipelineStation(status: PcnDossierStatus): PcnPipelineStation {
  return ALL_STATIONS.find((station) => station.statuses.includes(status)) || EXCEPTION_STATION;
}

export function getPcnPipelineStationByKey(key: PcnPipelineStationKey): PcnPipelineStation {
  return ALL_STATIONS.find((station) => station.key === key) || EXCEPTION_STATION;
}

/** Local, read-only field scope used by the Kanban and other PCN work surfaces. */
export function filterPcnDossiersByField(
  dossiers: CertificationDossier[],
  fieldCode?: string,
): CertificationDossier[] {
  const normalizedFieldCode = String(fieldCode || '').trim();
  if (!normalizedFieldCode) return dossiers;
  return dossiers.filter((dossier) => dossier.fieldCodes.includes(normalizedFieldCode));
}

function getStationStages(status: PcnDossierStatus): readonly PcnDocumentRequirementStage[] {
  const station = getPcnPipelineStation(status);
  if (station.key !== 'DELIVERY_ARCHIVE') return station.requirementStages;
  return status === 'ARCHIVED' ? ['ARCHIVE'] : ['DELIVERY'];
}

export function getPcnPipelineStationRequirements(
  status: PcnDossierStatus,
  fieldCodes: string[],
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
): PcnDocumentRequirement[] {
  const station = getPcnPipelineStation(status);
  const stages = new Set(getStationStages(status));
  if (stages.size === 0) return [];
  return getPcnDocumentRequirements(fieldCodes as CertificationDossier['fieldCodes'], requirements).filter((item) => {
    if (Array.isArray(item.stationKeys) && item.stationKeys.length > 0) return item.stationKeys.includes(station.key);
    return item.stages.some((stage) => stages.has(stage));
  });
}

export function getPcnPipelineStationCatalog(
  station: PcnPipelineStation,
  fieldCodes: CertificationDossier['fieldCodes'],
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
): PcnDocumentRequirement[] {
  const stages = new Set(station.requirementStages);
  if (stages.size === 0) return [];
  return getPcnDocumentRequirements(fieldCodes, requirements)
    .filter((item) => Array.isArray(item.stationKeys) && item.stationKeys.length > 0
      ? item.stationKeys.includes(station.key)
      : item.stages.some((stage) => stages.has(stage)))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'vi'));
}

export interface PcnPipelineRequirementDisplayGroup {
  key: string;
  code: string;
  name: string;
  fieldCodes: string[];
  requirementIds: string[];
  requiredForAll: boolean;
  requiredForSome: boolean;
}

/**
 * Build the compact, read-only requirement projection used by the Kanban.
 * Requirement rows remain field-specific in the checklist; only equal document
 * codes are grouped for the multi-field board summary.
 */
export function groupPcnPipelineRequirementsForDisplay(
  requirements: PcnDocumentRequirement[],
): PcnPipelineRequirementDisplayGroup[] {
  const groups = new Map<string, PcnPipelineRequirementDisplayGroup>();

  for (const requirement of requirements) {
    const code = String(requirement.code || requirement.id).trim();
    const key = code.toUpperCase() || requirement.id;
    const existing = groups.get(key);
    if (!existing) {
      const required = Boolean(requirement.required);
      groups.set(key, {
        key,
        code: code || requirement.id,
        name: requirement.name,
        fieldCodes: [requirement.fieldCode],
        requirementIds: [requirement.id],
        requiredForAll: required,
        requiredForSome: required,
      });
      continue;
    }

    existing.fieldCodes = [...new Set([...existing.fieldCodes, requirement.fieldCode])].sort((left, right) =>
      left.localeCompare(right, 'en'),
    );
    existing.requirementIds.push(requirement.id);
    existing.requiredForAll = existing.requiredForAll && Boolean(requirement.required);
    existing.requiredForSome = existing.requiredForSome || Boolean(requirement.required);
    if (existing.name !== requirement.name && !existing.name.includes(requirement.name)) {
      existing.name = `${existing.name} / ${requirement.name}`;
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    fieldCodes: [...group.fieldCodes].sort((left, right) => left.localeCompare(right, 'en')),
  })).sort((left, right) => {
    const leftIndex = requirements.findIndex((item) => item.id === left.requirementIds[0]);
    const rightIndex = requirements.findIndex((item) => item.id === right.requirementIds[0]);
    return leftIndex - rightIndex || left.name.localeCompare(right.name, 'vi');
  });
}

const CORE_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'proposal', label: 'Đề nghị liên kết' },
  { key: 'customer', label: 'Khách hàng' },
  { key: 'product', label: 'Sản phẩm' },
  { key: 'fieldCodes', label: 'Lĩnh vực' },
  { key: 'method', label: 'Phương thức' },
  { key: 'owner', label: 'Chủ hồ sơ' },
];

function hasCurrentDocument(document: PcnDossierDocument | undefined): boolean {
  return isPcnDossierDocumentCurrentAndConfirmed(document);
}

export interface PcnDossierStationChecklistItem {
  requirement: PcnDocumentRequirement;
  status: 'PRESENT' | 'MISSING' | 'UPLOADED' | 'GENERATED' | 'CONFIRMED' | 'WAIVED';
  versionCount: number;
  currentVersion?: PcnDossierDocumentVersion;
  waiver?: PcnDossierDocumentWaiver;
}

export interface PcnDossierStationChecklist {
  station: PcnPipelineStation;
  items: PcnDossierStationChecklistItem[];
  present: number;
  total: number;
  missing: number;
  requiredPresent: number;
  requiredResolved: number;
  requiredTotal: number;
  requiredMissing: number;
}

export interface PcnDossierMissingDocumentGroup {
  stage: PcnDocumentRequirementStage;
  label: string;
  labels: string[];
}

const DOCUMENT_STAGE_ORDER: readonly PcnDocumentRequirementStage[] = [
  'INTAKE',
  'LAB_ROUTING',
  'TECHNICAL_REVIEW',
  'ISSUANCE',
  'DELIVERY',
  'ARCHIVE',
];

const DOCUMENT_STAGE_LABELS: Record<PcnDocumentRequirementStage, string> = {
  INTAKE: 'Tiếp nhận & đầu vào',
  LAB_ROUTING: 'Lấy mẫu & gửi PTN',
  TECHNICAL_REVIEW: 'KQTN & đánh giá / hoàn thiện & soát xét trước duyệt',
  ISSUANCE: 'Phê duyệt',
  DELIVERY: 'Giao khách hàng',
  ARCHIVE: 'Lưu hồ sơ',
};

/**
 * Read-only station projection for the dossier header. It deliberately uses
 * the same active requirement source and current-version rule as completeness.
 */
export function buildPcnDossierStationChecklist(input: {
  dossierId: string;
  status: PcnDossierStatus;
  stationKey?: PcnPipelineStationKey;
  fieldCodes: CertificationDossier['fieldCodes'];
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver>;
  /** Collapse the detailed internal routing into one of the five user-facing steps. */
  workflowStageKey?: PcnPipelineStationKey;
}): PcnDossierStationChecklist {
  const workflowStage = input.workflowStageKey ? getPcnWorkflowStageByKey(input.workflowStageKey) : undefined;
  const station = workflowStage
    ? {
      key: workflowStage.key,
      number: workflowStage.number,
      title: workflowStage.title,
      description: workflowStage.description,
      actionLabel: workflowStage.actionLabel,
      statuses: workflowStage.statuses,
      requirementStages: workflowStage.requirementStages,
    }
    : input.stationKey ? getPcnPipelineStationByKey(input.stationKey) : getPcnPipelineStation(input.status);
  const stationRequirements = workflowStage
    ? getPcnDocumentRequirements(input.fieldCodes, input.requirements).filter((item) => item.stationKeys?.length
      ? item.stationKeys.some((key) => workflowStage.detailedStationKeys.includes(key))
      : item.stages.some((stage) => workflowStage.requirementStages.includes(stage)))
    : input.stationKey
      ? getPcnPipelineStationCatalog(station, input.fieldCodes, input.requirements)
      : getPcnPipelineStationRequirements(input.status, input.fieldCodes, input.requirements);
  const documentByRequirement = new Map(
    input.documents
      .filter((document) => document.dossierId === input.dossierId)
      .map((document) => [document.requirementId, document]),
  );
  const items = stationRequirements.map((requirement) => {
    const document = documentByRequirement.get(requirement.id);
    const currentVersion = document && document.status === 'PRESENT' && document.currentVersionId
      ? document.versions.find((version) => version.assetId === document.currentVersionId)
      : undefined;
    const waiver = input.documentWaivers?.[requirement.id];
    const status: PcnDossierStationChecklistItem['status'] = currentVersion ? document?.lifecycleStatus || 'PRESENT' : isPcnDocumentWaiverValid(waiver) ? 'WAIVED' : 'MISSING';
    return {
      requirement,
      status,
      versionCount: document?.versions.length || 0,
      ...(currentVersion ? { currentVersion } : {}),
      ...(status === 'WAIVED' ? { waiver } : {}),
    };
  });
  const requiredItems = items.filter((item) => item.requirement.required);
  const present = items.filter((item) => item.status === 'PRESENT' || item.status === 'CONFIRMED').length;
  const requiredPresent = requiredItems.filter((item) => item.status === 'PRESENT' || item.status === 'CONFIRMED').length;
  const requiredResolved = requiredItems.filter((item) => ['PRESENT', 'CONFIRMED', 'WAIVED'].includes(item.status)).length;

  return {
    station,
    items,
    present,
    total: items.length,
    missing: items.filter((item) => !['PRESENT', 'CONFIRMED', 'WAIVED'].includes(item.status)).length,
    requiredPresent,
    requiredResolved,
    requiredTotal: requiredItems.length,
    requiredMissing: requiredItems.filter((item) => !['PRESENT', 'CONFIRMED', 'WAIVED'].includes(item.status)).length,
  };
}

export function getPcnDossierStationScore(
  checklist: Pick<PcnDossierStationChecklist, 'requiredPresent' | 'requiredTotal'> & { requiredResolved?: number },
): number | null {
  if (checklist.requiredTotal <= 0) return null;
  return Math.round(((checklist.requiredResolved ?? checklist.requiredPresent) / checklist.requiredTotal) * 100);
}

function hasCustomer(dossier: CertificationDossier, proposal?: CertificationProposal): boolean {
  return Boolean(dossier.customerSnapshot?.name?.trim() || proposal?.customerSnapshot?.name?.trim());
}

function uniqueLabels(labels: string[]): string[] {
  return [...new Set(labels)];
}

export interface PcnDossierCompleteness {
  score: number;
  stationScore: number | null;
  station: PcnPipelineStation;
  requiredDocumentTotal: number;
  requiredDocumentPresent: number;
  stationDocumentTotal: number;
  stationDocumentPresent: number;
  missingRequirementIds: string[];
  missingLabels: string[];
  missingRequiredByStage: PcnDossierMissingDocumentGroup[];
  stationMissingLabels: string[];
  coreFieldTotal: number;
  coreFieldPresent: number;
  missingCoreLabels: string[];
  hasOwner: boolean;
  codeReview: PcnCodeReview;
  stationChecklist: PcnDossierStationChecklist;
}

/**
 * A conservative score for the manager: required checklist items are 60% and
 * six core metadata fields are 40%. A missing item is never inferred from a
 * filename, status, or date; only the current, versioned document counts.
 */
export function buildPcnDossierCompleteness(input: {
  dossier: CertificationDossier;
  proposal?: CertificationProposal;
  requirements?: PcnDocumentRequirement[];
  documents?: PcnDossierDocument[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver>;
}): PcnDossierCompleteness {
  const requirements = getPcnDossierRequirementsWithCustom(input.dossier, input.requirements);
  const documentWaivers = input.documentWaivers || input.dossier.documentWaivers;
  const required = requirements.filter((item) => item.required);
  const documentByRequirement = new Map((input.documents || []).filter((item) => item.dossierId === input.dossier.id).map((item) => [item.requirementId, item]));
  const missingRequirementIds = required.filter((item) => !hasCurrentDocument(documentByRequirement.get(item.id)) && !isPcnDocumentWaiverValid(documentWaivers?.[item.id])).map((item) => item.id);
  const missingRequirements = required.filter((item) => missingRequirementIds.includes(item.id));
  const stationChecklist = buildPcnDossierStationChecklist({
    dossierId: input.dossier.id,
    status: input.dossier.status,
    fieldCodes: input.dossier.fieldCodes,
    requirements,
    documents: input.documents || [],
    documentWaivers,
  });

  const hasOwner = Boolean(input.dossier.ownerUsername?.trim());
  const codeReview = reviewPcnCodes(input.dossier.fieldCodes, input.proposal?.proposalCode);
  const corePresent = [
    Boolean(input.dossier.proposalId && input.proposal?.id === input.dossier.proposalId),
    hasCustomer(input.dossier, input.proposal),
    Boolean(input.proposal?.productName?.trim()),
    input.dossier.fieldCodes.length > 0,
    Boolean(input.dossier.method),
    hasOwner,
  ];
  const missingCoreLabels = CORE_FIELDS.filter((_, index) => !corePresent[index]).map((item) => item.label);
  const requiredDocumentPresent = required.length - missingRequirementIds.length;
  const stationDocumentPresent = stationChecklist.requiredPresent;
  const documentScore = required.length ? (requiredDocumentPresent / required.length) * 100 : 100;
  const coreScore = (corePresent.filter(Boolean).length / CORE_FIELDS.length) * 100;
  const score = Math.round(documentScore * 0.6 + coreScore * 0.4);
  const missingRequiredByStage = DOCUMENT_STAGE_ORDER
    .map((stage) => ({
      stage,
      label: DOCUMENT_STAGE_LABELS[stage],
      labels: uniqueLabels(missingRequirements.filter((item) => item.stages.includes(stage)).map((item) => item.name)),
    }))
    .filter((group) => group.labels.length > 0);

  return {
    score,
    stationScore: getPcnDossierStationScore(stationChecklist),
    station: getPcnPipelineStation(input.dossier.status),
    requiredDocumentTotal: required.length,
    requiredDocumentPresent,
    stationDocumentTotal: stationChecklist.requiredTotal,
    stationDocumentPresent,
    missingRequirementIds,
    missingLabels: uniqueLabels(missingRequirements.map((item) => item.name)),
    missingRequiredByStage,
    stationMissingLabels: uniqueLabels(stationChecklist.items.filter((item) => item.requirement.required && item.status === 'MISSING').map((item) => item.requirement.name)),
    coreFieldTotal: CORE_FIELDS.length,
    coreFieldPresent: corePresent.filter(Boolean).length,
    missingCoreLabels,
    hasOwner,
    codeReview,
    stationChecklist,
  };
}

export function getPcnDossierOwnerAssignmentDenial(input: Omit<PcnDossierAssignmentInput, 'assignmentLabel'>): string | null {
  return getPcnDossierAssignmentDenial({ ...input, assignmentLabel: 'Chủ hồ sơ' });
}

// --- End of pcnDossierPipeline.ts ---
