import { PGD_COLLECTIONS, PGD_DOMAIN, type PgdProductGroup, type PgdSample, type PgdSampleDisposition, type PgdValidationIssue } from './pgdDomain.ts';
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
  if (['REQUEST_PYC', 'REQUEST_SUPPORTING', 'COMMERCIAL_CONTRACT', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'CUSTOMS_DECLARATION', 'CERTIFICATE_OF_ORIGIN'].includes(code)) {
    return 'INTAKE_CAPABILITY';
  }
  if (code === 'INSPECTION_PLAN' || code.startsWith('TECHNICAL_')) return 'PREPARATION';
  if (code === 'FIELD_INSPECTION_MINUTES' || code === 'FIELD_SAMPLE_TAKING') return 'FIELD_SAMPLING';
  if (code === 'SAMPLE_HANDOVER_LAB' || code === 'LAB_RESULT') return 'LAB_RESULTS';
  return 'REPORT_APPROVAL_RETURN';
}

export function getPgdDossierRequirements(productGroup: PgdProductGroup): PgdDossierRequirement[] {
  const base: PgdDossierRequirement[] = [
    requirement('REQUEST_PYC', 'REQUEST', 'Phiếu yêu cầu giám định'),
    requirement('REQUEST_SUPPORTING', 'REQUEST', 'Tài liệu tiếp nhận và thông tin PYC'),
    requirement('COMMERCIAL_CONTRACT', 'COMMERCIAL_CUSTOMS', 'Hợp đồng', false, 'Bổ sung khi hồ sơ có hợp đồng làm căn cứ giám định.'),
    requirement('COMMERCIAL_INVOICE', 'COMMERCIAL_CUSTOMS', 'Hóa đơn thương mại', false, 'Chỉ áp dụng khi hồ sơ có giao dịch thương mại tương ứng.'),
    requirement('PACKING_LIST', 'COMMERCIAL_CUSTOMS', 'Packing list', false, 'Chỉ áp dụng khi lô hàng có packing list.'),
    requirement('BILL_OF_LADING', 'COMMERCIAL_CUSTOMS', 'Vận đơn', false, 'Chỉ áp dụng khi lô hàng có vận chuyển bằng đường biển/đường bộ tương ứng.'),
    requirement('CUSTOMS_DECLARATION', 'COMMERCIAL_CUSTOMS', 'Tờ khai hải quan', false, 'Chỉ áp dụng khi hồ sơ có thủ tục hải quan.'),
    requirement('CERTIFICATE_OF_ORIGIN', 'COMMERCIAL_CUSTOMS', 'C/O - chứng nhận xuất xứ', false, 'Chỉ áp dụng khi khách hàng cung cấp hoặc phạm vi yêu cầu có xác định xuất xứ.'),
    requirement('INSPECTION_PLAN', 'TECHNICAL', 'Kế hoạch giám định', true),
    requirement('FIELD_INSPECTION_MINUTES', 'FIELD', 'Biên bản giám định hiện trường'),
    requirement('SAMPLE_HANDOVER_LAB', 'LAB_SUBCONTRACTOR', 'Phiếu giao nhận mẫu PTN'),
    requirement('LAB_RESULT', 'RESULT_ISSUANCE', 'Kết quả PTN'),
    requirement('INSPECTION_REPORT', 'RESULT_ISSUANCE', 'Báo cáo kết quả / báo cáo đánh giá giám định'),
    requirement('DECISION', 'RESULT_ISSUANCE', 'Quyết định phê duyệt / phát hành', false, 'Bổ sung khi loại hình hoặc quy trình yêu cầu quyết định riêng.'),
    requirement('INSPECTION_CERTIFICATE', 'RESULT_ISSUANCE', 'Chứng thư giám định'),
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
    ];
  }

  return [
    ...base,
    requirement('TECHNICAL_OVERVIEW', 'TECHNICAL', 'Hồ sơ kỹ thuật / mô tả hàng hóa'),
  ];
}

export function buildPgdDossierDocument(input: Partial<PgdDossierDocument>, now = new Date().toISOString()): PgdDossierDocument {
  if (clean(input.domain) && input.domain !== PGD_DOMAIN) throw new Error('Tài liệu dossier PGD không được nhận domain ngoài PGD.');
  if (clean(input.sourceCollection) && input.sourceCollection !== PGD_COLLECTIONS.dossierDocuments) throw new Error('Tài liệu dossier PGD phải đến từ collection PGD.');
  if (clean(input.sourceDocumentId) && clean(input.sourceDocumentId) !== clean(input.id)) throw new Error('sourceDocumentId của dossier PGD phải trùng id bản ghi.');
  if (hasPgdSourceMetadata(input) && clean(input.sourceCollection) !== PGD_COLLECTIONS.dossierDocuments) throw new Error('Tài liệu dossier PGD phải có provenance collection PGD hợp lệ.');

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
