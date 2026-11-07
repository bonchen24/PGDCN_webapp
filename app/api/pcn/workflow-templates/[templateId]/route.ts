import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  assertPcnWorkflowRequirementReferences,
  buildPcnWorkflowTemplateRecord,
  canProposePcnWorkflow,
  isPcnWorkflowManager,
  isSafePcnSampleKey,
  writePcnWorkflowActivity,
} from '@/lib/server/workflow-templates';
import { validatePcnWorkflowTemplate } from '@/utils/pcnWorkflowTemplate';
import { PcnUserAccount, PcnWorkflowTemplate } from '@/types';
import { invalidateRedisCache } from '@/lib/server/redis-cache';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ templateId: string }> }
) {
  const actor = getPcnSessionUser(req) as PcnUserAccount | null;
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  const manager = isPcnWorkflowManager(actor);
  if (!manager && !canProposePcnWorkflow(actor)) return jsonForbidden('Tài khoản chưa được cấp quyền PCN để gửi đề xuất mẫu.');

  const resolvedParams = await Promise.resolve(context.params);
  const templateId = String(resolvedParams.templateId || '').trim();
  if (!isSafePcnSampleKey(templateId)) {
    return jsonError('Mã template workflow không hợp lệ.', 400);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
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
      if ((existing.scope === 'PERSONAL' && existing.createdBy !== actor.username)
        || (!manager && existing.scope !== 'PERSONAL')) {
        throw Object.assign(new Error('Chỉ người tạo mới được sửa đề xuất riêng của mình.'), { statusCode: 403 });
      }
      if (existing.status !== 'DRAFT') {
        throw Object.assign(
          new Error('Template PUBLISHED/RETIRED bất biến; hãy tạo revision mới.'),
          { statusCode: 409 }
        );
      }
      if (body?.expectedUpdatedAt && String(body.expectedUpdatedAt) !== String(existing.updatedAt)) {
        throw Object.assign(
          new Error('Template đã được cập nhật bởi người dùng khác; hãy tải lại trước khi lưu.'),
          { statusCode: 409 }
        );
      }

      const next = buildPcnWorkflowTemplateRecord(body?.template, actor, now, existing);
      next.id = existing.id;
      next.version = existing.version;
      next.status = 'DRAFT';

      const validation = validatePcnWorkflowTemplate(next, { allowIncompleteDraft: true });
      if (!validation.valid) {
        throw Object.assign(new Error(validation.errors.join(' ')), { statusCode: 400 });
      }
      await assertPcnWorkflowRequirementReferences(client, next);
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnWorkflowTemplates' AND document_id = $1`,
        [templateId, JSON.stringify(getDocumentPayload(next))]
      );
      const activityLog = await writePcnWorkflowActivity(client, {
        action: 'CONFIGURED',
        entityId: next.id,
        entityLabel: next.name,
        summary: `Cập nhật bản nháp lưu trình ${next.name} v${next.version}.`,
        actor,
        createdAt: now,
      });
      return { template: next, activityLog };
    });
    await invalidateRedisCache('pcn', 'workflow-templates');
    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
