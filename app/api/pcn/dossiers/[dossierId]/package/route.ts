import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { pool } from '@/lib/server/postgres';
import { requirePcnSession } from '@/lib/server/auth';
import { getPcnStorageClient } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonNotFound } from '@/lib/server/response';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { mapDocumentRow } from '@/lib/server/helpers';
import {
  CertificationDossier,
  IssuancePackage,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnGeneratedDocument,
  PcnOfficialGeneratedDocument,
  ReturnedTestResult,
} from '@/types';
import {
  buildPcnDossierPackageDownloadName,
  buildPcnDossierPackageManifest,
  PcnDossierPackagePointer,
} from '@/utils/pcnDossierPackage';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Gói hồ sơ PCN chỉ khả dụng trong profile PCN.');
  }

  const sessionError = requirePcnSession(req);
  if (sessionError) return sessionError;

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();
  if (!dossierId) {
    return jsonBadRequest('Thiếu mã hồ sơ PCN.');
  }

  type PackageCandidate = PcnDossierPackagePointer & {
    expectedProvenance: Array<{ sourceCollection: string; sourceDocumentId: string; sourceJsonPath: string }>;
  };

  try {
    const dossierResult = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'certificationDossiers' AND document_id = $1
       LIMIT 1`,
      [dossierId],
    );
    if (dossierResult.rows.length === 0) {
      return jsonNotFound('Không tìm thấy hồ sơ PCN.');
    }
    const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

    const [documentsResult, attachmentsResult, generatedResult, officialResult, resultsResult, issuanceResult] = await Promise.all([
      pool.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1
         ORDER BY document_id`,
        [dossier.id],
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'dossierAttachments' AND data->>'dossierId' = $1
         ORDER BY document_id`,
        [dossier.id],
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnGeneratedDocuments' AND data->>'dossierId' = $1
         ORDER BY document_id`,
        [dossier.id],
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnOfficialGeneratedDocuments' AND data->>'dossierId' = $1
         ORDER BY document_id`,
        [dossier.id],
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'returnedResults' AND data->>'dossierId' = $1
         ORDER BY document_id`,
        [dossier.id],
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'issuancePackages' AND data->>'dossierId' = $1
         ORDER BY document_id`,
        [dossier.id],
      ),
    ]);

    const candidates: PackageCandidate[] = [];
    const addCandidate = (candidate: Omit<PackageCandidate, 'expectedProvenance'>, expectedProvenance: PackageCandidate['expectedProvenance']) => {
      if (!String(candidate.assetId || '').trim()) return;
      candidates.push({ ...candidate, expectedProvenance });
    };

    for (const document of documentsResult.rows.map(mapDocumentRow) as PcnDossierDocument[]) {
      const versions = Array.isArray(document.versions) ? document.versions : [];
      versions.forEach((version: any, index: number) => {
        const assetId = String(version?.assetId || '').trim();
        if (!assetId) return;
        addCandidate({
          assetId,
          sourceCollection: 'dossierDocuments',
          sourceDocumentId: document.id,
          sourceJsonPath: document.requirementId,
          fileName: `v${index + 1}-${String(version?.fileName || `${assetId}.bin`)}`,
          mimeType: version?.mimeType,
          byteSize: Number(version?.byteSize || 0),
          sha256: version?.sha256,
          category: 'CHECKLIST',
        }, [{ sourceCollection: 'dossierDocuments', sourceDocumentId: document.id, sourceJsonPath: document.requirementId }]);
      });
    }

    for (const attachment of attachmentsResult.rows.map(mapDocumentRow) as PcnDossierAttachment[]) {
      addCandidate({
        assetId: attachment.assetId,
        sourceCollection: 'dossierAttachments',
        sourceDocumentId: attachment.id,
        sourceJsonPath: attachment.requirementId || 'fileAssetId',
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        byteSize: attachment.byteSize,
        sha256: attachment.sha256,
        category: 'ATTACHMENTS',
      }, [
        { sourceCollection: 'dossierAttachments', sourceDocumentId: attachment.id, sourceJsonPath: attachment.requirementId || 'fileAssetId' },
        { sourceCollection: 'dossierAttachments', sourceDocumentId: dossier.id, sourceJsonPath: `attachments.${attachment.kind}` },
      ]);
    }

    for (const generated of generatedResult.rows.map(mapDocumentRow) as PcnGeneratedDocument[]) {
      addCandidate({
        assetId: generated.fileAssetId,
        sourceCollection: 'pcnGeneratedDocuments',
        sourceDocumentId: generated.id,
        sourceJsonPath: 'fileAssetId',
        fileName: generated.fileName,
        mimeType: generated.mimeType,
        byteSize: generated.byteSize,
        sha256: generated.sha256,
        category: 'GENERATED',
        kind: generated.kind,
        format: generated.format,
        contextHash: generated.contextHash,
        sourceUpdatedAt: generated.sourceUpdatedAt,
      }, [{ sourceCollection: 'pcnGeneratedDocuments', sourceDocumentId: generated.id, sourceJsonPath: 'fileAssetId' }]);
    }

    for (const generated of officialResult.rows.map(mapDocumentRow) as PcnOfficialGeneratedDocument[]) {
      addCandidate({
        assetId: generated.fileAssetId,
        sourceCollection: 'pcnOfficialGeneratedDocuments',
        sourceDocumentId: generated.id,
        sourceJsonPath: 'fileAssetId',
        fileName: generated.fileName,
        mimeType: generated.mimeType,
        byteSize: generated.byteSize,
        sha256: generated.sha256,
        category: 'OFFICIAL',
        kind: generated.documentKind,
        format: generated.format,
        contextHash: generated.contextHash,
        sourceUpdatedAt: generated.sourceUpdatedAt,
      }, [{ sourceCollection: 'pcnOfficialGeneratedDocuments', sourceDocumentId: generated.id, sourceJsonPath: 'fileAssetId' }]);
    }

    for (const result of resultsResult.rows.map(mapDocumentRow) as ReturnedTestResult[]) {
      if (!result.fileAssetId) continue;
      addCandidate({
        assetId: result.fileAssetId,
        sourceCollection: 'returnedResults',
        sourceDocumentId: result.id,
        sourceJsonPath: 'fileAssetId',
        fileName: result.reportNumber ? `${result.reportNumber}.pdf` : undefined,
        category: 'RESULT',
      }, [{ sourceCollection: 'returnedResults', sourceDocumentId: result.id, sourceJsonPath: 'fileAssetId' }]);
    }

    for (const issuance of issuanceResult.rows.map(mapDocumentRow) as IssuancePackage[]) {
      for (const assetId of Array.isArray(issuance.fileAssetIds) ? issuance.fileAssetIds : []) {
        addCandidate({
          assetId: String(assetId),
          sourceCollection: 'issuancePackages',
          sourceDocumentId: issuance.id,
          sourceJsonPath: 'fileAssetIds',
          category: 'ISSUANCE',
        }, [{ sourceCollection: 'issuancePackages', sourceDocumentId: issuance.id, sourceJsonPath: 'fileAssetIds' }]);
      }
    }

    const assetIds = [...new Set(candidates.map((candidate) => String(candidate.assetId).trim()).filter(Boolean))];
    const assetResult = assetIds.length > 0
      ? await pool.query(
        `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
         FROM file_assets WHERE id = ANY($1::text[])`,
        [assetIds],
      )
      : { rows: [] as any[] };
    const assetsById = new Map(assetResult.rows.map((asset: any) => [String(asset.id), asset]));
    const verifiedPointers: PcnDossierPackagePointer[] = [];

    for (const candidate of candidates) {
      const asset = assetsById.get(String(candidate.assetId));
      if (!asset) throw Object.assign(new Error(`Không tìm thấy file asset ${candidate.assetId} của hồ sơ.`), { statusCode: 409 });
      const actualProvenance = {
        sourceCollection: String(asset.source_collection || ''),
        sourceDocumentId: String(asset.source_document_id || ''),
        sourceJsonPath: String(asset.source_json_path || ''),
      };
      if (!candidate.expectedProvenance.some((expected) => expected.sourceCollection === actualProvenance.sourceCollection
        && expected.sourceDocumentId === actualProvenance.sourceDocumentId
        && expected.sourceJsonPath === actualProvenance.sourceJsonPath)) {
        throw Object.assign(new Error(`Provenance file asset ${candidate.assetId} không khớp pointer của hồ sơ.`), { statusCode: 409 });
      }
      verifiedPointers.push({
        ...candidate,
        ...actualProvenance,
        fileName: candidate.fileName || String(asset.object_path || '').split('/').pop() || `${candidate.assetId}.bin`,
        mimeType: String(asset.mime_type || candidate.mimeType || 'application/octet-stream'),
        byteSize: Number(asset.byte_size || 0),
        sha256: String(asset.sha256 || '').trim().toLowerCase(),
      });
    }

    const manifestEntries = buildPcnDossierPackageManifest({ dossierCode: dossier.dossierCode || dossier.id, pointers: verifiedPointers });
    const packageFiles: Array<{ archivePath: string; body: Buffer }> = [];
    if (manifestEntries.length > 0) {
      const storage = getPcnStorageClient();
      for (const entry of manifestEntries) {
        const asset = assetsById.get(entry.assetId);
        if (!asset || !String(asset.bucket_name || '').trim() || !String(asset.object_path || '').trim()) {
          throw Object.assign(new Error(`File asset ${entry.assetId} thiếu vị trí Storage.`), { statusCode: 409 });
        }
        const downloaded = await storage.downloadObject({ bucketName: String(asset.bucket_name), objectPath: String(asset.object_path) });
        const actualByteSize = downloaded.body.byteLength;
        const actualSha256 = createHash('sha256').update(downloaded.body).digest('hex');
        if (actualByteSize !== entry.byteSize || actualSha256 !== entry.sha256) {
          throw Object.assign(new Error(`File asset ${entry.assetId} không khớp byte size/SHA-256 với metadata.`), { statusCode: 409 });
        }
        packageFiles.push({ archivePath: entry.archivePath, body: downloaded.body });
      }
    }

    const generatedAt = new Date().toISOString();
    const archive = new AdmZip();
    archive.addFile('manifest.json', Buffer.from(JSON.stringify({
      format: 'PCN_DOSSIER_PACKAGE_V1',
      generatedAt,
      dossier: {
        id: dossier.id,
        dossierCode: dossier.dossierCode,
        status: dossier.status,
        fieldCodes: dossier.fieldCodes,
      },
      entries: manifestEntries.map(({ assetId, archivePath, fileName, sourceCollection, sourceDocumentId, sourceJsonPath, mimeType, byteSize, sha256, kind, format, contextHash, sourceUpdatedAt }) => ({
        assetId,
        archivePath,
        fileName,
        sourceCollection,
        sourceDocumentId,
        sourceJsonPath,
        mimeType,
        byteSize,
        sha256,
        ...(kind ? { kind } : {}),
        ...(format ? { format } : {}),
        ...(contextHash ? { contextHash } : {}),
        ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
      })),
    }, null, 2), 'utf8'));

    for (const file of packageFiles) archive.addFile(file.archivePath, file.body);

    const body = archive.toBuffer();
    const downloadName = buildPcnDossierPackageDownloadName(dossier.dossierCode || dossier.id);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error: any) {
    console.error('PCN dossier package error:', error);
    const message = String(error?.message || error);
    const status = Number(error?.statusCode) || (message.toLowerCase().includes('storage is not configured') ? 503 : 500);
    return jsonError(message, status);
  }
}
