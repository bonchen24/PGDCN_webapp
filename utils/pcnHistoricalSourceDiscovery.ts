import type { PcnCertificationFieldCode } from '../types.ts';
import { parsePcnHistoricalFolderName } from './pcnHistoricalImport.ts';

export interface PcnHistoricalSourceFileSummary {
  relativePath: string;
  fileName: string;
  extension: string;
  byteSize: number;
  lastModifiedAt?: string;
}

export interface PcnHistoricalSourceCandidate {
  fieldCode: PcnCertificationFieldCode;
  sourceRelativePath: string;
  folderName: string;
  businessCode: string;
  customerName: string;
  productName: string;
  variantHint?: string;
  unresolvedFields: string[];
  fileCount: number;
  totalBytes: number;
  byExtension: Record<string, number>;
  lastModifiedAt?: string;
  sampleFileNames: string[];
}

export type PcnHistoricalSourceAreaRole =
  | 'TEMPLATE'
  | 'CERTIFICATE_ARCHIVE'
  | 'LAB_RESULT'
  | 'SAMPLE_HANDOVER'
  | 'DOCUMENT_HANDOVER'
  | 'LAB_REQUEST'
  | 'COMMERCIAL'
  | 'MIXED_REFERENCE'
  | 'CORRECTIVE_ACTION'
  | 'EVALUATION_RECORD'
  | 'CORRESPONDENCE'
  | 'ACCREDITATION'
  | 'VISUAL_EVIDENCE'
  | 'STANDARD_REFERENCE'
  | 'ADMIN_NOTE'
  | 'ARCHIVE';

export interface PcnHistoricalReferenceRootDefinition {
  fieldCode: 'QC4' | 'QC9';
  sourceRelativePath: string;
  role: PcnHistoricalSourceAreaRole;
}

export interface PcnHistoricalSourceCoverage {
  fieldCode: 'QC4' | 'QC9';
  sourceRelativePath: string;
  role: PcnHistoricalSourceAreaRole;
  status: 'SCANNED' | 'MISSING';
  fileCount: number;
  totalBytes: number;
  byExtension: Record<string, number>;
  lastModifiedAt?: string;
  sampleFileNames: string[];
}

export interface PcnHistoricalDiscoveryResult {
  sourceRoot: string;
  inspectedAt?: string;
  inspectedRoots: Array<{ fieldCode: 'QC4' | 'QC9'; sourceRelativePath: string; status: 'SCANNED' | 'MISSING' }>;
  referenceSources: PcnHistoricalSourceCoverage[];
  ignoredFolders: Array<{ fieldCode: 'QC4' | 'QC9'; sourceRelativePath: string; folderName: string; reason: 'NAME_NOT_RECOGNIZED' }>;
  candidates: PcnHistoricalSourceCandidate[];
}

export const DEFAULT_PCN_HISTORICAL_SCAN_ROOTS: ReadonlyArray<{
  fieldCode: 'QC4' | 'QC9';
  sourceRelativePath: string;
}> = [
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Kết quả QCVN4 2026' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26' },
];

/**
 * Reference-only branches observed in the PCN Desktop pack. These branches
 * are summarized for coverage and routing visibility; they are never
 * candidate roots and are never imported implicitly.
 */
