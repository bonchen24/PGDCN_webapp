import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  assertPcnWorkflowRequirementReferences,
  buildPcnWorkflowTemplateRecord,
  isPcnWorkflowManager,
  isSafePcnSampleKey,
  writePcnWorkflowActivity,
} from '@/lib/server/workflow-templates';
import { validatePcnWorkflowTemplate } from '@/utils/pcnWorkflowTemplate';
import { PcnUserAccount, PcnWorkflowTemplate } from '@/types';
import { invalidateRedisCache } from '@/lib/server/redis-cache';

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
        throw Object.assign(new Error('Không tìm thấy template workflow gốc.'), { statusCode: 404 });
      }
      const existing = mapDocumentRow(existingResult.rows[0]) as PcnWorkflowTemplate;
      if (existing.scope === 'PERSONAL') throw Object.assign(new Error('Đề xuất cá nhân không có revision dùng chung.'), { statusCode: 409 });
      const revision = buildPcnWorkflowTemplateRecord(body?.template, actor, now, existing);
      revision.id = `${existing.id}-v${existing.version + 1}`;
      revision.version = existing.version + 1;
      revision.status = 'DRAFT';
      revision.publishedAt = undefined;
      revision.publishedBy = undefined;
      if (!isSafePcnSampleKey(revision.id)) {
        throw Object.assign(new Error('Mã revision workflow không hợp lệ.'), { statusCode: 400 });
      }

      const validation = validatePcnWorkflowTemplate(revision, { allowIncompleteDraft: true });
      if (!validation.valid) {
        throw Object.assign(new Error(validation.errors.join(' ')), { statusCode: 400 });
      }
      await assertPcnWorkflowRequirementReferences(client, revision);
      const write = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnWorkflowTemplates', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING
         RETURNING document_id, data`,
        [revision.id, JSON.stringify(getDocumentPayload(revision))]
      );
      if (!write.rows[0]) {
        throw Object.assign(
          new Error('Revision workflow vừa được tạo bởi thao tác khác.'),
          { statusCode: 409 }
        );
      }
      const activityLog = await writePcnWorkflowActivity(client, {
        action: 'CONFIGURED',
        entityId: revision.id,
        entityLabel: revision.name,
        summary: `Tạo revision lưu trình ${revision.name} v${revision.version}.`,
        actor,
        createdAt: now,
      });
      return { template: mapDocumentRow(write.rows[0]) as PcnWorkflowTemplate, activityLog };
    });
    await invalidateRedisCache('pcn', 'workflow-templates');
    return jsonCreated(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
