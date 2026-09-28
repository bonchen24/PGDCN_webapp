import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnAdmin } from '@/lib/server/auth';
import { getPcnStorageBucket } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { mapDocumentRow, getDocumentPayload } from '@/lib/server/collections';
import { PcnTemplateDefinition, PcnTemplateReviewAction } from '@/types';
import {
  getPcnTemplateReadiness,
  toPcnTemplateRuntimeProjection,
} from '@/utils/pcnTemplateCatalog';
import { reviewPcnTemplateDefinition } from '@/utils/pcnTemplateReview';
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

  const bodyJson = await req.json().catch(() => ({}));
  const action = String(bodyJson?.action || '').trim().toUpperCase() as PcnTemplateReviewAction;
  const reason = String(bodyJson?.reason || '').trim().slice(0, 500);

  if (!templateId || !['APPROVE', 'REQUEST_ANNOTATION', 'RETIRE'].includes(action)) {
    return jsonBadRequest('Thiếu mã template hoặc thao tác review không hợp lệ.');
  }

  if (action === 'REQUEST_ANNOTATION' && !reason) {
    return jsonBadRequest('Yêu cầu chỉnh sửa template phải có lý do.');
  }

  try {
    const actor = getPcnSessionUser(req)!;
    const result = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnTemplateDefinitions' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [templateId],
      );
      if (existingResult.rows.length === 0) throw new Error('Không tìm thấy template PCN đã import để review.');
      const existing = { ...(existingResult.rows[0].data || {}), id: existingResult.rows[0].document_id } as PcnTemplateDefinition;
      const runtimeExisting = toPcnTemplateRuntimeProjection(existing);

      if (action === 'APPROVE') {
        const approvalProbe = { ...runtimeExisting, status: 'APPROVED' as const };
        const readiness = getPcnTemplateReadiness(approvalProbe, { availablePlaceholderKeys: existing.placeholderKeys });
        if (!readiness.ready) throw new Error(`Template chưa đủ điều kiện phê duyệt: ${readiness.reasons.join(', ')}.`);

        const assetResult = await client.query(
          `SELECT id, bucket_name, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256
           FROM file_assets WHERE id = $1 LIMIT 1`,
          [existing.fileAssetId],
        );
        const asset = assetResult.rows[0];
        const expectedMimeType = existing.format === 'DOC'
          ? 'application/msword'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const expectedByteSize = Number(runtimeExisting.sourceFingerprint?.byteSize);

        if (!asset
          || String(asset.bucket_name) !== getPcnStorageBucket()
          || asset.source_collection !== 'pcnTemplateDefinitions'
          || asset.source_document_id !== existing.id
          || asset.source_json_path !== 'fileAssetId'
          || asset.mime_type !== expectedMimeType
          || (Number.isFinite(expectedByteSize) && expectedByteSize > 0 && Number(asset.byte_size) !== expectedByteSize)
          || String(asset.sha256 || '').toLowerCase() !== String(runtimeExisting.sourceFingerprint.sha256 || '').toLowerCase()) {
          throw new Error('Asset private của template chưa tồn tại hoặc không khớp fingerprint.');
        }
      }

      const next = reviewPcnTemplateDefinition(runtimeExisting, action, { now: new Date().toISOString(), approverUsername: actor.username });
      const changes = diffActivityFields(runtimeExisting, next, ['status', 'approvedAt', 'approvedByUsername']);
      if (changes.length === 0) return { template: runtimeExisting, activityLog: undefined };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnTemplateDefinitions' AND document_id = $1`,
        [existing.id, JSON.stringify(getDocumentPayload(next))],
      );

      const log = buildActivityLog({
        action: 'CONFIGURED',
        entityType: 'PCN_TEMPLATE',
        entityId: next.id,
        entityLabel: next.displayName,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: `${action === 'APPROVE' ? 'Phê duyệt' : action === 'RETIRE' ? 'Ngừng sử dụng' : 'Yêu cầu chú thích'} template ${next.displayName}${reason ? `: ${reason}` : ''}`,
        changes,
        source: 'UI',
      });
      const validationError = validateActivityLogPayload(log);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [log.id, JSON.stringify(getDocumentPayload(log))],
      );

      return { template: next, activityLog: log };
    });

    return jsonOk({ ...result, template: toPcnTemplateRuntimeProjection(result.template) });
  } catch (error: any) {
    console.error('PCN template review error:', error);
    const message = String(error?.message || error);
    const normalizedMessage = message.toLowerCase();
    const status = normalizedMessage.includes('không tìm thấy') ? 404 : 409;
    return jsonError(message, status);
  }
}
