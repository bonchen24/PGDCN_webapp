import { PGD_COLLECTIONS, PGD_DOMAIN, type PgdDossierChecklistItem, type PgdProductGroup, type PgdSample, type PgdSampleDisposition, type PgdValidationIssue } from './pgdDomain.ts';
import type { PgdDocumentTemplateKind } from './pgdDocumentTemplates.ts';
import type { PgdOperationalStationKey } from './pgdWorkflow.ts';

export type PgdDossierRequirementGroup =
  | 'REQUEST'
  | 'COMMERCIAL_CUSTOMS'
  | 'TECHNICAL'
  | 'FIELD'
  | 'LAB_SUBCONTRACTOR'
  | 'RESULT_ISSUANCE'
  | 'ARCHIVE';

export interface PgdDossierRequirement {
  domain: typeof PGD_DOMAIN;
  group: PgdDossierRequirementGroup;
  code: string;
  title: string;
  required: boolean;
  description?: string;
}

export function buildPgdDossierChecklist(productGroup: PgdProductGroup, now = new Date().toISOString()): PgdDossierChecklistItem[] {
  return getPgdDossierRequirements(productGroup).map((item) => ({
    domain: PGD_DOMAIN,
    requirementCode: item.code,
    group: item.group,
    title: item.title,
    required: item.required,
    status: 'MISSING' as const,
    updatedAt: now,
  }));
}

export function reconcilePgdDossierChecklist(
  productGroup: PgdProductGroup,
  existing: readonly PgdDossierChecklistItem[] | undefined,
  currentDocuments: readonly Pick<PgdDossierDocument, 'requirementCode' | 'id' | 'version'>[] = [],
  now = new Date().toISOString(),
): PgdDossierChecklistItem[] {
  const existingByCode = new Map((existing || []).map((item) => [item.requirementCode, item]));
  const documentByCode = new Map(currentDocuments.map((document) => [document.requirementCode, document]));
  return buildPgdDossierChecklist(productGroup, now).map((item) => {
    const previous = existingByCode.get(item.requirementCode);
    const document = documentByCode.get(item.requirementCode);
    if (document) {
      return {
        ...item,
        status: 'PRESENT' as const,
        currentDocumentId: document.id,
        currentDocumentVersion: document.version,
        updatedAt: now,
      };
    }
    if (previous?.status === 'WAIVED' && previous.waiverReason?.trim()) {
      return {
        ...item,
        status: 'WAIVED' as const,
        waiverReason: previous.waiverReason.trim(),
        ...(previous.waivedByUsername?.trim() ? { waivedByUsername: previous.waivedByUsername.trim() } : {}),
        ...(previous.waivedAt ? { waivedAt: previous.waivedAt } : {}),
        updatedAt: previous.updatedAt || now,
      };
    }
    return { ...item, updatedAt: previous?.updatedAt || now };
  });
}

export function markPgdDossierChecklistPresent(
  productGroup: PgdProductGroup,
  existing: readonly PgdDossierChecklistItem[] | undefined,
  document: Pick<PgdDossierDocument, 'requirementCode' | 'id' | 'version'>,
  now = new Date().toISOString(),
): PgdDossierChecklistItem[] {
  const existingDocuments = (existing || [])
    .filter((item) => item.status === 'PRESENT' && item.currentDocumentId && item.currentDocumentVersion)
    .map((item) => ({ requirementCode: item.requirementCode, id: item.currentDocumentId!, version: item.currentDocumentVersion! }));
  return reconcilePgdDossierChecklist(productGroup, existing, [...existingDocuments, document], now);
}

export interface PgdDossierDocument {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  requirementCode: string;
  title: string;
  fileName: string;
  sourceCollection: typeof PGD_COLLECTIONS.dossierDocuments;
  sourceDocumentId: string;
  version: number;
  checksum: string;
  uploadedByUsername: string;
  uploadedAt: string;
  documentNumber?: string;
  documentDate?: string;
  note?: string;
  fileAssetId?: string;
  mimeType?: string;
  byteSize?: number;
  supersedesDocumentId?: string;
  originCollection?: typeof PGD_COLLECTIONS.documents;
  originDocumentId?: string;
}

/**
 * Return the current dossier document for each checklist requirement.
 *
 * Bootstrap and the dossier endpoint deliberately retain every immutable
 * version so the audit trail remains available. Mutating surfaces, however,
 * must project one deterministic current row per requirement before counting
 * or attaching generated output.
 */