export const DEFAULT_PCN_HISTORICAL_REFERENCE_ROOTS: ReadonlyArray<PcnHistoricalReferenceRootDefinition> = [
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Bản SCAN GCN 2026', role: 'CERTIFICATE_ARCHIVE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Báo cáo', role: 'LAB_RESULT' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Biên bản lấy mẫu', role: 'SAMPLE_HANDOVER' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Phiếu yếu cầu thử nghiệm', role: 'LAB_REQUEST' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Hồ sơ lưu trữ 2026', role: 'ARCHIVE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Xuất Hóa đơn', role: 'COMMERCIAL' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Mẫu HS Đăng ký', role: 'TEMPLATE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Biểu mẫu biên bản thực hiện', role: 'TEMPLATE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Tool QC4', role: 'TEMPLATE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Ảnh Dây điện', role: 'VISUAL_EVIDENCE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Bản Lưu GCN QC4', role: 'CERTIFICATE_ARCHIVE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Báo giá-hợp đồng', role: 'COMMERCIAL' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/BB Danh gia', role: 'EVALUATION_RECORD' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Công văn', role: 'CORRESPONDENCE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/giấy phép chỉ định', role: 'ACCREDITATION' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Note văn thư', role: 'ADMIN_NOTE' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Thí nghiệm QC4', role: 'LAB_RESULT' },
  { fieldCode: 'QC4', sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/TIÊU CHUẨN QC 4', role: 'STANDARD_REFERENCE' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/BIÊN BẢN GIAO GIẤY TỜ', role: 'DOCUMENT_HANDOVER' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/Biên bản lấy mẫu', role: 'SAMPLE_HANDOVER' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/Biên bản, giấy tờ, báo giá, công văn', role: 'MIXED_REFERENCE' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/Biểu mẫu', role: 'TEMPLATE' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/Biểu mẫu công văn', role: 'TEMPLATE' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu', role: 'TEMPLATE' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/Hồ sơ lưu 2026', role: 'ARCHIVE' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/Hợp đồng', role: 'COMMERCIAL' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/kết quả TĐC', role: 'LAB_RESULT' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/khắc phục mẫu', role: 'CORRECTIVE_ACTION' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/mẫu pyc bên TĐC', role: 'TEMPLATE' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/tụ khắc phục', role: 'CORRECTIVE_ACTION' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/File mẫu hồ sơ chứng nhận', role: 'TEMPLATE' },
  { fieldCode: 'QC9', sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/Mẫu công văn', role: 'CORRESPONDENCE' },
];

function normalizeRelativePath(value: string): string {
  const normalized = String(value || '').trim().replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error('Đường dẫn nguồn lịch sử phải là đường dẫn tương đối an toàn.');
  }
  return normalized;
}

function normalizeExtension(value: string, fileName: string): string {
  const extension = String(value || '').trim().toLowerCase();
  if (extension) return extension.startsWith('.') ? extension : `.${extension}`;
  const inferred = fileName.match(/\.[^.]+$/)?.[0] || '';
  return inferred.toLowerCase();
}

function validTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function laterTimestamp(left?: string, right?: string): string | undefined {
  const leftDate = left ? new Date(left).getTime() : Number.NaN;
  const rightDate = right ? new Date(right).getTime() : Number.NaN;
  if (Number.isNaN(leftDate)) return right;
  if (Number.isNaN(rightDate)) return left;
  return leftDate >= rightDate ? left : right;
}

