import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnAdmin } from '@/lib/server/auth';
import { getPcnStorageBucket, getPcnStorageClient, PCN_FILE_MAX_BYTES } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/collections';
import { PcnTemplateDefinition } from '@/types';
import { sanitizePcnPathSegment, PCN_FILE_ASSET_ID_PATTERN, stablePcnMutationId } from '@/lib/server/pcn-files';
import { inspectPcnTemplateSource } from '@/utils/pcnTemplateDiscovery';
import { replacePcnTemplateFileDefinition } from '@/utils/pcnTemplateImport';
import { toPcnTemplateRuntimeProjection } from '@/utils/pcnTemplateCatalog';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const adminError = requirePcnAdmin(req);
  if (adminError) return adminError;

  const { templateId: rawTemplateId } = await params;
  const templateId = decodeURIComponent(String(rawTemplateId || '')).trim();
  if (!templateId || templateId.length > 200 || /[\\/]/.test(templateId)) {
    return jsonBadRequest('Mã template PCN không hợp lệ.');
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonBadRequest('Yêu cầu phải là multipart/form-data.');
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return jsonBadRequest('Cần chọn file DOCX mới cho template PCN.');
  }

  const fileName = String(file.name || '').trim();
  const mimeType = String(file.type || 'application/octet-stream').toLowerCase();
  if (
    !fileName.toLowerCase().endsWith('.docx') ||
    !['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'].includes(mimeType)
  ) {
    return jsonError('Template PCN phải là file DOCX hợp lệ.', 415);
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];

  try {
    const actor = getPcnSessionUser(req)!;
    const storage = getPcnStorageClient();
    const bucketName = getPcnStorageBucket();
    await storage.ensurePrivateBucket(bucketName, PCN_FILE_MAX_BYTES);
    const sha256 = createHash('sha256').update(fileBuffer).digest('hex');

    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-template-upload:${templateId}`]);
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnTemplateDefinitions' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [templateId],
      );
      if (existingResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy template PCN cần thay file.'), { statusCode: 404 });
      }
      const current = { ...(existingResult.rows[0].data || {}), id: existingResult.rows[0].document_id } as PcnTemplateDefinition;
      if (current.format !== 'DOCX') {
        throw Object.assign(new Error('Chỉ template DOCX mới được thay file từ trang quản lý.'), { statusCode: 409 });
      }

      const inspection = inspectPcnTemplateSource({
        fileName: 'template.docx',
        sourceRelativePath: 'template.docx',
        bytes: fileBuffer,
      });
      if (inspection.warnings.includes('DOCX_NOT_READABLE')) {
        throw Object.assign(new Error('File DOCX không đọc được hoặc bị hỏng.'), { statusCode: 400 });
      }

      const currentAssetId = String(current.fileAssetId || '').trim();
      const assetId = PCN_FILE_ASSET_ID_PATTERN.test(currentAssetId)
        ? currentAssetId
        : `pcn-template-${templateId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || sha256.slice(0, 32)}`;
      const safeFileName = sanitizePcnPathSegment(fileName);
      const objectPath = `pcnTemplates/${sanitizePcnPathSegment(current.fieldCode)}/${sanitizePcnPathSegment(current.id)}/${sha256}/${safeFileName}`;

      const previousAssetResult = currentAssetId
        ? await client.query('SELECT object_path FROM file_assets WHERE id = $1 LIMIT 1', [currentAssetId])
        : { rows: [] };
      const previousObjectPath = previousAssetResult.rows[0]?.object_path ? String(previousAssetResult.rows[0].object_path) : undefined;

      await storage.uploadObject({ bucketName, objectPath, body: fileBuffer, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      if (previousObjectPath !== objectPath) uploadedObjects.push({ bucketName, objectPath });

      const now = new Date().toISOString();
      const next = replacePcnTemplateFileDefinition(current, {
        assetId,
        byteSize: fileBuffer.length,
        sha256,
        placeholderKeys: inspection.placeholderKeys,
        importedByUsername: actor.username,
        importedAt: now,
      });

      await client.query(
        `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
         VALUES ($1, $2, $3, 'pcnTemplateDefinitions', $4, 'fileAssetId', $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET bucket_name = EXCLUDED.bucket_name, object_path = EXCLUDED.object_path,
           source_collection = EXCLUDED.source_collection, source_document_id = EXCLUDED.source_document_id,
           source_json_path = EXCLUDED.source_json_path, mime_type = EXCLUDED.mime_type,
           byte_size = EXCLUDED.byte_size, sha256 = EXCLUDED.sha256, updated_at = CURRENT_TIMESTAMP`,
        [assetId, bucketName, objectPath, templateId, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileBuffer.length, sha256],
      );

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnTemplateDefinitions' AND document_id = $1`,
        [templateId, JSON.stringify(getDocumentPayload(next))],
      );

      const activityLog = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-template-upload', `${templateId}:${sha256}`),
        action: 'UPDATED',
        entityType: 'PCN_TEMPLATE',
        entityId: templateId,
        entityLabel: current.displayName,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: `Thay file template DOCX ${current.displayName}`,
        source: 'UI',
        changes: diffActivityFields(current, next, ['fileAssetId', 'sourceFingerprint', 'placeholderKeys', 'status', 'approvedAt', 'approvedByUsername', 'importedByUsername', 'importedAt', 'annotation', 'sourceOriginalFingerprint']),
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))],
      );

      return {
        template: { ...toPcnTemplateRuntimeProjection(next), privateAssetVerified: true },
        asset: {
          id: assetId,
          bucketName,
          objectPath,
          sourceCollection: 'pcnTemplateDefinitions',
          sourceDocumentId: templateId,
          sourceJsonPath: 'fileAssetId',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          byteSize: fileBuffer.length,
          sha256,
          originalName: fileName.slice(0, 255),
          createdAt: now,
        },
        activityLog,
        previousObjectPath,
      };
    });

    if (result.previousObjectPath && result.previousObjectPath !== result.asset.objectPath) {
      await storage.deleteObject({ bucketName, objectPath: result.previousObjectPath }).catch(() => undefined);
    }
    return jsonOk({ template: result.template, asset: result.asset, activityLog: result.activityLog });
  } catch (error: any) {
    for (const uploaded of uploadedObjects.reverse()) {
      await getPcnStorageClient().deleteObject(uploaded).catch(() => undefined);
    }
    console.error('PCN template file replacement error:', error);
    const message = String(error?.message || error);
    return jsonError(message, Number(error?.statusCode) || (message.includes('storage is not configured') ? 503 : 500));
  }
}
