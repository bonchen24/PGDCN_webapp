import type {
  PcnQualityDocument,
  PcnQualityDocumentCategory,
  PcnQualityDocumentStatus,
} from '../types.ts';

export type PcnQualityDocumentWarning = 'EXPIRED_ADVISORY' | 'EXPIRING_SOON_ADVISORY' | 'RETIRED_ADVISORY';

const CATEGORIES = new Set<PcnQualityDocumentCategory>(['VICAS', 'VIAS', 'ISO', 'DESIGNATION', 'PROCEDURE']);
const STATUSES = new Set<PcnQualityDocumentStatus>(['DRAFT', 'ACTIVE', 'EXPIRED', 'RETIRED']);

export interface PcnQualityDocumentInput {
  id: string;
  documentCode: string;
  title: string;
  category: PcnQualityDocumentCategory;
  fieldCodes?: string[];
  version: string;
  status?: PcnQualityDocumentStatus;
  issuedAt?: string;
  effectiveFrom?: string;
  validUntil?: string;
  ownerUsername?: string;
  fileAssetId?: string;
  fileName?: string;
  note?: string;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function optional(value: unknown): string | undefined {
  const cleaned = clean(value);
  return cleaned || undefined;
}

function normalizeDate(value: unknown, label: string): string | undefined {
  const cleaned = optional(value);
  if (!cleaned) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || Number.isNaN(new Date(`${cleaned}T00:00:00.000Z`).getTime())) {
    throw new Error(`${label} phải có định dạng YYYY-MM-DD.`);
  }
  return cleaned;
}

export function buildPcnQualityDocument(input: PcnQualityDocumentInput, now = new Date().toISOString()): PcnQualityDocument {
  const id = clean(input.id);
  const documentCode = clean(input.documentCode);
  const title = clean(input.title);
  const version = clean(input.version);
  const category = input.category;
  if (!id || !documentCode || !title || !version) throw new Error('Mã, tên và phiên bản tài liệu chất lượng là bắt buộc.');
  if (!CATEGORIES.has(category)) throw new Error('Nhóm tài liệu chất lượng không hợp lệ.');
  const status = input.status || 'DRAFT';
  if (!STATUSES.has(status)) throw new Error('Trạng thái tài liệu chất lượng không hợp lệ.');
  const fieldCodes = [...new Set((input.fieldCodes || []).map((code) => clean(code).toUpperCase()).filter(Boolean))];
  if (fieldCodes.some((code) => !['QC4', 'QC9'].includes(code))) throw new Error('Lĩnh vực tài liệu chất lượng chỉ nhận QC4 hoặc QC9.');
  const issuedAt = normalizeDate(input.issuedAt, 'Ngày ban hành');
  const effectiveFrom = normalizeDate(input.effectiveFrom, 'Ngày hiệu lực');
  const validUntil = normalizeDate(input.validUntil, 'Ngày hết hạn');
  if (effectiveFrom && validUntil && validUntil < effectiveFrom) throw new Error('Ngày hết hạn không được trước ngày hiệu lực.');
  const createdAt = clean(now) || new Date().toISOString();
  return {
    id,
    documentCode,
    title,
    category,
    ...(fieldCodes.length > 0 ? { fieldCodes: fieldCodes as Array<'QC4' | 'QC9'> } : {}),
    version,
    status,
    ...(issuedAt ? { issuedAt } : {}),
    ...(effectiveFrom ? { effectiveFrom } : {}),
    ...(validUntil ? { validUntil } : {}),
    ...(optional(input.ownerUsername) ? { ownerUsername: clean(input.ownerUsername).toLowerCase() } : {}),
    ...(optional(input.fileAssetId) ? { fileAssetId: clean(input.fileAssetId) } : {}),
    ...(optional(input.fileName) ? { fileName: clean(input.fileName) } : {}),
    ...(optional(input.note) ? { note: clean(input.note) } : {}),
    createdAt,
    updatedAt: createdAt,
  };
}

export function getPcnQualityDocumentWarning(document: PcnQualityDocument, now = new Date().toISOString()): PcnQualityDocumentWarning | null {
  if (document.status === 'RETIRED') return 'RETIRED_ADVISORY';
  if (!document.validUntil) return null;
  const expiry = new Date(`${document.validUntil}T23:59:59.999Z`).getTime();
  const current = new Date(now).getTime();
  if (Number.isNaN(expiry) || Number.isNaN(current)) return null;
  if (expiry < current) return 'EXPIRED_ADVISORY';
  if (expiry - current <= 30 * 24 * 60 * 60 * 1000) return 'EXPIRING_SOON_ADVISORY';
  return null;
}

export function getPcnQualityDocumentCategoryLabel(category: PcnQualityDocumentCategory): string {
  switch (category) {
    case 'VICAS': return 'VICAS / đánh giá công nhận';
    case 'VIAS': return 'VIAS / công nhận';
    case 'ISO': return 'ISO / hệ thống chất lượng';
    case 'DESIGNATION': return 'Hồ sơ xin chỉ định';
    case 'PROCEDURE': return 'Quy trình / hướng dẫn';
  }
}

// --- End of pcnQualityDocuments.ts ---
