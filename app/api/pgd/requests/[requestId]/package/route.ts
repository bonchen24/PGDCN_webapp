import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { pool } from '@/lib/server/db';
import { requirePgdSession } from '@/lib/server/pgd';
import { mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonNotFound, jsonServerError } from '@/lib/server/response';
import { getPgdStorageClient } from '@/lib/server/pgd-files';
import { PGD_COLLECTIONS, PgdGeneratedDocument, PgdInspectionRequest } from '@/utils/pgdDomain';
import {
  PgdDossierDocument,
  reconcilePgdDossierChecklist,
} from '@/utils/pgdDossier';
import {
  buildPgdDossierPackageDownloadName,
  buildPgdDossierPackageManifest,
  PgdDossierPackageManifest,
  PgdDossierPackagePointer,
} from '@/utils/pgdDossierPackage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();
  if (!requestId) {
    return jsonBadRequest('Thiếu mã hồ sơ PGD.');
  }

  try {
    const requestResult = await pool.query(
      `SELECT document_id, data FROM app_documents
         WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd'
         LIMIT 1`,
      [PGD_COLLECTIONS.requests, requestId],
    );
    if (!requestResult.rows[0]) {
      return jsonNotFound('Không tìm thấy hồ sơ PGD.');
    }
    const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
    const now = new Date().toISOString();

    const dossierResult = await pool.query(
      `SELECT document_id, data
         FROM (
           SELECT document_id, data,
                  ROW_NUMBER() OVER (
                    PARTITION BY data->>'requirementCode', COALESCE(data->>'assessmentRoundId', '')
                    ORDER BY COALESCE((data->>'version')::int, 0) DESC, updated_at DESC, document_id DESC
                  ) AS current_row
             FROM app_documents
            WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd'
         ) current_documents
        WHERE current_row = 1
        ORDER BY data->>'requirementCode', COALESCE(data->>'assessmentRoundId', ''), document_id`,
      [PGD_COLLECTIONS.dossierDocuments, request.id],
    );
    const dossierDocuments = dossierResult.rows.map((row: any) => mapDocumentRow(row)) as PgdDossierDocument[];
    const generatedDocumentIds = Array.from(
      new Set(
        dossierDocuments
          .filter((document) => document.originCollection === PGD_COLLECTIONS.documents && document.originDocumentId)
          .map((document) => document.originDocumentId!),
      ),
    );
    const generatedResult =
      generatedDocumentIds.length > 0
        ? await pool.query(
            `SELECT document_id, data FROM app_documents
               WHERE collection_name = $1 AND document_id = ANY($2::text[]) AND data->>'domain' = 'pgd'`,
            [PGD_COLLECTIONS.documents, generatedDocumentIds],
          )
        : { rows: [] as any[] };
    const generatedDocumentsById = new Map<string, PgdGeneratedDocument>(
      generatedResult.rows.map((row: any) => {
        const document = mapDocumentRow(row) as PgdGeneratedDocument;
        return [document.id, document];
      }),
    );

    const pointers: PgdDossierPackagePointer[] = [];
    for (const document of dossierDocuments) {
      const generated = document.originDocumentId ? generatedDocumentsById.get(document.originDocumentId) : undefined;
      if (document.originCollection === PGD_COLLECTIONS.documents && (!generated || generated.requestId !== request.id)) {
        return jsonConflict(`Tài liệu checklist ${document.id} thiếu tài liệu sinh nguồn hợp lệ.`);
      }
      if (
        generated &&
        (document.checksum.toLowerCase() !== generated.sha256.toLowerCase() ||
          Number(document.byteSize) !== Number(generated.byteSize) ||
          String(document.fileAssetId || '') !== String(generated.fileAssetId || ''))
      ) {
        return jsonConflict(`Tài liệu checklist ${document.id} không khớp snapshot tài liệu sinh.`);
      }
      pointers.push({
        id: document.id,
        domain: 'pgd',
        requestId: request.id,
        ...(document.assessmentRoundId ? { assessmentRoundId: document.assessmentRoundId } : {}),
        fileName: document.fileName,
        sourceCollection: document.originCollection || PGD_COLLECTIONS.dossierDocuments,
        sourceDocumentId: document.originDocumentId || document.id,
        version: document.version,
        checksum: document.checksum,
        ...(document.fileAssetId ? { fileAssetId: document.fileAssetId } : {}),
        ...(document.mimeType ? { mimeType: document.mimeType } : {}),
        ...(Number.isFinite(document.byteSize) ? { byteSize: document.byteSize } : {}),
        kind: generated ? 'GENERATED_DOCUMENT' : 'DOSSIER_DOCUMENT',
        ...(generated?.contextHash ? { contextHash: generated.contextHash } : {}),
      });
    }

    const checklist = reconcilePgdDossierChecklist(request.productGroup, request.dossierChecklist, dossierDocuments, now);
    const candidateManifest = buildPgdDossierPackageManifest({
      dossierCode: request.requestCode,
      ownerUsername: request.ownerUsername,
      now,
      pointers,
      checklist,
    });

    if (!candidateManifest.complete) {
      return new NextResponse(
        JSON.stringify({
          error: `Bộ hồ sơ chưa sẵn sàng: thiếu ${candidateManifest.missingRequirementCodes.length} mục checklist và ${candidateManifest.missingAssetIds.length} file private.`,
          manifest: candidateManifest,
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const assetIds = candidateManifest.entries.map((entry) => entry.assetId);
    const assetResult =
      assetIds.length > 0
        ? await pool.query(
            `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
               FROM file_assets WHERE id = ANY($1::text[])`,
            [assetIds],
          )
        : { rows: [] as any[] };
    const assetsById = new Map<string, any>(assetResult.rows.map((asset: any) => [String(asset.id), asset]));

    const archive = new AdmZip();
    archive.addFile(
      'manifest.json',
      Buffer.from(
        JSON.stringify(
          {
            ...candidateManifest,
            generatedAt: now,
            request: {
              id: request.id,
              requestCode: request.requestCode,
              status: request.status,
              ownerUsername: request.ownerUsername,
              customerName: request.customerSnapshot?.name,
              productName: request.productName,
            },
          },
          null,
          2,
        ),
        'utf8',
      ),
    );

    const storage = candidateManifest.entries.length > 0 ? getPgdStorageClient() : undefined;
    for (const entry of candidateManifest.entries) {
      const asset = assetsById.get(entry.assetId);
      if (!storage || !asset) {
        return jsonConflict(`File asset ${entry.assetId} thiếu vị trí Storage.`);
      }
      const downloaded = await storage.downloadObject({ bucketName: String(asset.bucket_name), objectPath: String(asset.object_path) });
      const actualByteSize = downloaded.body.byteLength;
      const actualSha256 = createHash('sha256').update(downloaded.body).digest('hex');
      if (actualByteSize !== entry.byteSize || actualSha256 !== entry.checksum) {
        return jsonConflict(`File asset ${entry.assetId} không khớp byte size/SHA-256 với metadata.`);
      }
      archive.addFile(entry.archivePath, downloaded.body);
    }

    const body = archive.toBuffer();
    const downloadName = buildPgdDossierPackageDownloadName(request.requestCode);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
