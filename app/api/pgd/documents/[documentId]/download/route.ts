import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { requirePgdSession } from '@/lib/server/pgd';
import { mapDocumentRow } from '@/lib/server/collections';
import { jsonNotFound, jsonServerError } from '@/lib/server/response';
import { getPgdStorageClient } from '@/lib/server/pgd-files';
import { PGD_COLLECTIONS, PgdGeneratedDocument } from '@/utils/pgdDomain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  try {
    const { documentId } = await params;
    const requestedId = decodeURIComponent(String(documentId || '')).trim();

    const documentResult = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
      [PGD_COLLECTIONS.documents, requestedId],
    );
    const metadata = documentResult.rows[0] ? (mapDocumentRow(documentResult.rows[0]) as PgdGeneratedDocument) : undefined;
    if (!metadata?.fileAssetId) {
      return jsonNotFound('Tài liệu PGD chưa có file private để tải lại.');
    }

    const assetResult = await pool.query(
      `SELECT bucket_name, object_path, mime_type FROM file_assets WHERE id = $1 AND source_collection = $2 AND source_document_id = $3 LIMIT 1`,
      [metadata.fileAssetId, PGD_COLLECTIONS.documents, requestedId],
    );
    const asset = assetResult.rows[0];
    if (!asset) {
      return jsonNotFound('Không tìm thấy metadata file private của tài liệu PGD.');
    }

    const file = await getPgdStorageClient().downloadObject({ bucketName: asset.bucket_name, objectPath: asset.object_path });
    const fileName = String(metadata.fileName || 'pgd-document').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'pgd-document';

    return new NextResponse(file.body, {
      status: 200,
      headers: {
        'Content-Type': file.contentType || asset.mime_type || metadata.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