export function getCurrentPgdDossierDocuments(documents: readonly PgdDossierDocument[]): PgdDossierDocument[] {
  const currentByRequirement = new Map<string, PgdDossierDocument>();
  const ordered = [...documents].sort((left, right) => (
    left.requirementCode.localeCompare(right.requirementCode)
    || right.version - left.version
    || right.uploadedAt.localeCompare(left.uploadedAt)
    || right.id.localeCompare(left.id)
  ));
  for (const document of ordered) {
    if (!currentByRequirement.has(document.requirementCode)) currentByRequirement.set(document.requirementCode, clone(document));
  }
  return Array.from(currentByRequirement.values());
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeUsername(value: unknown): string {
  return clean(value).replace(/\s+/g, ' ');
}

function normalizeTitle(value: unknown): string {
  return clean(value).replace(/\s+/g, ' ');
}

function normalizeFileName(value: unknown): string {
  const normalized = clean(value).replace(/[\\/]+/g, '/').split('/').pop() || '';
  return normalized.trim();
}

function hasPgdSourceMetadata(input: Partial<PgdDossierDocument>): boolean {
  return clean(input.sourceCollection) !== ''
    || clean(input.sourceDocumentId) !== ''
    || clean((input as Record<string, unknown>).domain) !== '';
}

function requirement(code: string, group: PgdDossierRequirementGroup, title: string, required = true, description?: string): PgdDossierRequirement {
  return { domain: PGD_DOMAIN, code, group, title, required, ...(description ? { description } : {}) };
}

export function getPgdDossierRequirementStationKey(requirementCode: string): PgdOperationalStationKey {
  const code = clean(requirementCode).toUpperCase();
  if (['REQUEST_PYC', 'REQUEST_SUPPORTING', 'ASSIGNMENT_FORM', 'COMMERCIAL_CONTRACT', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'CUSTOMS_DECLARATION', 'CERTIFICATE_OF_ORIGIN'].includes(code)) {
    return 'INTAKE_CAPABILITY';
  }
  if (code === 'INSPECTION_PLAN' || code.startsWith('TECHNICAL_') || ['MACHINERY_TECHNICAL_DOSSIER', 'COAL_TECHNICAL_OVERVIEW', 'COAL_QUALITY_SPECIFICATION'].includes(code)) return 'PREPARATION';
  if (['FIELD_INSPECTION_MINUTES', 'FIELD_SAMPLE_TAKING', 'FIELD_ACTIVITY_LOG', 'MACHINERY_CONDITION_ASSESSMENT', 'MACHINERY_SYNCHRONIZATION_ASSESSMENT'].includes(code)) return 'FIELD_SAMPLING';
  if (['SAMPLE_HANDOVER_LAB', 'LAB_RESULT', 'LAB_RESULT_REVIEW'].includes(code)) return 'LAB_RESULTS';
  return 'REPORT_APPROVAL_RETURN';
}

export function getPgdDossierRequirements(productGroup: PgdProductGroup): PgdDossierRequirement[] {
  const base: PgdDossierRequirement[] = [
    requirement('REQUEST_PYC', 'REQUEST', 'Phiếu yêu cầu giám định'),
    requirement('REQUEST_SUPPORTING', 'REQUEST', 'Tài liệu tiếp nhận và thông tin PYC'),
    requirement('ASSIGNMENT_FORM', 'REQUEST', 'Phiếu phân công hồ sơ', false, 'Snapshot phân công nhân sự và người soát xét kỹ thuật.'),
    requirement('COMMERCIAL_CONTRACT', 'COMMERCIAL_CUSTOMS', 'Hợp đồng', false, 'Bổ sung khi hồ sơ có hợp đồng làm căn cứ giám định.'),
    requirement('COMMERCIAL_INVOICE', 'COMMERCIAL_CUSTOMS', 'Hóa đơn thương mại', false, 'Chỉ áp dụng khi hồ sơ có giao dịch thương mại tương ứng.'),
    requirement('PACKING_LIST', 'COMMERCIAL_CUSTOMS', 'Packing list', false, 'Chỉ áp dụng khi lô hàng có packing list.'),
    requirement('BILL_OF_LADING', 'COMMERCIAL_CUSTOMS', 'Vận đơn', false, 'Chỉ áp dụng khi lô hàng có vận chuyển bằng đường biển/đường bộ tương ứng.'),
    requirement('CUSTOMS_DECLARATION', 'COMMERCIAL_CUSTOMS', 'Tờ khai hải quan', false, 'Chỉ áp dụng khi hồ sơ có thủ tục hải quan.'),
    requirement('CERTIFICATE_OF_ORIGIN', 'COMMERCIAL_CUSTOMS', 'C/O - chứng nhận xuất xứ', false, 'Chỉ áp dụng khi khách hàng cung cấp hoặc phạm vi yêu cầu có xác định xuất xứ.'),
    requirement('INSPECTION_PLAN', 'TECHNICAL', 'Kế hoạch giám định', true),
    requirement('FIELD_INSPECTION_MINUTES', 'FIELD', 'Biên bản giám định hiện trường'),
    requirement('FIELD_ACTIVITY_LOG', 'FIELD', 'Nhật ký hoạt động hiện trường', false, 'Dùng để ghi nhận các lần làm việc, điều chỉnh hoặc phát sinh tại hiện trường.'),
    requirement('SAMPLE_HANDOVER_LAB', 'LAB_SUBCONTRACTOR', 'Phiếu giao nhận mẫu PTN'),
    requirement('LAB_RESULT', 'RESULT_ISSUANCE', 'Kết quả PTN'),
    requirement('LAB_RESULT_REVIEW', 'RESULT_ISSUANCE', 'Phiếu xem xét kết quả PTN', false, 'Snapshot xem xét tính đầy đủ và phù hợp của kết quả PTN.'),
    requirement('INSPECTION_REPORT', 'RESULT_ISSUANCE', 'Báo cáo kết quả / báo cáo đánh giá giám định'),
    requirement('DECISION', 'RESULT_ISSUANCE', 'Quyết định phê duyệt / phát hành', false, 'Bổ sung khi loại hình hoặc quy trình yêu cầu quyết định riêng.'),
    requirement('INSPECTION_CERTIFICATE', 'RESULT_ISSUANCE', 'Chứng thư giám định'),
    requirement('DOSSIER_COVER', 'ARCHIVE', 'Bìa / mục lục bộ hồ sơ', false, 'Tài liệu tổng hợp được sinh khi đóng gói hồ sơ.'),
    requirement('ARCHIVE_INDEX', 'ARCHIVE', 'Hồ sơ lưu trữ'),
  ];

  if (productGroup === 'STEEL_METAL') {
    return [
      ...base,
      requirement('TECHNICAL_SPECIFICATION', 'TECHNICAL', 'Hồ sơ kỹ thuật / catalogue'),
      requirement('FIELD_SAMPLE_TAKING', 'FIELD', 'Biên bản lấy mẫu'),
    ];
  }

  if (productGroup === 'MACHINERY_LINE') {
    return [
      ...base,
      requirement('MACHINERY_TECHNICAL_DOSSIER', 'TECHNICAL', 'Hồ sơ kỹ thuật máy móc / dây chuyền'),
      requirement('MACHINERY_CONDITION_ASSESSMENT', 'FIELD', 'Biên bản đánh giá tình trạng máy', true),
      requirement('MACHINERY_SYNCHRONIZATION_ASSESSMENT', 'FIELD', 'Biên bản đánh giá tính đồng bộ dây chuyền', false, 'Bổ sung khi áp dụng QT-GĐ-12 hoặc phạm vi có đánh giá đồng bộ.'),
    ];
  }

  if (productGroup === 'COAL') {
    return [
      ...base,
      requirement('COAL_TECHNICAL_OVERVIEW', 'TECHNICAL', 'Hồ sơ kỹ thuật / mô tả lô than'),
      requirement('COAL_QUALITY_SPECIFICATION', 'TECHNICAL', 'Tiêu chuẩn và chỉ tiêu chất lượng than', true),
    ];
  }

  return [
    ...base,
    requirement('TECHNICAL_OVERVIEW', 'TECHNICAL', 'Hồ sơ kỹ thuật / mô tả hàng hóa'),
  ];
}

const PGD_TEMPLATE_REQUIREMENT_CODES: Partial<Record<PgdDocumentTemplateKind, string>> = {
  INTAKE_REQUEST: 'REQUEST_PYC',
  ASSIGNMENT: 'ASSIGNMENT_FORM',
  INSPECTION_PLAN: 'INSPECTION_PLAN',
  FIELD_INSPECTION: 'FIELD_INSPECTION_MINUTES',
  SAMPLE_TAKING: 'FIELD_SAMPLE_TAKING',
  LAB_REQUEST: 'SAMPLE_HANDOVER_LAB',
  INSPECTION_REPORT: 'INSPECTION_REPORT',
  DECISION: 'DECISION',
  INSPECTION_CERTIFICATE: 'INSPECTION_CERTIFICATE',
  DOSSIER_COVER: 'DOSSIER_COVER',
  CASE_TIMELINE: 'REQUEST_SUPPORTING',
  FIELD_ACTIVITY_LOG: 'FIELD_ACTIVITY_LOG',
  LAB_RESULT_REVIEW: 'LAB_RESULT_REVIEW',
  INSPECTION_MINUTES: 'FIELD_INSPECTION_MINUTES',
  SAMPLE_HANDOVER: 'SAMPLE_HANDOVER_LAB',
};

export function getPgdDossierRequirementForTemplate(kind: PgdDocumentTemplateKind, productGroup: PgdProductGroup = 'OTHER'): PgdDossierRequirement | undefined {
  const code = PGD_TEMPLATE_REQUIREMENT_CODES[kind];
  if (!code) return undefined;
  return getPgdDossierRequirements(productGroup).find((item) => item.code === code);
}

export function buildPgdDossierDocument(input: Partial<PgdDossierDocument>, now = new Date().toISOString()): PgdDossierDocument {
  if (clean(input.domain) && input.domain !== PGD_DOMAIN) throw new Error('Tài liệu dossier PGD không được nhận domain ngoài PGD.');
  if (clean(input.sourceCollection) && input.sourceCollection !== PGD_COLLECTIONS.dossierDocuments) throw new Error('Tài liệu dossier PGD phải đến từ collection PGD.');
  if (clean(input.sourceDocumentId) && clean(input.sourceDocumentId) !== clean(input.id)) throw new Error('sourceDocumentId của dossier PGD phải trùng id bản ghi.');
  if (hasPgdSourceMetadata(input) && clean(input.sourceCollection) !== PGD_COLLECTIONS.dossierDocuments) throw new Error('Tài liệu dossier PGD phải có provenance collection PGD hợp lệ.');
  const originCollection = clean((input as PgdDossierDocument).originCollection);
  const originDocumentId = clean((input as PgdDossierDocument).originDocumentId);
  if (originCollection && originCollection !== PGD_COLLECTIONS.documents) throw new Error('Nguồn gốc biểu mẫu PGD chỉ được trỏ tới collection tài liệu PGD.');
  if (Boolean(originCollection) !== Boolean(originDocumentId)) throw new Error('Tài liệu dossier PGD cần đủ origin collection và origin document.');

  const version = Number(input.version);
  if (!Number.isInteger(version) || version < 1) throw new Error('Phiên bản dossier PGD phải là số nguyên dương.');
  const checksum = clean(input.checksum);
  if (!/^[a-f0-9]{64}$/i.test(checksum)) throw new Error('Checksum dossier PGD phải là SHA-256 64 ký tự hex.');

  const id = clean(input.id);
  const requestId = clean(input.requestId);
  const requirementCode = clean(input.requirementCode);
  const title = normalizeTitle(input.title);
  const fileName = normalizeFileName(input.fileName);
  const uploadedByUsername = normalizeUsername(input.uploadedByUsername);
  if (!id || !requestId || !requirementCode) throw new Error('Tài liệu dossier PGD cần id, requestId và requirementCode.');
  if (!title) throw new Error('Tài liệu dossier PGD cần tiêu đề hợp lệ.');
  if (!fileName) throw new Error('Tài liệu dossier PGD cần tên file hợp lệ.');
  if (!uploadedByUsername) throw new Error('Tài liệu dossier PGD cần username người tải lên.');

  return {
    id,
    domain: PGD_DOMAIN,
    requestId,
    requirementCode,
    title,
    fileName,
    sourceCollection: PGD_COLLECTIONS.dossierDocuments,
    sourceDocumentId: id,
    version,
    checksum,
    uploadedByUsername,
    uploadedAt: now,
    ...(clean((input as PgdDossierDocument).documentNumber) ? { documentNumber: clean((input as PgdDossierDocument).documentNumber) } : {}),
    ...(clean((input as PgdDossierDocument).documentDate) ? { documentDate: clean((input as PgdDossierDocument).documentDate) } : {}),
    ...(clean((input as PgdDossierDocument).note) ? { note: clean((input as PgdDossierDocument).note) } : {}),
    ...(clean((input as PgdDossierDocument).fileAssetId) ? { fileAssetId: clean((input as PgdDossierDocument).fileAssetId) } : {}),
    ...(clean((input as PgdDossierDocument).mimeType) ? { mimeType: clean((input as PgdDossierDocument).mimeType) } : {}),
    ...(Number.isFinite((input as PgdDossierDocument).byteSize) ? { byteSize: (input as PgdDossierDocument).byteSize } : {}),
    ...(clean((input as PgdDossierDocument).supersedesDocumentId) ? { supersedesDocumentId: clean((input as PgdDossierDocument).supersedesDocumentId) } : {}),
    ...(originCollection ? { originCollection: PGD_COLLECTIONS.documents, originDocumentId } : {}),
  };
}

export function validatePgdSample(sample: Partial<PgdSample>): PgdValidationIssue[] {
  const issues: PgdValidationIssue[] = [];
  if (sample.domain !== PGD_DOMAIN) issues.push({ field: 'domain', message: 'Mẫu PGD phải thuộc miền pgd.' });
  if (!clean(sample.requestId)) issues.push({ field: 'requestId', message: 'Mẫu PGD cần liên kết requestId.' });
  if (!clean(sample.id)) issues.push({ field: 'id', message: 'Mẫu PGD cần mã định danh.' });
  if (!clean(sample.sampleCode)) issues.push({ field: 'sampleCode', message: 'Mẫu PGD cần mã mẫu.' });
  if (!clean(sample.description)) issues.push({ field: 'description', message: 'Mẫu PGD cần mô tả.' });
  if (!Number.isFinite(sample.quantity) || Number(sample.quantity) <= 0) issues.push({ field: 'quantity', message: 'Số lượng mẫu phải lớn hơn 0.' });
  if (!['LAB', 'RETAINED'].includes(String(sample.disposition || ''))) issues.push({ field: 'disposition', message: 'Phân loại mẫu không hợp lệ.' });
  if (!clean(sample.sealNumber)) issues.push({ field: 'sealNumber', message: 'Mẫu PGD cần số niêm phong.' });
  return issues;
}

export function buildPgdSampleRegister(samples: readonly PgdSample[]): {
  items: PgdSample[];
  lab: PgdSample[];
  retained: PgdSample[];
  counts: { lab: number; retained: number; destroyed: number };
} {
  const items = samples.map((sample) => clone(sample));
  const lab = items.filter((sample) => sample.disposition === 'LAB');
  const retained = items.filter((sample) => sample.disposition === 'RETAINED');
  const destroyed = items.filter((sample) => sample.retentionStatus === 'DESTROYED').length;
  return {
    items,
    lab,
    retained,
    counts: {
      lab: lab.length,
      retained: retained.length,
      destroyed,
    },
  };
}

export function markPgdSampleDestroyed(sample: PgdSample, actorUsername: string, note: string, now = new Date().toISOString()): PgdSample {
  if (sample.disposition !== 'RETAINED') throw new Error('Chỉ mẫu lưu mới được hủy mẫu.');
  if (clean(sample.retentionStatus) === 'DESTROYED' || clean(sample.destroyedAt) || clean(sample.destroyedByUsername)) throw new Error('Mẫu này đã hủy rồi.');
  const actor = normalizeUsername(actorUsername);
  const destructionNote = clean(note);
  if (!actor) throw new Error('Cần ghi nhận người hủy mẫu.');
  if (!destructionNote) throw new Error('Cần ghi nhận lý do hủy mẫu.');
  if (!clean(sample.retainedUntil)) throw new Error('Mẫu lưu cần có hạn lưu trước khi hủy.');
  const retainedUntil = new Date(sample.retainedUntil as string);
  const current = new Date(now);
  if (Number.isNaN(retainedUntil.getTime()) || Number.isNaN(current.getTime()) || current < retainedUntil) {
    throw new Error('Chỉ được hủy khi đã đến hoặc quá hạn lưu.');
  }
  return {
    ...clone(sample),
    retentionStatus: 'DESTROYED',
    destroyedAt: current.toISOString(),
    destroyedByUsername: actor,
    destructionNote,
  };
}
