import type {
  PcnDossierAttachment,
  PcnCertificationFieldCode,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDossierStationKey,
  PcnGeneratedDocument,
  PcnGeneratedDocumentKind,
  PcnHistoricalFileKind,
} from '../types.ts';
import { PCN_CERTIFICATION_FIELD_CODES } from './pcnWorkflow.ts';

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

/** Initial business baseline for the active PCN QC4/QC9/QC20 field catalog. */
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

  // QC20 follows the same dossier lifecycle. Product scope and official
  // source templates remain configurable until PCN approves the field pack.
  requirement('QC20', 'PROPOSAL', 'Đề nghị / đơn đăng ký', [...INTAKE], 10),
  requirement('QC20', 'COMMERCIAL', 'Báo giá / hợp đồng', [...INTAKE], 20),
  requirement('QC20', 'SCOPE_EVIDENCE', 'Hồ sơ phạm vi, mã HS và tiêu chuẩn áp dụng', [...INTAKE], 22),
  requirement('QC20', 'LOT_IDENTITY', 'Bằng chứng mác, kích thước và xác định lô', [...INTAKE], 23),
  requirement('QC20', 'ASSIGNMENT_FORM', 'Phiếu phân công chứng nhận', [...INTAKE], 25),
  requirement('QC20', 'EVALUATION_PLAN', 'Kế hoạch đánh giá CNSP', [...INTAKE], 26),
  requirement('QC20', 'FIELD_INSPECTION', 'Biên bản kiểm tra tại hiện trường', [...INTAKE], 27),
  requirement('QC20', 'LAB_REQUEST', 'PYC gửi phòng thử nghiệm', [...LAB], 30),
  requirement('QC20', 'SAMPLE_CODING', 'Biên bản mã hóa mẫu theo lô', [...LAB], 35),
  requirement('QC20', 'SAMPLE_HANDOVER', 'Biên bản lấy / giao mẫu', [...LAB], 40),
  requirement('QC20', 'SAMPLE_RETURN', 'Biên bản trả mẫu', [...LAB], 50, { required: false }),
  requirement('QC20', 'TEST_REPORT', 'Báo cáo / KQTN', [...TECHNICAL], 60),
  requirement('QC20', 'CERTIFICATION_RESULT', 'Kết quả chứng nhận / phụ lục', [...TECHNICAL], 70),
  requirement('QC20', 'CORRECTIVE_ACTION_LETTER', 'Công văn khắc phục', [...TECHNICAL], 80, { required: false }),
  requirement('QC20', 'CERTIFICATE', 'Giấy chứng nhận', [...ISSUANCE], 90),
  requirement('QC20', 'DECISION', 'Quyết định', [...ISSUANCE], 100),
  requirement('QC20', 'CLIENT_PACKAGE', 'Hồ sơ gửi khách hàng', [...DELIVERY], 110),
  requirement('QC20', 'ARCHIVE_SCAN', 'Bản scan lưu hồ sơ', [...ARCHIVE], 120),
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
  'QC20-PROPOSAL': ['INTAKE', 'DOCUMENTS'],
  'QC20-COMMERCIAL': ['INTAKE', 'DOCUMENTS'],
  'QC20-SCOPE_EVIDENCE': ['INTAKE', 'DOCUMENTS'],
  'QC20-LOT_IDENTITY': ['INTAKE', 'DOCUMENTS'],
  'QC20-ASSIGNMENT_FORM': ['ASSIGNMENT'],
  'QC20-EVALUATION_PLAN': ['EVALUATION'],
  'QC20-FIELD_INSPECTION': ['EVALUATION'],
  'QC20-LAB_REQUEST': ['SAMPLING_LAB'],
  'QC20-SAMPLE_CODING': ['SAMPLING_LAB'],
  'QC20-SAMPLE_HANDOVER': ['SAMPLING_LAB'],
  'QC20-SAMPLE_RETURN': ['SAMPLING_LAB'],
  'QC20-TEST_REPORT': ['RESULTS', 'TECHNICAL_REVIEW'],
  'QC20-CERTIFICATION_RESULT': ['TECHNICAL_REVIEW'],
  'QC20-CORRECTIVE_ACTION_LETTER': ['CORRECTION'],
  'QC20-CERTIFICATE': ['APPROVAL', 'ISSUANCE'],
  'QC20-DECISION': ['APPROVAL', 'ISSUANCE'],
  'QC20-CLIENT_PACKAGE': ['DELIVERY_ARCHIVE'],
  'QC20-ARCHIVE_SCAN': ['DELIVERY_ARCHIVE'],
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

export function buildPcnDossierDocumentId(dossierId: string, requirementId: string): string {
  return `dossier-document-${dossierId}-${requirementId}`.replace(/[^a-zA-Z0-9._-]/g, '_');
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

// --- End of pcnDossierDocuments.ts ---
