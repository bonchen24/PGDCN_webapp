import { createHash } from 'node:crypto';
import type {
  ActivityLog,
  CertificationDossier,
  CertificationProposal,
  PcnCertificationFieldCode,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnHistoricalFileKind,
  PcnHistoricalImportMetadata,
} from '../types.ts';
import { buildActivityLog } from './activityLog.ts';
import { reconcilePcnHistoricalAttachmentMapping } from './pcnHistoricalAttachmentMapping.ts';

export interface PcnHistoricalPilotSpec {
  fieldCode: 'QC4' | 'QC9';
  businessCode: string;
  dossierCode: string;
  proposalCode: string;
  folderName: string;
  sourceRelativePath: string;
}

export const DEFAULT_PCN_HISTORICAL_PILOT: readonly PcnHistoricalPilotSpec[] = [
  {
    fieldCode: 'QC4',
    businessCode: '0665',
    dossierCode: 'QC4-2026-0665',
    proposalCode: 'DN-QC4-2026-0665',
    folderName: '0665 ĐẠI DƯƠNG 1 nồi chiên-Full',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới/0665 ĐẠI DƯƠNG 1 nồi chiên-Full',
  },
  {
    fieldCode: 'QC4',
    businessCode: '0670',
    dossierCode: 'QC4-2026-0670',
    proposalCode: 'DN-QC4-2026-0670',
    folderName: '0670 Thái Lan 1 nồi chiên-giảm',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới/0670 Thái Lan 1 nồi chiên-giảm',
  },
  {
    fieldCode: 'QC4',
    businessCode: '0694',
    dossierCode: 'QC4-2026-0694',
    proposalCode: 'DN-QC4-2026-0694',
    folderName: '0694 E MOVE MÁY DUỐI MÁY SÂY FULL',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới/0694 E MOVE MÁY DUỐI MÁY SÂY FULL',
  },
  {
    fieldCode: 'QC4',
    businessCode: '0770',
    dossierCode: 'QC4-2026-0770',
    proposalCode: 'DN-QC4-2026-0770',
    folderName: '0770 Clisun 04-1 quạt trần giảm- Trung TIL',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới/0770 Clisun 04-1 quạt trần giảm- Trung TIL',
  },
  {
    fieldCode: 'QC4',
    businessCode: '1325',
    dossierCode: 'QC4-2026-1325',
    proposalCode: 'DN-QC4-2026-1325',
    folderName: '1325 Ánh dương Đăng ký QC4 - QG2026257654',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới/1325 Ánh dương Đăng ký QC4 - QG2026257654',
  },
  {
    fieldCode: 'QC9',
    businessCode: '0105-01',
    dossierCode: 'QC9-2026-0105-01',
    proposalCode: 'DN-QC9-2026-0105-01',
    folderName: 'IEMM 0105-01 Hà Yến TF ok',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0105-01 Hà Yến TF ok',
  },
  {
    fieldCode: 'QC9',
    businessCode: '0105-02',
    dossierCode: 'QC9-2026-0105-02',
    proposalCode: 'DN-QC9-2026-0105-02',
    folderName: 'IEMM 0105-02 Hà yến TF ok',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0105-02 Hà yến TF ok',
  },
  {
    fieldCode: 'QC9',
    businessCode: '0105-03',
    dossierCode: 'QC9-2026-0105-03',
    proposalCode: 'DN-QC9-2026-0105-03',
    folderName: 'IEMM 0105-03 Hà yến TF ok',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0105-03 Hà yến TF ok',
  },
  {
    fieldCode: 'QC9',
    businessCode: '0136-03',
    dossierCode: 'QC9-2026-0136-03',
    proposalCode: 'DN-QC9-2026-0136-03',
    folderName: 'IEMM 0136-03 Hòa Phát PF NEW CHƯA IN',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0136-03 Hòa Phát PF NEW CHƯA IN',
  },
  {
    fieldCode: 'QC9',
    businessCode: '0171-05',
    dossierCode: 'QC9-2026-0171-05',
    proposalCode: 'DN-QC9-2026-0171-05',
    folderName: 'IEMM 0171-05 Faster TF thiếu ảnh',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0171-05 Faster TF thiếu ảnh',
  },
];

