// Author: Codex
// OS support: Node/Web
// Description: Allowlisted, provenance-first manifest for a PCN dossier download package

import type {
  IssuancePackage,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnGeneratedDocument,
  PcnOfficialGeneratedDocument,
  ReturnedTestResult,
} from '../types.ts';

export const PCN_DOSSIER_PACKAGE_SOURCE_COLLECTIONS = [
  'dossierDocuments',
  'dossierAttachments',
  'pcnGeneratedDocuments',
  'pcnOfficialGeneratedDocuments',
  'returnedResults',
  'issuancePackages',
] as const;

export type PcnDossierPackageSourceCollection = typeof PCN_DOSSIER_PACKAGE_SOURCE_COLLECTIONS[number];
export type PcnDossierPackageCategory = 'CHECKLIST' | 'HISTORICAL' | 'GENERATED' | 'OFFICIAL' | 'RESULT' | 'ISSUANCE';

export interface PcnDossierPackagePointer {
  assetId: string;
  sourceCollection: string;
  sourceDocumentId: string;
  sourceJsonPath: string;
  fileName?: string;
  mimeType?: string;
  byteSize?: number;
  sha256?: string;
  bucketName?: string;
  objectPath?: string;
  category: PcnDossierPackageCategory;
  /** Optional lineage metadata for generated or official documents. */
  kind?: string;
  format?: string;
  contextHash?: string;
  sourceUpdatedAt?: string;
}

export interface PcnDossierPackageManifestEntry {
  assetId: string;
  archivePath: string;
  fileName: string;
  sourceCollection: string;
  sourceDocumentId: string;
  sourceJsonPath: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  kind?: string;
  format?: string;
  contextHash?: string;
  sourceUpdatedAt?: string;
}

const CATEGORY_DIRECTORIES: Record<PcnDossierPackageCategory, string> = {
  CHECKLIST: '01-checklist',
  HISTORICAL: '02-historical',
  GENERATED: '03-generated',
  OFFICIAL: '04-official',
  RESULT: '05-results',
  ISSUANCE: '06-issuance',
};

const CATEGORY_LABELS: Record<PcnDossierPackageCategory, string> = {
  CHECKLIST: 'Checklist tài liệu',
  HISTORICAL: 'Tệp hồ sơ lịch sử',
  GENERATED: 'Biểu mẫu sinh nội bộ',
  OFFICIAL: 'Tài liệu phát hành chính thức',
  RESULT: 'KQTN trả về',
  ISSUANCE: 'Tệp bộ phát hành',
};

const CATEGORY_ORDER: readonly PcnDossierPackageCategory[] = [
  'CHECKLIST',
  'HISTORICAL',
  'GENERATED',
  'OFFICIAL',
  'RESULT',
  'ISSUANCE',
];

export interface PcnDossierPackageSummaryGroup {
  category: PcnDossierPackageCategory;
  label: string;
  assetCount: number;
  knownByteSize: number;
  unknownByteCount: number;
}

export interface PcnDossierPackageSummary {
  totalAssetCount: number;
  knownByteSize: number;
  unknownByteCount: number;
  groups: PcnDossierPackageSummaryGroup[];
}

interface SummaryAsset {
  category: PcnDossierPackageCategory;
  byteSize?: number;
}

function addSummaryAsset(assets: Map<string, SummaryAsset>, assetId: unknown, category: PcnDossierPackageCategory, byteSize?: unknown): void {
  const normalizedAssetId = String(assetId || '').trim();
  if (!normalizedAssetId || assets.has(normalizedAssetId)) return;
  const numericByteSize = Number(byteSize);
  assets.set(normalizedAssetId, {
    category,
    ...(Number.isFinite(numericByteSize) && numericByteSize >= 0 ? { byteSize: numericByteSize } : {}),
  });
}

/**
 * Builds the client-side, read-only package projection used before download.
 * The server package boundary remains authoritative for provenance and checksums.
 */
export function buildPcnDossierPackageSummary(input: {
  documents?: PcnDossierDocument[];
  attachments?: PcnDossierAttachment[];
  generatedDocuments?: PcnGeneratedDocument[];
  officialDocuments?: PcnOfficialGeneratedDocument[];
  returnedResults?: ReturnedTestResult[];
  issuancePackages?: IssuancePackage[];
}): PcnDossierPackageSummary {
  const assets = new Map<string, SummaryAsset>();

  for (const document of input.documents || []) {
    for (const version of document.versions || []) addSummaryAsset(assets, version.assetId, 'CHECKLIST', version.byteSize);
  }
  for (const attachment of input.attachments || []) addSummaryAsset(assets, attachment.assetId, 'HISTORICAL', attachment.byteSize);
  for (const document of input.generatedDocuments || []) addSummaryAsset(assets, document.fileAssetId, 'GENERATED', document.byteSize);
  for (const document of input.officialDocuments || []) addSummaryAsset(assets, document.fileAssetId, 'OFFICIAL', document.byteSize);
  for (const result of input.returnedResults || []) addSummaryAsset(assets, result.fileAssetId, 'RESULT');
  for (const issuance of input.issuancePackages || []) {
    for (const assetId of issuance.fileAssetIds || []) addSummaryAsset(assets, assetId, 'ISSUANCE');
  }

  const groups = CATEGORY_ORDER.map((category) => {
    const groupAssets = [...assets.values()].filter((asset) => asset.category === category);
    return {
      category,
      label: CATEGORY_LABELS[category],
      assetCount: groupAssets.length,
      knownByteSize: groupAssets.reduce((sum, asset) => sum + (asset.byteSize ?? 0), 0),
      unknownByteCount: groupAssets.filter((asset) => asset.byteSize === undefined).length,
    };
  });

  return {
    totalAssetCount: assets.size,
    knownByteSize: groups.reduce((sum, group) => sum + group.knownByteSize, 0),
    unknownByteCount: groups.reduce((sum, group) => sum + group.unknownByteCount, 0),
    groups,
  };
}

