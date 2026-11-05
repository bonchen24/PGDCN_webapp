import type {
  PcnDossierAttachment,
  PcnCertificationFieldCode,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDossierStationKey,
  PcnGeneratedDocument,
  PcnGeneratedDocumentKind,
  PcnDraftFormKind,
  PcnHistoricalFileKind,
  CertificationDossier,
} from '../types.ts';
import { PCN_CERTIFICATION_FIELD_CODES } from './pcnWorkflow.ts';
import { evaluatePcnWorkflowCondition, type PcnWorkflowConditionContext } from './pcnWorkflowRuntime.ts';

const INTAKE = ['INTAKE'] as const;
const LAB = ['LAB_ROUTING'] as const;
const TECHNICAL = ['TECHNICAL_REVIEW'] as const;
const ISSUANCE = ['ISSUANCE'] as const;
const DELIVERY = ['DELIVERY'] as const;
const ARCHIVE = ['ARCHIVE'] as const;

function requirement(
  fieldCode: PcnCertificationFieldCode,
  code: string,
  name: string,
  stages: readonly PcnDocumentRequirement['stages'][number][],
  sortOrder: number,
  options: { description?: string; required?: boolean; stationKeys?: readonly PcnDossierStationKey[] } = {},
): PcnDocumentRequirement {
  return {
    id: `${fieldCode}-${code}`,
    fieldCode,
    code,
    name,
    ...(options.description ? { description: options.description } : {}),
    stages: [...stages],
    ...(options.stationKeys?.length ? { stationKeys: [...options.stationKeys] } : {}),
    required: options.required ?? true,
    active: true,
    sortOrder,
  };
}

/** Initial business baseline for the active PCN QC4/QC9 field catalog. */
const BASE_PCN_DOCUMENT_REQUIREMENTS: PcnDocumentRequirement[] = [
  requirement('QC4', 'PROPOSAL', 'Đề nghị / đơn đăng ký', [...INTAKE], 10),
  requirement('QC4', 'COMMERCIAL', 'Báo giá / hợp đồng', [...INTAKE], 20),
  requirement('QC4', 'ASSIGNMENT_FORM', 'Phiếu phân công chứng nhận', [...INTAKE], 25),
  requirement('QC4', 'EVALUATION_PLAN', 'Kế hoạch đánh giá CNSP', [...INTAKE], 26),
  requirement('QC4', 'FIELD_INSPECTION', 'Biên bản kiểm tra tại hiện trường', [...INTAKE], 27),
  requirement('QC4', 'LAB_REQUEST', 'PYC gửi phòng thử nghiệm', [...LAB], 30),
  requirement('QC4', 'SAMPLE_CODING', 'Biên bản mã hóa mẫu', [...LAB], 35),
  requirement('QC4', 'SAMPLE_HANDOVER', 'Biên bản lấy / giao mẫu', [...LAB], 40),
  requirement('QC4', 'TEST_REPORT', 'Báo cáo / KQTN', [...TECHNICAL], 50),
  requirement('QC4', 'CERTIFICATION_RESULT', 'Kết quả chứng nhận / phụ lục', [...TECHNICAL], 60),
  requirement('QC4', 'CERTIFICATE', 'Giấy chứng nhận', [...ISSUANCE], 70),
  requirement('QC4', 'DECISION', 'Quyết định', [...ISSUANCE], 80),
  requirement('QC4', 'CLIENT_PACKAGE', 'Hồ sơ gửi khách hàng', [...DELIVERY], 90),
  requirement('QC4', 'ARCHIVE_SCAN', 'Bản scan lưu hồ sơ', [...ARCHIVE], 100),

  requirement('QC9', 'PROPOSAL', 'Đề nghị / đơn đăng ký', [...INTAKE], 10),
  requirement('QC9', 'COMMERCIAL', 'Báo giá / hợp đồng', [...INTAKE], 20),
  requirement('QC9', 'ASSIGNMENT_FORM', 'Phiếu phân công chứng nhận', [...INTAKE], 25),
  requirement('QC9', 'EVALUATION_PLAN', 'Kế hoạch đánh giá CNSP', [...INTAKE], 26),
  requirement('QC9', 'FIELD_INSPECTION', 'Biên bản kiểm tra tại hiện trường', [...INTAKE], 27),
  requirement('QC9', 'LAB_REQUEST', 'PYC gửi phòng thử nghiệm', [...LAB], 30),
  requirement('QC9', 'SAMPLE_CODING', 'Biên bản mã hóa mẫu', [...LAB], 35),
  requirement('QC9', 'SAMPLE_HANDOVER', 'Biên bản giao mẫu', [...LAB], 40),
  requirement('QC9', 'SAMPLE_RETURN', 'Biên bản trả mẫu', [...LAB], 50),
  requirement('QC9', 'TEST_REPORT', 'KQTN', [...TECHNICAL], 60),
  requirement('QC9', 'EXTENSION_LETTER', 'Công văn gia hạn', [...TECHNICAL], 70, { required: false }),
  requirement('QC9', 'CORRECTIVE_ACTION_LETTER', 'Công văn khắc phục', [...TECHNICAL], 80, { required: false }),
  requirement('QC9', 'FAILURE_LETTER', 'Công văn không đạt', [...TECHNICAL], 90, { required: false }),
  requirement('QC9', 'CERTIFICATE', 'Giấy chứng nhận', [...ISSUANCE], 100),
  requirement('QC9', 'DECISION', 'Quyết định', [...ISSUANCE], 110),
  requirement('QC9', 'CLIENT_PACKAGE', 'Hồ sơ gửi khách hàng', [...DELIVERY], 120),
  requirement('QC9', 'ARCHIVE_SCAN', 'Bản scan lưu hồ sơ', [...ARCHIVE], 130),

];

