// Author: Codex
// Description: Provenance-first manifest for a PGD dossier package.

import { PGD_DOMAIN, PGD_COLLECTIONS, type PgdDossierChecklistItem } from './pgdDomain.ts';

export type PgdDossierPackageSourceCollection =
  | typeof PGD_COLLECTIONS.dossierDocuments
  | typeof PGD_COLLECTIONS.documents;

export type PgdDossierPackageEntryKind = 'DOSSIER_DOCUMENT' | 'GENERATED_DOCUMENT';

export interface PgdDossierPackagePointer {
  id: string;
  domain: typeof PGD_DOMAIN;
  requestId: string;
  fileName?: string;
  sourceCollection: PgdDossierPackageSourceCollection;
  sourceDocumentId: string;
  version: number;
  checksum: string;
  fileAssetId?: string;
  mimeType?: string;
  byteSize?: number;
  kind: PgdDossierPackageEntryKind;
  contextHash?: string;
}

export interface PgdDossierPackageManifestEntry {
  assetId: string;
  archivePath: string;
  fileName: string;
  sourceCollection: PgdDossierPackageSourceCollection;
  sourceDocumentId: string;
  version: number;
  checksum: string;
  mimeType: string;
  byteSize: number;
  kind: PgdDossierPackageEntryKind;
  contextHash?: string;
}

export type PgdDossierPackageChecklistEntry = Pick<PgdDossierChecklistItem,
  'requirementCode' | 'group' | 'title' | 'required' | 'status' | 'currentDocumentId' | 'currentDocumentVersion' | 'waiverReason' | 'waivedByUsername' | 'waivedAt'>;

export interface PgdDossierPackageManifest {
  format: 'PGD_DOSSIER_PACKAGE_V1';
  domain: typeof PGD_DOMAIN;
  dossierCode: string;
  ownerUsername?: string;
  generatedAt: string;
  complete: boolean;
  missingAssetIds: string[];
  missingRequirementCodes: string[];
  checklist: PgdDossierPackageChecklistEntry[];
  entries: PgdDossierPackageManifestEntry[];
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function safeSegment(value: unknown, fallback: string): string {
  const normalized = clean(value)
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/\.\./g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return normalized || fallback;
}

function assertPointer(pointer: PgdDossierPackagePointer): void {
  if (pointer.domain !== PGD_DOMAIN) throw new Error('Gói bộ hồ sơ chỉ được chứa tài liệu PGD.');
  if (!clean(pointer.id) || !clean(pointer.requestId) || !clean(pointer.sourceDocumentId)) throw new Error('Pointer gói hồ sơ PGD thiếu định danh provenance.');
  if (!['pgdDossierDocuments', 'pgdDocuments'].includes(pointer.sourceCollection)) throw new Error(`Nguồn file PGD không được phép: ${pointer.sourceCollection}`);
  if (!['DOSSIER_DOCUMENT', 'GENERATED_DOCUMENT'].includes(pointer.kind)) throw new Error('Loại file trong gói hồ sơ PGD không hợp lệ.');
  if (!Number.isInteger(pointer.version) || pointer.version < 1) throw new Error('Phiên bản file trong gói hồ sơ PGD không hợp lệ.');
  if (!/^[a-f0-9]{64}$/i.test(clean(pointer.checksum))) throw new Error('Checksum file trong gói hồ sơ PGD phải là SHA-256.');
}

export function buildPgdDossierPackageManifest(input: {
  dossierCode: string;
  ownerUsername?: string;
  now?: string;
  pointers: PgdDossierPackagePointer[];
  checklist?: readonly PgdDossierPackageChecklistEntry[];
}): PgdDossierPackageManifest {
  const dossierCode = clean(input.dossierCode);
  if (!dossierCode) throw new Error('Thiếu mã hồ sơ để dựng manifest gói PGD.');
  if (!Array.isArray(input.pointers)) throw new Error('Danh sách pointer gói hồ sơ PGD không hợp lệ.');

  const entries: PgdDossierPackageManifestEntry[] = [];
  const missingAssetIds: string[] = [];
  const seen = new Set<string>();
  for (const pointer of input.pointers) {
    assertPointer(pointer);
    const identity = clean(pointer.fileAssetId) || clean(pointer.id);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const fileName = safeSegment(pointer.fileName, `${safeSegment(pointer.id, 'document')}.bin`);
    const assetId = clean(pointer.fileAssetId);
    if (!assetId) missingAssetIds.push(clean(pointer.id));
    entries.push({
      assetId,
      archivePath: `${String(entries.length + 1).padStart(2, '0')}-${fileName}`,
      fileName,
      sourceCollection: pointer.sourceCollection,
      sourceDocumentId: clean(pointer.sourceDocumentId),
      version: pointer.version,
      checksum: clean(pointer.checksum).toLowerCase(),
      mimeType: clean(pointer.mimeType) || 'application/octet-stream',
      byteSize: Number.isFinite(pointer.byteSize) && Number(pointer.byteSize) >= 0 ? Number(pointer.byteSize) : 0,
      kind: pointer.kind,
      ...(clean(pointer.contextHash) ? { contextHash: clean(pointer.contextHash).toLowerCase() } : {}),
    });
  }

  const checklist = (input.checklist || []).map((item) => ({
    requirementCode: clean(item.requirementCode),
    group: clean(item.group),
    title: clean(item.title),
    required: item.required === true,
    status: ['MISSING', 'PRESENT', 'WAIVED'].includes(String(item.status)) ? item.status : 'MISSING',
    ...(clean(item.currentDocumentId) ? { currentDocumentId: clean(item.currentDocumentId) } : {}),
    ...(Number.isInteger(item.currentDocumentVersion) && Number(item.currentDocumentVersion) > 0 ? { currentDocumentVersion: Number(item.currentDocumentVersion) } : {}),
    ...(clean(item.waiverReason) ? { waiverReason: clean(item.waiverReason) } : {}),
    ...(clean(item.waivedByUsername) ? { waivedByUsername: clean(item.waivedByUsername) } : {}),
    ...(clean(item.waivedAt) ? { waivedAt: clean(item.waivedAt) } : {}),
  }));
  const missingRequirementCodes = checklist
    .filter((item) => item.required && item.status !== 'PRESENT' && item.status !== 'WAIVED')
    .map((item) => item.requirementCode);

  return {
    format: 'PGD_DOSSIER_PACKAGE_V1',
    domain: PGD_DOMAIN,
    dossierCode,
    ...(clean(input.ownerUsername) ? { ownerUsername: clean(input.ownerUsername) } : {}),
    generatedAt: clean(input.now) || new Date().toISOString(),
    complete: missingAssetIds.length === 0 && missingRequirementCodes.length === 0,
    missingAssetIds,
    missingRequirementCodes,
    checklist,
    entries,
  };
}

export function buildPgdDossierPackageDownloadName(dossierCode: string): string {
  return `${safeSegment(dossierCode, 'pgd-dossier')}-bo-ho-so.zip`;
}
