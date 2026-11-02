import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  PGD_COLLECTIONS,
  isPgdWorkflowManager,
  isSafePcnSampleKey,
  writePgdActivity,
} from '@/lib/server/workflow-templates';
import { PgdWorkflowTemplate } from '@/utils/pgdWorkflowTemplate';
import { PcnUserAccount } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const actor = getPcnSessionUser(req) as PcnUserAccount | null;
  if (!actor) {
    return jsonUnauthorized('Phiên PGD không hợp lệ hoặc đã hết hạn.');
  }
  if (!isPgdWorkflowManager(actor)) {
    return jsonForbidden('Chỉ Admin hoặc Quản lý PGD được thay đổi bộ hồ sơ mẫu.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const templateId = String(resolvedParams.templateId || '').trim();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const reason = String(body?.reason || '').trim();
  if (!isSafePcnSampleKey(templateId) || !reason || reason.length > 1000) {
    return jsonError('Ngừng lưu trình PGD phải có mã và lý do tối đa 1000 ký tự.', 400);
  }

  const now = new Date().toISOString();
  try {
    const result = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd'
         LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.workflowTemplates, templateId]
      );
      if (!existingResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy template workflow PGD.'), { statusCode: 404 });
      }
      const existing = mapDocumentRow(existingResult.rows[0]) as PgdWorkflowTemplate;
      if (existing.scope === 'PERSONAL') throw Object.assign(new Error('Đề xuất cá nhân không thể ngừng áp dụng như mẫu dùng chung.'), { statusCode: 409 });
      const next = {
        ...existing,
        status: 'RETIRED' as const,
        updatedAt: now,
        updatedBy: actor.username,
      };
      await client.query(
        `UPDATE app_documents SET data = $3::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = $1 AND document_id = $2`,
        [PGD_COLLECTIONS.workflowTemplates, templateId, JSON.stringify(getDocumentPayload(next))]
      );
      const activityLog = await writePgdActivity(client, actor, {
        action: 'CONFIGURED',
        entityId: templateId,
        entityLabel: next.name,
        summary: `Ngừng lưu trình PGD ${next.name}: ${reason}`,
        idSuffix: `workflow-template-retire-${templateId}`,
      });
      return { template: next, activityLog };
    });
    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
