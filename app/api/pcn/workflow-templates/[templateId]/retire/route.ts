import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  isPcnWorkflowManager,
  isSafePcnSampleKey,
  writePcnWorkflowActivity,
} from '@/lib/server/workflow-templates';
import { PcnUserAccount, PcnWorkflowTemplate } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const actor = getPcnSessionUser(req) as PcnUserAccount | null;
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!isPcnWorkflowManager(actor)) {
    return jsonForbidden('Chỉ Admin hoặc Quản lý PCN được thay đổi bộ hồ sơ mẫu.');
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
    return jsonError('Ngừng lưu trình phải có mã và lý do tối đa 1000 ký tự.', 400);
  }

  const now = new Date().toISOString();
  try {
    const result = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnWorkflowTemplates' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [templateId]
      );
      if (!existingResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy template workflow.'), { statusCode: 404 });
      }
      const existing = mapDocumentRow(existingResult.rows[0]) as PcnWorkflowTemplate;
      const next = {
        ...existing,
        status: 'RETIRED' as const,
        updatedAt: now,
        updatedBy: actor.username,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnWorkflowTemplates' AND document_id = $1`,
        [templateId, JSON.stringify(getDocumentPayload(next))]
      );
      const activityLog = await writePcnWorkflowActivity(client, {
        action: 'CONFIGURED',
        entityId: templateId,
        entityLabel: next.name,
        summary: `Ngừng lưu trình ${next.name}: ${reason}`,
        actor,
        createdAt: now,
      });
      return { template: next, activityLog };
    });
    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