const DEFAULT_PCN_STATION_KEYS: Record<string, PcnDossierStationKey[]> = {
  'QC4-PROPOSAL': ['INTAKE', 'DOCUMENTS'],
  'QC4-COMMERCIAL': ['INTAKE', 'DOCUMENTS'],
  'QC4-ASSIGNMENT_FORM': ['ASSIGNMENT'],
  'QC4-EVALUATION_PLAN': ['EVALUATION'],
  'QC4-FIELD_INSPECTION': ['EVALUATION'],
  'QC4-LAB_REQUEST': ['SAMPLING_LAB'],
  'QC4-SAMPLE_CODING': ['SAMPLING_LAB'],
  'QC4-SAMPLE_HANDOVER': ['SAMPLING_LAB'],
  'QC4-TEST_REPORT': ['RESULTS', 'TECHNICAL_REVIEW'],
  'QC4-CERTIFICATION_RESULT': ['TECHNICAL_REVIEW'],
  'QC4-CERTIFICATE': ['APPROVAL', 'ISSUANCE'],
  'QC4-DECISION': ['APPROVAL', 'ISSUANCE'],
  'QC4-CLIENT_PACKAGE': ['DELIVERY_ARCHIVE'],
  'QC4-ARCHIVE_SCAN': ['DELIVERY_ARCHIVE'],
  'QC9-PROPOSAL': ['INTAKE', 'DOCUMENTS'],
  'QC9-COMMERCIAL': ['INTAKE', 'DOCUMENTS'],
  'QC9-ASSIGNMENT_FORM': ['ASSIGNMENT'],
  'QC9-EVALUATION_PLAN': ['EVALUATION'],
  'QC9-FIELD_INSPECTION': ['EVALUATION'],
  'QC9-LAB_REQUEST': ['SAMPLING_LAB'],
  'QC9-SAMPLE_CODING': ['SAMPLING_LAB'],
  'QC9-SAMPLE_HANDOVER': ['SAMPLING_LAB'],
  'QC9-SAMPLE_RETURN': ['SAMPLING_LAB'],
  'QC9-TEST_REPORT': ['RESULTS', 'TECHNICAL_REVIEW'],
  'QC9-EXTENSION_LETTER': ['CORRECTION'],
  'QC9-CORRECTIVE_ACTION_LETTER': ['CORRECTION'],
  'QC9-FAILURE_LETTER': ['CORRECTION'],
  'QC9-CERTIFICATE': ['APPROVAL', 'ISSUANCE'],
  'QC9-DECISION': ['APPROVAL', 'ISSUANCE'],
  'QC9-CLIENT_PACKAGE': ['DELIVERY_ARCHIVE'],
  'QC9-ARCHIVE_SCAN': ['DELIVERY_ARCHIVE'],
};