function compareStable(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildPcnHistoricalSourceCandidate(input: {
  fieldCode: PcnCertificationFieldCode;
  sourceRelativePath: string;
  folderName: string;
  files: PcnHistoricalSourceFileSummary[];
}): PcnHistoricalSourceCandidate {
  const fieldCode = String(input.fieldCode || '').trim().toUpperCase();
  if (!['QC4', 'QC9'].includes(fieldCode)) throw new Error('Kiểm kê nguồn lịch sử chỉ hỗ trợ QC4 hoặc QC9.');
  const sourceRelativePath = normalizeRelativePath(input.sourceRelativePath);
  const folderName = String(input.folderName || '').trim();
  const parsed = parsePcnHistoricalFolderName(fieldCode as 'QC4' | 'QC9', folderName);
  const files = [...input.files]
    .map((file) => ({
      ...file,
      relativePath: normalizeRelativePath(file.relativePath),
      fileName: String(file.fileName || '').trim() || file.relativePath.split('/').pop() || 'file',
      extension: normalizeExtension(file.extension, file.fileName),
      byteSize: Number.isFinite(file.byteSize) && file.byteSize >= 0 ? Math.floor(file.byteSize) : 0,
      lastModifiedAt: validTimestamp(file.lastModifiedAt),
    }))
    .sort((left, right) => compareStable(left.relativePath, right.relativePath) || compareStable(left.fileName, right.fileName));
  const byExtension: Record<string, number> = {};
  for (const file of files) {
    if (file.extension) byExtension[file.extension] = (byExtension[file.extension] || 0) + 1;
  }
  const sampleFileNames = files.map((file) => file.fileName).filter(Boolean).slice(0, 8);
  const lastModifiedAt = files.reduce<string | undefined>((latest, file) => laterTimestamp(latest, file.lastModifiedAt), undefined);
  return {
    fieldCode,
    sourceRelativePath,
    folderName,
    businessCode: parsed.businessCode,
    customerName: parsed.customerName,
    productName: parsed.productName,
    ...(parsed.variantHint ? { variantHint: parsed.variantHint } : {}),
    unresolvedFields: [...parsed.unresolvedFields],
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.byteSize, 0),
    byExtension: Object.fromEntries(Object.entries(byExtension).sort(([left], [right]) => compareStable(left, right))),
    ...(lastModifiedAt ? { lastModifiedAt } : {}),
    sampleFileNames,
  };
}

export function buildPcnHistoricalSourceCoverage(input: {
  fieldCode: 'QC4' | 'QC9';
  sourceRelativePath: string;
  role: PcnHistoricalSourceAreaRole;
  status: 'SCANNED' | 'MISSING';
  files: PcnHistoricalSourceFileSummary[];
}): PcnHistoricalSourceCoverage {
  const fieldCode = String(input.fieldCode || '').trim().toUpperCase();
  if (!['QC4', 'QC9'].includes(fieldCode)) throw new Error('Coverage nguồn lịch sử chỉ hỗ trợ QC4 hoặc QC9.');
  const sourceRelativePath = normalizeRelativePath(input.sourceRelativePath);
  const files = [...input.files]
    .map((file) => ({
      ...file,
      relativePath: normalizeRelativePath(file.relativePath),
      fileName: String(file.fileName || '').trim() || file.relativePath.split('/').pop() || 'file',
      extension: normalizeExtension(file.extension, file.fileName),
      byteSize: Number.isFinite(file.byteSize) && file.byteSize >= 0 ? Math.floor(file.byteSize) : 0,
      lastModifiedAt: validTimestamp(file.lastModifiedAt),
    }))
    .sort((left, right) => compareStable(left.relativePath, right.relativePath) || compareStable(left.fileName, right.fileName));
  const byExtension: Record<string, number> = {};
  for (const file of files) {
    if (file.extension) byExtension[file.extension] = (byExtension[file.extension] || 0) + 1;
  }
  const lastModifiedAt = files.reduce<string | undefined>((latest, file) => laterTimestamp(latest, file.lastModifiedAt), undefined);
  return {
    fieldCode: fieldCode as 'QC4' | 'QC9',
    sourceRelativePath,
    role: input.role,
    status: input.status,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.byteSize, 0),
    byExtension: Object.fromEntries(Object.entries(byExtension).sort(([left], [right]) => compareStable(left, right))),
    ...(lastModifiedAt ? { lastModifiedAt } : {}),
    sampleFileNames: files.map((file) => file.fileName).filter(Boolean).slice(0, 8),
  };
}

export function sortPcnHistoricalSourceCandidates(candidates: PcnHistoricalSourceCandidate[]): PcnHistoricalSourceCandidate[] {
  return [...candidates].sort((left, right) => left.fieldCode.localeCompare(right.fieldCode)
    || left.businessCode.localeCompare(right.businessCode, undefined, { numeric: true })
    || left.sourceRelativePath.localeCompare(right.sourceRelativePath));
}

// --- End of pcnHistoricalSourceDiscovery.ts ---
