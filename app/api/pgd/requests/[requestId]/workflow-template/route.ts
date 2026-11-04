import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonNotFound, jsonOk } from '@/lib/server/response';
import { writePgdActivity } from '@/lib/server/pgd-operations';
import { PGD_COLLECTIONS, type PgdInspectionRequest } from '@/utils/pgdDomain';
import { matchPgdPublishedWorkflowTemplates, resolveWorkflowTemplateForCreate } from '@/utils/pgdcnIntakeTemplateMatching';
import { snapshotPgdWorkflowTemplate, type PgdWorkflowTemplate } from '@/utils/pgdWorkflowTemplate';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.requests, 'write');
  if (mutationError) return mutationError;
  const actor = getPgdSessionUser(req)!;
  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();
  const selection = await req.json().catch(() => ({})) as { id?: string; version?: number };

  if (!requestId) return jsonBadRequest('Mã PYC không hợp lệ.');
  if (!String(selection.id || '').trim() || !Number.isInteger(selection.version)) {
    return jsonBadRequest('Cần chọn mã và phiên bản bộ hồ sơ mẫu đã publish.');
  }

  try {
    const request = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd'
         LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy PYC PGD.'), { statusCode: 404 });
      const current = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      if (current.workflowTemplatePending !== true || current.workflowTemplateId || current.workflowSnapshot) {
        throw Object.assign(new Error('Chỉ PYC mới đang chờ gắn bộ hồ sơ mẫu mới được cập nhật liên kết.'), { statusCode: 409 });
      }

      const templatesResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = $1 AND data->>'domain' = 'pgd' AND data->>'status' = 'PUBLISHED'`,
        [PGD_COLLECTIONS.workflowTemplates],
      );
      const templates = templatesResult.rows.map((row: any) => mapDocumentRow(row) as PgdWorkflowTemplate);
      const candidates = matchPgdPublishedWorkflowTemplates(templates, {
        productGroups: [current.productGroup],
        methodCode: current.method || undefined,
      });
      const resolution = resolveWorkflowTemplateForCreate(candidates, selection);
      if (resolution.status === 'invalid-selection') {
        throw Object.assign(new Error('Bộ hồ sơ mẫu đã chọn không còn được publish hoặc không còn phù hợp với PYC.'), { statusCode: 409 });
      }
      if (resolution.status !== 'resolved') {
        throw Object.assign(new Error('Chưa có một bộ hồ sơ mẫu phù hợp để gắn vào PYC.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const updated: PgdInspectionRequest = {
        ...current,
        workflowTemplateId: resolution.template.id,
        workflowTemplateVersion: resolution.template.version,
        workflowSnapshot: snapshotPgdWorkflowTemplate(resolution.template, {
          capturedAt: now,
          capturedBy: actor.username || 'SYSTEM',
        }),
        workflowTemplatePending: false,
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(updated)), requestId],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityType: 'PGD_REQUEST',
        entityId: updated.id,
        entityLabel: updated.requestCode,
        summary: `Gắn bộ hồ sơ mẫu ${resolution.template.code} phiên bản ${resolution.template.version}`,
      });
      return updated;
    });
    return jsonOk({ request });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    const message = error?.message || String(error);
    return status === 404 ? jsonNotFound(message) : status === 409 ? jsonConflict(message) : jsonBadRequest(message);
  }
}
