import { NextRequest } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { pool } from '@/lib/server/postgres';
import { requirePcnAdmin, requirePcnMutation } from '@/lib/server/auth';
import { getPcnStorageBucket, getPcnStorageClient, PCN_FILE_MAX_BYTES } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { sanitizePcnPathSegment } from '@/lib/server/pcn-files';
import { buildPcnDossierDocumentId } from '@/utils/pcnDossierDocuments';
import {
  isSafePcnSourceJsonPath,
  PCN_FILE_UPLOAD_SOURCE_COLLECTIONS,
} from '@/lib/server/pcn-files';

export async function POST(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('PCN file boundary chỉ khả dụng trong profile PCN.');
  }

  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonBadRequest('Yêu cầu phải là multipart/form-data.');
  }

  const file = formData.get('file') as File | null;
  const sourceCollection = String(formData.get('sourceCollection') || '').trim();
  const sourceDocumentId = String(formData.get('sourceDocumentId') || '').trim();
  const sourceJsonPath = String(formData.get('sourceJsonPath') || '').trim();

  if (!file) {
    return jsonBadRequest('Cần chọn tệp PCN.');
  }
  if (!PCN_FILE_UPLOAD_SOURCE_COLLECTIONS.has(sourceCollection)) {
    return jsonBadRequest('Nguồn tệp PCN không hợp lệ.');
  }
  if (sourceCollection === 'pcnQualityDocuments') {
    const adminError = requirePcnAdmin(req);
    if (adminError) return adminError;
  }
  if (!sourceDocumentId || sourceDocumentId.length > 200 || /[\\/]/.test(sourceDocumentId)) {
    return jsonBadRequest('Thiếu hoặc sai mã hồ sơ nguồn của tệp PCN.');
  }
  if (!isSafePcnSourceJsonPath(sourceJsonPath)) {
    return jsonBadRequest('Đường dẫn metadata nguồn của tệp PCN không hợp lệ.');
  }

  const mimeType = String(file.type || 'application/octet-stream').toLowerCase();
  if (
    mimeType !== 'application/pdf' &&
    mimeType !== 'application/octet-stream' &&
    mimeType !== 'application/msword' &&
    mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    mimeType !== 'application/vnd.ms-excel' &&
    mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' &&
    !mimeType.startsWith('image/')
  ) {
    return jsonError('Loại tệp PCN chưa được cho phép.', 415);
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  try {
    const source = await pool.query(
      'SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1',
      [sourceCollection, sourceDocumentId],
    );
    if (source.rows.length === 0) {
      return jsonNotFound('Không tìm thấy hồ sơ nguồn của tệp PCN.');
    }
    const sourceData = source.rows[0]?.data || {};
    if (sourceCollection === 'dossierDocuments') {
      if (
        String(sourceData.requirementId || '').trim() !== sourceJsonPath ||
        buildPcnDossierDocumentId(String(sourceData.dossierId || '').trim(), sourceJsonPath) !== sourceDocumentId
      ) {
        return jsonBadRequest('Provenance checklist của tệp PCN không khớp.');
      }
    } else if (sourceJsonPath !== 'fileAssetId') {
      return jsonBadRequest('Đường dẫn metadata nguồn của tệp PCN không khớp loại tài liệu.');
    }

    const storage = getPcnStorageClient();
    const bucketName = getPcnStorageBucket();
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
    const assetId = `pcn-file-${sha256.slice(0, 16)}-${randomUUID().slice(0, 8)}`;
    const originalName = sanitizePcnPathSegment(String(file.name || 'pcn-file'));
    const objectPath = `pcnFiles/${sanitizePcnPathSegment(sourceCollection)}/${sanitizePcnPathSegment(sourceDocumentId)}/${sanitizePcnPathSegment(sourceJsonPath)}/${assetId}-${sha256}-${originalName}`;

    await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);
    await storage.uploadObject({ bucketName, objectPath, body: fileBuffer, mimeType });
    try {
      await pool.query(
        'INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [assetId, bucketName, objectPath, sourceCollection, sourceDocumentId, sourceJsonPath, mimeType, fileBuffer.length, sha256],
      );
    } catch (error) {
      await storage.deleteObject({ bucketName, objectPath }).catch(() => undefined);
      throw error;
    }

    return jsonOk(
      {
        asset: {
          id: assetId,
          bucketName,
          objectPath,
          sourceCollection,
          sourceDocumentId,
          sourceJsonPath,
          mimeType,
          byteSize: fileBuffer.length,
          sha256,
          originalName: String(file.name || 'pcn-file').slice(0, 255),
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('PCN file upload error:', error);
    const message = String(error?.message || error);
    const status = message.includes('storage is not configured') ? 503 : 500;
    return jsonError(message, status);
  }
}