export interface PcnHistoricalFolderParse {
  businessCode: string;
  customerName: string;
  productName: string;
  variantHint?: string;
  unresolvedFields: string[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeForSearch(value: string): string {
  return normalizeWhitespace(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

function cleanLabel(value: string): string {
  return normalizeWhitespace(value.replace(/[._]+/g, ' ').replace(/\s*[-–—]\s*$/g, ''));
}

const QC4_FOLDER_PATTERN = /^(\d{3,6}(?:(?:[-/.])\d{1,3}[A-Za-z]?)?)(?:(?:\s+|[-–—]\s*)(.*))?$/i;
const QC9_FOLDER_PATTERN = /^IEMM\s*([0-9]{3,6}(?:[-/]\d{1,3})?)(?:\s*(.*))?$/i;

export function isPcnHistoricalFolderName(fieldCode: 'QC4' | 'QC9', folderName: string): boolean {
  const normalized = normalizeWhitespace(folderName);
  return (fieldCode === 'QC4' ? QC4_FOLDER_PATTERN : QC9_FOLDER_PATTERN).test(normalized);
}

export function normalizePcnHistoricalCode(value: string): string {
  return normalizeWhitespace(value)
    .replace(/^iemm\s*/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
}

export function parsePcnHistoricalFolderName(fieldCode: 'QC4' | 'QC9', folderName: string): PcnHistoricalFolderParse {
  const original = normalizeWhitespace(folderName);
  const codePattern = fieldCode === 'QC4' ? QC4_FOLDER_PATTERN : QC9_FOLDER_PATTERN;
  const match = original.match(codePattern);
  const businessCode = normalizePcnHistoricalCode(match?.[1] || original.split(/\s+/)[0] || 'UNKNOWN');
  let label = cleanLabel(match ? (match[2] || '') : original);
  const variantPattern = fieldCode === 'QC4'
    ? /(?:^|[\s-])(Full|giảm)\s*$/i
    : /(?:^|\s)(TF\s*ok|PF(?:\s*NEW)?(?:\s*CHƯA\s*IN)?|ko\s*dat|chưa\s*in|thiếu\s*ảnh)\s*$/i;
  const variantMatch = label.match(variantPattern);
  const variantHint = variantMatch ? normalizeWhitespace(variantMatch[1]) : undefined;
  if (variantMatch) label = cleanLabel(label.slice(0, variantMatch.index));

  if (fieldCode === 'QC9') {
    return {
      businessCode,
      customerName: label || 'Chưa chuẩn hóa khách hàng',
      productName: 'Chưa chuẩn hóa từ hồ sơ lịch sử',
      ...(variantHint ? { variantHint } : {}),
      unresolvedFields: ['productName', 'method'],
    };
  }

  label = cleanLabel(label.replace(/\bđăng ký\s+QC4\b.*$/i, ''));
  const countSplit = label.match(/^(.+?)\s+\d+\s+(.+)$/);
  const markerSplit = label.match(/^(.+?)\s+(nồi|quạt|bếp|máy|ấm|phích|dây|tủ|đèn|bình)\b\s*(.*)$/i);
  const customerName = cleanLabel(countSplit?.[1] || markerSplit?.[1] || label) || 'Chưa chuẩn hóa khách hàng';
  const productName = cleanLabel(countSplit?.[2] || (markerSplit ? `${markerSplit[2]} ${markerSplit[3]}` : 'Chưa chuẩn hóa từ hồ sơ lịch sử'));
  return {
    businessCode,
    customerName,
    productName,
    ...(variantHint ? { variantHint } : {}),
    unresolvedFields: ['method'],
  };
}

export function classifyPcnHistoricalFile(relativePath: string): PcnHistoricalFileKind | 'SKIP_ARCHIVE' | 'SKIP_TEMP' {
  const fileName = normalizeWhitespace(relativePath.split(/[\\/]/).pop() || relativePath);
  const normalizedPath = normalizeForSearch(relativePath);
  const extension = fileName.includes('.') ? `.${fileName.split('.').pop()!.toLowerCase()}` : '';
  if (fileName === '.DS_Store' || fileName.toLowerCase() === 'thumbs.db' || fileName.startsWith('~$') || extension === '.tmp') return 'SKIP_TEMP';
  if (['.rar', '.zip', '.7z'].includes(extension)) return 'SKIP_ARCHIVE';
  if (['.jpg', '.jpeg', '.png', '.jfif', '.webp', '.heic', '.tif', '.tiff'].includes(extension)) return 'PHOTO';
  if (/bien ban tra mau|tra mau|sample return/.test(normalizedPath)) return 'SAMPLE_RETURN';
  if (/quyet dinh|quyet-dinh|decision/.test(normalizedPath)) return 'DECISION';
  if (/emc\s*\d|itd\s*\d|itdc\s*\d|bao cao ket qua thu nghiem|test report/.test(normalizedPath)) return 'TEST_REPORT';
  if (/khac[\s_-]+phuc|corrective action/.test(normalizedPath)) return 'CORRECTIVE_ACTION';
  if (/gcn|giay chung nhan|chung chi|certificate/.test(normalizedPath)) return 'CERTIFICATE';
  if (/de nghi|don dang ky|de-nghi|proposal|application form/.test(normalizedPath)) return 'PROPOSAL';
  if (/bien ban|bb hien truong|lay mau|giao mau|nhan mau|sample/.test(normalizedPath)) return 'SAMPLE_HANDOVER';
  if (/hop dong|contract|invoice|\binv\b|packing|\bpkl\b|tokhai|to khai|\bhbl\b|\bpo\b|annex|bill/.test(normalizedPath)) return 'COMMERCIAL';
  return 'OTHER';
}

export interface PcnHistoricalFileInput {
  relativePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
}

export interface PcnHistoricalSkippedFile {
  relativePath: string;
  fileName: string;
  reason: 'ARCHIVE' | 'TEMPORARY';
}

export interface PcnHistoricalImportFile extends PcnHistoricalFileInput {
  kind: PcnHistoricalFileKind;
}

export function filterPcnHistoricalFiles(files: PcnHistoricalFileInput[]): {
  importable: PcnHistoricalImportFile[];
  skipped: PcnHistoricalSkippedFile[];
} {
  const importable: PcnHistoricalImportFile[] = [];
  const skipped: PcnHistoricalSkippedFile[] = [];
  for (const file of [...files].sort((left, right) => left.relativePath.localeCompare(right.relativePath))) {
    const kind = classifyPcnHistoricalFile(file.relativePath || file.fileName);
    if (kind === 'SKIP_ARCHIVE' || kind === 'SKIP_TEMP') {
      skipped.push({ relativePath: file.relativePath, fileName: file.fileName, reason: kind === 'SKIP_ARCHIVE' ? 'ARCHIVE' : 'TEMPORARY' });
    } else {
      importable.push({ ...file, kind });
    }
  }
  return { importable, skipped };
}

function stableToken(value: string): string {
  let first = 2166136261;
  let second = 16777619;
  for (const char of value) {
    first ^= char.charCodeAt(0);
    first = Math.imul(first, 16777619);
    second ^= char.charCodeAt(0) + 31;
    second = Math.imul(second, 2166136261);
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

const PCN_HISTORICAL_VOLATILE_FIELDS = new Set(['createdAt', 'updatedAt', 'importedAt', 'receivedAt', 'uploadedAt']);

export function normalizePcnHistoricalIdempotencyPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizePcnHistoricalIdempotencyPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key, item]) => !PCN_HISTORICAL_VOLATILE_FIELDS.has(key) && item !== undefined)
        .map(([key, item]) => [key, normalizePcnHistoricalIdempotencyPayload(item)])
    );
  }
  return value;
}

function stablePcnHistoricalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stablePcnHistoricalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stablePcnHistoricalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function buildPcnHistoricalBatchFingerprint(plans: PcnHistoricalImportPlan[]): string {
  const payload = plans
    .map((plan) => ({
      proposal: normalizePcnHistoricalIdempotencyPayload(plan.proposal),
      dossier: normalizePcnHistoricalIdempotencyPayload(plan.dossier),
      documents: normalizePcnHistoricalIdempotencyPayload([...plan.documents].sort((left, right) => left.id.localeCompare(right.id))),
      attachments: normalizePcnHistoricalIdempotencyPayload([...plan.attachments].sort((left, right) => left.id.localeCompare(right.id))),
      skippedFiles: normalizePcnHistoricalIdempotencyPayload([...plan.skippedFiles].sort((left, right) => left.relativePath.localeCompare(right.relativePath))),
    }))
    .sort((left, right) => String((left.dossier as { id?: string })?.id || '').localeCompare(String((right.dossier as { id?: string })?.id || '')));
  return createHash('sha256').update(stablePcnHistoricalJson(payload)).digest('hex');
}

export interface PcnHistoricalImportPlan {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  documents: PcnDossierDocument[];
  attachments: PcnDossierAttachment[];
  skippedFiles: PcnHistoricalSkippedFile[];
  activityLog: ActivityLog;
}

export function buildPcnHistoricalImportPlan(input: {
  spec: PcnHistoricalPilotSpec;
  batchId: string;
  importedAt: string;
  files: PcnHistoricalFileInput[];
}): PcnHistoricalImportPlan {
  const parsed = parsePcnHistoricalFolderName(input.spec.fieldCode, input.spec.folderName);
  const dossierId = `pcn-historical-dossier-${stableToken(input.spec.dossierCode.toLowerCase()).slice(0, 16)}`;
  const proposalId = `pcn-historical-proposal-${stableToken(input.spec.proposalCode.toLowerCase()).slice(0, 16)}`;
  const historicalImport: PcnHistoricalImportMetadata = {
    batchId: input.batchId,
    sourceFamily: input.spec.fieldCode,
    sourceFolderName: input.spec.folderName,
    sourceRelativePath: input.spec.sourceRelativePath,
    ...(parsed.variantHint ? { variantHint: parsed.variantHint } : {}),
    reviewStatus: 'PENDING_REVIEW',
    unresolvedFields: [...parsed.unresolvedFields],
    importedAt: input.importedAt,
  };
  const proposal: CertificationProposal = {
    id: proposalId,
    proposalCode: input.spec.proposalCode,
    channel: 'OTHER',
    status: 'CONVERTED',
    dossierId,
    customerSnapshot: { name: parsed.customerName, address: '' },
    productName: parsed.productName,
    quantity: 1,
    fieldCodes: [input.spec.fieldCode],
    receivedAt: input.importedAt,
    createdAt: input.importedAt,
    updatedAt: input.importedAt,
    historicalImport,
  };
  const dossier: CertificationDossier = {
    id: dossierId,
    dossierCode: input.spec.dossierCode,
    proposalId: proposal.id,
    customerSnapshot: { ...proposal.customerSnapshot },
    fieldCodes: [input.spec.fieldCode],
    method: 'METHOD_1',
    status: 'ON_HOLD',
    labRequestIds: [],
    returnedResultIds: [],
    sampleLotIds: [],
    createdAt: input.importedAt,
    updatedAt: input.importedAt,
    historicalImport,
  };
  const filtered = filterPcnHistoricalFiles(input.files);
  const attachments = filtered.importable.map((file): PcnDossierAttachment => {
    const stableKey = `${dossier.id}|${file.relativePath}|${file.sha256}`;
    return {
      id: `pcn-attachment-hist-${stableToken(stableKey)}`,
      dossierId: dossier.id,
      fieldCode: input.spec.fieldCode,
      kind: file.kind,
      fileName: file.fileName,
      sourceRelativePath: file.relativePath,
      assetId: `pcn-file-hist-${stableToken(stableKey)}`,
      mimeType: file.mimeType,
      byteSize: file.byteSize,
      sha256: file.sha256,
      importedAt: input.importedAt,
      note: 'Tệp nhập từ hồ sơ lịch sử; đường dẫn nguồn chỉ là provenance, không dùng để mở file runtime.',
    };
  });
  const mapped = reconcilePcnHistoricalAttachmentMapping({
    dossierId: dossier.id,
    fieldCodes: dossier.fieldCodes,
    attachments,
    existingDocuments: [],
    now: input.importedAt,
  });
  const activityLog = buildActivityLog({
    id: `activity-${input.batchId}-${dossier.id}`,
    createdAt: input.importedAt,
    actorName: 'Nhập hồ sơ lịch sử',
    action: 'IMPORTED',
    entityType: 'PCN_DOSSIER',
    entityId: dossier.id,
    entityLabel: dossier.dossierCode,
    summary: `Nhập hồ sơ lịch sử ${dossier.dossierCode} từ bộ PCN tham chiếu`,
    source: 'IMPORT',
    groupId: input.batchId,
  });
  return { proposal, dossier, documents: mapped.documents, attachments: mapped.attachments, skippedFiles: filtered.skipped, activityLog };
}

// --- End of pcnHistoricalImport.ts ---
