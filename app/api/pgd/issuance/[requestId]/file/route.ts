import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { mapDocumentRow } from '@/lib/server/collections';
import { requirePgdSession } from '@/lib/server/pgd';
import { getPgdStorageClient } from '@/lib/server/pgd-files';
import { jsonNotFound, jsonServerError } from '@/lib/server/response';
import { PGD_COLLECTIONS, type PgdInspectionCertificate } from '@/utils/pgdDomain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;
  try {
    const { requestId: rawRequestId } = await params;
    const requestId = decodeURIComponent(String(rawRequestId || '')).trim();
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`,
      [PGD_COLLECTIONS.certificates, requestId],
    );
    const certificate = result.rows[0] ? mapDocumentRow(result.rows[0]) as PgdInspectionCertificate : undefined;
    if (!certificate?.issuanceFileAssetId) return jsonNotFound('Chưa có bản PDF ký cuối cùng của hồ sơ PGD.');
    const assetResult = await pool.query(
      `SELECT bucket_name, object_path, mime_type FROM file_assets WHERE id = $1 AND source_collection = $2 AND source_document_id = $3 AND source_json_path = 'issuanceFileAssetId' LIMIT 1`,
      [certificate.issuanceFileAssetId, PGD_COLLECTIONS.certificates, certificate.id],
    );
    const asset = assetResult.rows[0];
    if (!asset) return jsonNotFound('Không tìm thấy provenance file private của bản ký cuối cùng.');
    const downloaded = await getPgdStorageClient().downloadObject({ bucketName: asset.bucket_name, objectPath: asset.object_path });
    const fileName = `PGD-${String(certificate.documentNumber || requestId).replace(/[^a-zA-Z0-9._-]+/g, '_')}-signed.pdf`;
    return new NextResponse(downloaded.body, {
      status: 200,
      headers: {
        'Content-Type': downloaded.contentType || asset.mime_type || 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
