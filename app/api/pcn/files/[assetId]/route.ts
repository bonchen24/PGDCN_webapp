import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/postgres';
import { requirePcnSession } from '@/lib/server/auth';
import { getPcnStorageClient } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonNotFound } from '@/lib/server/response';
import { DATABASE_PROFILE } from '@/lib/server/env';
import {
  buildPcnFileContentDisposition,
  PCN_FILE_ASSET_ID_PATTERN,
  PCN_FILE_SOURCE_COLLECTIONS,
} from '@/lib/server/pcn-files';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('PCN file boundary chỉ khả dụng trong profile PCN.');
  }

  const sessionError = requirePcnSession(req);
  if (sessionError) return sessionError;

  const { assetId: rawAssetId } = await params;
  const assetId = String(rawAssetId || '').trim();

  if (!PCN_FILE_ASSET_ID_PATTERN.test(assetId)) {
    return jsonBadRequest('Mã file asset PCN không hợp lệ.');
  }

  try {
    const result = await pool.query(
      'SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256 FROM file_assets WHERE id = $1',
      [assetId],
    );
    const asset = result.rows[0];
    if (!asset || !PCN_FILE_SOURCE_COLLECTIONS.has(String(asset.source_collection))) {
      return jsonNotFound('Không tìm thấy file asset PCN.');
    }

    const storage = getPcnStorageClient();
    const downloaded = await storage.downloadObject({ bucketName: asset.bucket_name, objectPath: asset.object_path });
    const fileName = String(asset.object_path).split('/').pop() || 'pcn-file';

    const { searchParams } = new URL(req.url);
    const isAttachment = String(searchParams.get('download') || '') === '1';

    return new NextResponse(downloaded.body, {
      status: 200,
      headers: {
        'Content-Type': asset.mime_type || downloaded.contentType || 'application/octet-stream',
        'Content-Length': String(downloaded.body.byteLength),
        'Content-Disposition': buildPcnFileContentDisposition(fileName, isAttachment ? 'attachment' : 'inline'),
      },
    });
  } catch (error: any) {
    console.error('PCN file download error:', error);
    const message = String(error?.message || error);
    const status = message.includes('storage is not configured') ? 503 : 500;
    return jsonError(message, status);
  }
}