/** Baseline requirements carry exact station routing while preserving old stage data. */
export const DEFAULT_PCN_DOCUMENT_REQUIREMENTS: PcnDocumentRequirement[] = BASE_PCN_DOCUMENT_REQUIREMENTS.map((item) => ({
  ...item,
  stationKeys: DEFAULT_PCN_STATION_KEYS[item.id] || item.stationKeys,
}));

/** Backfill the active checklist when the PCN database predates a field pack. */
export function mergePcnDocumentRequirements(configuredRequirements: PcnDocumentRequirement[]): PcnDocumentRequirement[] {
  const baselineById = new Map(DEFAULT_PCN_DOCUMENT_REQUIREMENTS.map((item) => [item.id, item]));
  const mergedById = new Map(baselineById);
  for (const configured of configuredRequirements) {
    const fieldCode = String(configured.fieldCode).trim().toUpperCase();
    if (!PCN_CERTIFICATION_FIELD_CODES.includes(fieldCode as typeof PCN_CERTIFICATION_FIELD_CODES[number])) continue;
    const baseline = baselineById.get(configured.id);
    mergedById.set(configured.id, {
      ...(baseline || {}),
      ...configured,
      fieldCode,
      ...(baseline && !configured.stationKeys?.length ? { stationKeys: baseline.stationKeys } : {}),
    } as PcnDocumentRequirement);
  }
  return [...mergedById.values()]
    .filter((item) => PCN_CERTIFICATION_FIELD_CODES.includes(item.fieldCode as typeof PCN_CERTIFICATION_FIELD_CODES[number]))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

export function getPcnDocumentRequirements(
  fieldCodes: PcnCertificationFieldCode[],
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
): PcnDocumentRequirement[] {
  const selected = new Set(fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean));
  return requirements
    .filter((item) => item.active && selected.has(item.fieldCode.toUpperCase()))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

export function getPcnDossierRequirementsWithCustom(
  dossier: Pick<CertificationDossier, 'fieldCodes' | 'workflowSnapshot'>,
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
  conditionContext: Pick<PcnWorkflowConditionContext, 'resultOutcome'> = {},
): PcnDocumentRequirement[] {
  const fieldCode = dossier.fieldCodes[0];
  if (!fieldCode) return getPcnDocumentRequirements(dossier.fieldCodes, requirements);
  const custom = (dossier.workflowSnapshot?.requirementDefinitions || [])
    .filter((definition) => definition.domain === 'PCN')
    .map((definition, index): PcnDocumentRequirement => {
      const workflowStage = dossier.workflowSnapshot?.stages?.find((stage) => stage.requirementIds?.includes(definition.id));
      const stageId = workflowStage?.id;
      const stageMap: Record<string, { stages: PcnDocumentRequirement['stages']; stationKeys: PcnDocumentRequirement['stationKeys'] }> = {
        'intake-documents': { stages: ['INTAKE'], stationKeys: ['INTAKE', 'DOCUMENTS'] },
        'scope-assignment': { stages: ['INTAKE'], stationKeys: ['ASSIGNMENT', 'EVALUATION'] },
        'onsite-assessment': { stages: ['INTAKE'], stationKeys: ['EVALUATION'] },
        'testing-evidence': { stages: ['LAB_ROUTING', 'TECHNICAL_REVIEW'], stationKeys: ['SAMPLING_LAB', 'RESULTS'] },
        'corrective-action': { stages: ['TECHNICAL_REVIEW'], stationKeys: ['CORRECTION'] },
        'review-approval': { stages: ['TECHNICAL_REVIEW', 'ISSUANCE'], stationKeys: ['TECHNICAL_REVIEW', 'APPROVAL'] },
        'issuance-archive': { stages: ['ISSUANCE', 'DELIVERY', 'ARCHIVE'], stationKeys: ['ISSUANCE', 'DELIVERY_ARCHIVE'] },
      };
      const mapped = stageMap[stageId || 'intake-documents'] || stageMap['intake-documents'];
      return {
        id: definition.id,
        fieldCode,
        code: definition.code,
        name: definition.name,
        ...(definition.description ? { description: definition.description } : {}),
        stages: mapped.stages,
        stationKeys: mapped.stationKeys,
        required: definition.level === 'REQUIRED'
          || (definition.level === 'CONDITIONAL' && Boolean(definition.condition) && evaluatePcnWorkflowCondition(definition.condition, conditionContext)),
        active: true,
        sortOrder: 10000 + index,
        requirementLevel: definition.level,
        requirementSource: definition.source === 'DRAFT_FROM_DOCX_TEMPLATE' ? 'UPLOAD_EXTERNAL' : definition.source,
        ...(definition.condition ? { condition: definition.condition } : {}),
        ownerRole: definition.ownerRole,
        multiplicity: 'SINGLE',
        ...(workflowStage ? { workflowStageId: workflowStage.id, workflowStageLabel: workflowStage.label } : {}),
      };
    });
  const customIds = new Set(custom.map((item) => item.id));
  const standard = getPcnDocumentRequirements(dossier.fieldCodes, requirements).filter((item) => !customIds.has(item.id));
  return [...standard, ...custom];
}

export function buildPcnDossierDocumentId(dossierId: string, requirementId: string): string {
  return `dossier-document-${dossierId}-${requirementId}`.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Legacy PRESENT records remain accepted; custom files require an explicit confirmation. */
export function isPcnDossierDocumentLifecycleAccepted(
  document?: Pick<PcnDossierDocument, 'status' | 'lifecycleStatus'>,
): boolean {
  return document?.status === 'PRESENT'
    && (document.lifecycleStatus === undefined || document.lifecycleStatus === 'CONFIRMED');
}

export function isPcnDossierDocumentCurrentAndConfirmed(
  document?: Pick<PcnDossierDocument, 'status' | 'lifecycleStatus' | 'currentVersionId' | 'versions'>,
): boolean {
  return isPcnDossierDocumentLifecycleAccepted(document)
    && Boolean(document?.currentVersionId)
    && Boolean(document?.versions.some((version) => version.assetId === document.currentVersionId));
}

/** Only generated forms with an unambiguous checklist counterpart may be confirmed. */
export function getPcnGeneratedDocumentRequirementCode(kind: PcnGeneratedDocumentKind): string | undefined {
  const mapping: Partial<Record<PcnGeneratedDocumentKind, string>> = {
    PROPOSAL_FORM: 'PROPOSAL',
    ASSIGNMENT_FORM: 'ASSIGNMENT_FORM',
    EVALUATION_PLAN: 'EVALUATION_PLAN',
    FIELD_INSPECTION: 'FIELD_INSPECTION',
    SAMPLE_TAKING: 'SAMPLE_HANDOVER',
    SAMPLE_CODING: 'SAMPLE_CODING',
    SAMPLE_HANDOVER: 'SAMPLE_HANDOVER',
    SAMPLE_RETURN: 'SAMPLE_RETURN',
    LAB_REQUEST: 'LAB_REQUEST',
  };
  return mapping[kind];
}

/** Draft-workspace forms use the same checklist contract when they are explicitly confirmed. */
export function getPcnDraftFormRequirementCode(kind: PcnDraftFormKind): string | undefined {
  const mapping: Partial<Record<PcnDraftFormKind, string>> = {
    PROPOSAL_FORM: 'PROPOSAL',
    COMMERCIAL: 'COMMERCIAL',
    ASSIGNMENT_FORM: 'ASSIGNMENT_FORM',
    EVALUATION_PLAN: 'EVALUATION_PLAN',
    FIELD_INSPECTION: 'FIELD_INSPECTION',
    SAMPLE_TAKING: 'SAMPLE_HANDOVER',
    SAMPLE_CODING: 'SAMPLE_CODING',
    SAMPLE_HANDOVER: 'SAMPLE_HANDOVER',
    LAB_REQUEST: 'LAB_REQUEST',
    CERTIFICATION_RESULT: 'CERTIFICATION_RESULT',
    CLIENT_PACKAGE: 'CLIENT_PACKAGE',
  };
  return mapping[kind];
}

export function buildPcnGeneratedDossierAttachment(input: {
  dossierId: string;
  requirement: PcnDocumentRequirement;
  generated: PcnGeneratedDocument;
  assetId: string;
}): PcnDossierAttachment {
  return {
    id: `pcn-attachment-generated-${input.assetId}`,
    dossierId: input.dossierId,
    fieldCode: input.requirement.fieldCode,
    kind: 'OTHER',
    requirementId: input.requirement.id,
    mappingStatus: 'MANUAL_MAPPED',
    mappingReason: `Xác nhận bản sinh ${input.generated.kind} (${input.generated.id}) vào ${input.requirement.id}.`,
    fileName: input.generated.fileName.slice(0, 255),
    sourceRelativePath: `PCN_GENERATED/${input.generated.id}/${input.generated.fileName}`,
    assetId: input.assetId,
    mimeType: input.generated.mimeType,
    byteSize: input.generated.byteSize,
    sha256: input.generated.sha256,
    importedAt: input.generated.generatedAt,
    note: 'Tệp checklist được sao chép từ bản sinh quản lý sau khi người dùng xác nhận.',
  };
}

export function buildPcnDossierChecklist(
  dossierId: string,
  fieldCodes: PcnCertificationFieldCode[],
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
  now = new Date().toISOString(),
): PcnDossierDocument[] {
  return getPcnDocumentRequirements(fieldCodes, requirements).map((item) => ({
    id: buildPcnDossierDocumentId(dossierId, item.id),
    dossierId,
    requirementId: item.id,
    fieldCode: item.fieldCode,
    currentVersionId: undefined,
    versions: [],
    status: 'MISSING' as const,
    createdAt: now,
    updatedAt: now,
  }));
}

export function mergePcnDossierChecklist(
  existing: PcnDossierDocument[],
  dossierId: string,
  fieldCodes: PcnCertificationFieldCode[],
  requirements: PcnDocumentRequirement[] = DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
  now = new Date().toISOString(),
): PcnDossierDocument[] {
  const existingByRequirement = new Map(existing.filter((item) => item.dossierId === dossierId).map((item) => [item.requirementId, item]));
  return buildPcnDossierChecklist(dossierId, fieldCodes, requirements, now).map((item) => {
    const previous = existingByRequirement.get(item.requirementId);
    return previous ? { ...item, ...previous, updatedAt: previous.updatedAt || now } : item;
  });
}

export function getPcnDossierDocumentVersionCount(document?: PcnDossierDocument): number {
  return document?.versions?.length || 0;
}

const UPLOADED_ATTACHMENT_KIND_BY_REQUIREMENT_CODE: Record<string, PcnHistoricalFileKind> = {
  PROPOSAL: 'PROPOSAL',
  COMMERCIAL: 'COMMERCIAL',
  SAMPLE_HANDOVER: 'SAMPLE_HANDOVER',
  SAMPLE_RETURN: 'SAMPLE_RETURN',
  TEST_REPORT: 'TEST_REPORT',
  CORRECTIVE_ACTION_LETTER: 'CORRECTIVE_ACTION',
  CERTIFICATE: 'CERTIFICATE',
  DECISION: 'DECISION',
};

export function buildPcnUploadedDossierAttachment(input: {
  dossierId: string;
  requirement: PcnDocumentRequirement;
  assetId: string;
  fileName: string;
  mimeType?: string;
  byteSize?: number;
  sha256?: string;
  uploadedAt: string;
  uploadedBy?: string;
}): PcnDossierAttachment {
  const fileName = input.fileName.trim().slice(0, 255);
  const requirementCode = String(input.requirement.code || '').trim().toUpperCase();
  const kind = UPLOADED_ATTACHMENT_KIND_BY_REQUIREMENT_CODE[requirementCode] || 'OTHER';
  return {
    id: `pcn-attachment-upload-${input.assetId}`,
    dossierId: input.dossierId,
    fieldCode: input.requirement.fieldCode,
    kind,
    requirementId: input.requirement.id,
    mappingStatus: 'MANUAL_MAPPED',
    mappingReason: `Tải trực tiếp vào ${input.requirement.id}.`,
    fileName,
    sourceRelativePath: `PCN_UPLOAD/${fileName}`,
    assetId: input.assetId,
    mimeType: input.mimeType || 'application/octet-stream',
    byteSize: Number(input.byteSize || 0),
    sha256: input.sha256 || '',
    importedAt: input.uploadedAt,
    ...(input.uploadedBy ? { note: `Tệp do ${input.uploadedBy} tải lên từ giao diện PCN.` } : { note: 'Tệp do người dùng tải lên từ giao diện PCN.' }),
  };
}

export function buildPcnSupplementaryDossierAttachment(input: {
  dossierId: string;
  fieldCode: PcnCertificationFieldCode;
  stageId: string;
  stageLabel: string;
  assetId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  uploadedAt: string;
  title?: string;
  description?: string;
  supplementaryItemId?: string;
  supersedesAttachmentId?: string;
}): PcnDossierAttachment {
  const fileName = input.fileName.trim().slice(0, 255);
  const id = `pcn-attachment-supplementary-${input.assetId}`;
  return {
    id,
    dossierId: input.dossierId,
    fieldCode: input.fieldCode,
    kind: 'OTHER',
    supplementaryStageId: input.stageId,
    supplementaryItemId: input.supplementaryItemId || id,
    ...(input.supersedesAttachmentId ? { supersedesAttachmentId: input.supersedesAttachmentId } : {}),
    mappingStatus: 'MANUAL_MAPPED',
    mappingReason: `Tệp phụ trợ của bước ${input.stageLabel}.`,
    fileName,
    ...(input.title ? { title: input.title.trim().slice(0, 255) } : {}),
    ...(input.description ? { description: input.description.trim().slice(0, 2000) } : {}),
    sourceRelativePath: `PCN_SUPPLEMENTARY/${input.stageId}/${fileName}`,
    assetId: input.assetId,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    sha256: input.sha256,
    importedAt: input.uploadedAt,
  };
}

export function buildPcnSupplementaryDossierMetadata(input: {
  id: string;
  dossierId: string;
  fieldCode: PcnCertificationFieldCode;
  stageId: string;
  stageLabel: string;
  title: string;
  description?: string;
  createdAt: string;
}): PcnDossierAttachment {
  return {
    id: input.id,
    dossierId: input.dossierId,
    fieldCode: input.fieldCode,
    kind: 'OTHER',
    supplementaryStageId: input.stageId,
    supplementaryItemId: input.id,
    metadataOnly: true,
    mappingStatus: 'MANUAL_MAPPED',
    mappingReason: `Đầu mục phụ trợ của bước ${input.stageLabel}.`,
    title: input.title.trim().slice(0, 255),
    ...(input.description?.trim() ? { description: input.description.trim().slice(0, 2000) } : {}),
    fileName: '',
    sourceRelativePath: '',
    assetId: '',
    mimeType: '',
    byteSize: 0,
    sha256: '',
    importedAt: input.createdAt,
  };
}

// --- End of pcnDossierDocuments.ts ---