function safeArchiveSegment(value: unknown, fallback: string): string {
  const cleaned = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned || fallback;
}

function archiveFileName(pointer: PcnDossierPackagePointer): string {
  const fallback = `${safeArchiveSegment(pointer.assetId, 'asset')}.bin`;
  return safeArchiveSegment(pointer.fileName, fallback);
}

function assertPointer(pointer: PcnDossierPackagePointer): asserts pointer is PcnDossierPackagePointer & { sourceCollection: PcnDossierPackageSourceCollection } {
  if (!PCN_DOSSIER_PACKAGE_SOURCE_COLLECTIONS.includes(pointer.sourceCollection as PcnDossierPackageSourceCollection)) {
    throw new Error(`Nguồn file PCN không được phép: ${pointer.sourceCollection}`);
  }
  if (!String(pointer.assetId || '').trim() || !String(pointer.sourceDocumentId || '').trim() || !String(pointer.sourceJsonPath || '').trim()) {
    throw new Error('Pointer file PCN thiếu định danh provenance.');
  }
  if (!CATEGORY_DIRECTORIES[pointer.category]) throw new Error('Nhóm file trong gói hồ sơ PCN không hợp lệ.');
}

export function buildPcnDossierPackageManifest(input: {
  dossierCode: string;
  pointers: PcnDossierPackagePointer[];
}): PcnDossierPackageManifestEntry[] {
  if (!String(input.dossierCode || '').trim()) throw new Error('Thiếu mã hồ sơ để dựng manifest gói PCN.');
  if (!Array.isArray(input.pointers)) throw new Error('Danh sách pointer gói hồ sơ PCN không hợp lệ.');

  const entries: PcnDossierPackageManifestEntry[] = [];
  const seenAssets = new Set<string>();
  const usedPaths = new Set<string>();

  for (const pointer of input.pointers) {
    assertPointer(pointer);
    const assetId = String(pointer.assetId).trim();
    if (seenAssets.has(assetId)) continue;
    seenAssets.add(assetId);

    const directory = CATEGORY_DIRECTORIES[pointer.category];
    const sourceDocumentId = safeArchiveSegment(pointer.sourceDocumentId, 'document');
    const fileName = archiveFileName(pointer);
    let archivePath = `${directory}/${sourceDocumentId}/${fileName}`;
    if (usedPaths.has(archivePath)) {
      const dot = fileName.lastIndexOf('.');
      const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
      const extension = dot > 0 ? fileName.slice(dot) : '';
      archivePath = `${directory}/${sourceDocumentId}/${stem}-${safeArchiveSegment(assetId, 'asset')}${extension}`;
    }
    usedPaths.add(archivePath);

    entries.push({
      assetId,
      archivePath,
      fileName,
      sourceCollection: pointer.sourceCollection,
      sourceDocumentId: String(pointer.sourceDocumentId).trim(),
      sourceJsonPath: String(pointer.sourceJsonPath).trim(),
      mimeType: String(pointer.mimeType || 'application/octet-stream'),
      byteSize: Number.isFinite(Number(pointer.byteSize)) && Number(pointer.byteSize) >= 0 ? Number(pointer.byteSize) : 0,
      sha256: String(pointer.sha256 || '').trim().toLowerCase(),
      ...(String(pointer.kind || '').trim() ? { kind: String(pointer.kind).trim() } : {}),
      ...(String(pointer.format || '').trim() ? { format: String(pointer.format).trim().toUpperCase() } : {}),
      ...(String(pointer.contextHash || '').trim() ? { contextHash: String(pointer.contextHash).trim().toLowerCase() } : {}),
      ...(String(pointer.sourceUpdatedAt || '').trim() ? { sourceUpdatedAt: String(pointer.sourceUpdatedAt).trim() } : {}),
    });
  }

  return entries;
}

export function buildPcnDossierPackageDownloadName(dossierCode: string): string {
  return `${safeArchiveSegment(dossierCode, 'pcn-dossier')}-bo-ho-so.zip`;
}

// --- End of pcnDossierPackage.ts ---
