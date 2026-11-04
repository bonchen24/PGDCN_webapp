import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  PGD_COLLECTIONS,
  assertPgdWorkflowRequirementReferences,
  buildPgdWorkflowTemplateRecord,
  isPgdWorkflowManager,
  isSafePcnSampleKey,
  writePgdActivity,
} from '@/lib/server/workflow-templates';
import { validatePgdWorkflowTemplate, PgdWorkflowTemplate } from '@/utils/pgdWorkflowTemplate';
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
  if (!isSafePcnSampleKey(templateId)) {
    return jsonError('Mã template workflow PGD không hợp lệ.', 400);
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
         WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd'
         LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.workflowTemplates, templateId]
      );
      if (!existingResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy template workflow PGD gốc.'), { statusCode: 404 });
      }
      const existing = mapDocumentRow(existingResult.rows[0]) as PgdWorkflowTemplate;
      const revision = buildPgdWorkflowTemplateRecord(body?.template, actor, now, existing);
      revision.id = `${existing.id}-v${existing.version + 1}`;
      revision.version = existing.version + 1;
      revision.status = 'DRAFT';
      delete (revision as any).publishedAt;
      delete (revision as any).publishedBy;
      if (!isSafePcnSampleKey(revision.id)) {
        throw Object.assign(new Error('Mã revision workflow PGD không hợp lệ.'), { statusCode: 400 });
      }

      const validation = validatePgdWorkflowTemplate(revision);
      if (!validation.valid) {
        throw Object.assign(new Error(validation.errors.join(' ')), { statusCode: 400 });
      }
      await assertPgdWorkflowRequirementReferences(client, revision);
      const write = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING
         RETURNING document_id, data`,
        [PGD_COLLECTIONS.workflowTemplates, revision.id, JSON.stringify(getDocumentPayload(revision))]
      );
      if (!write.rows[0]) {
        throw Object.assign(
          new Error('Revision workflow PGD vừa được tạo bởi thao tác khác.'),
          { statusCode: 409 }
        );
      }
      const activityLog = await writePgdActivity(client, actor, {
        action: 'CONFIGURED',
        entityId: revision.id,
        entityLabel: revision.name,
        summary: `Tạo revision lưu trình PGD ${revision.name} v${revision.version}.`,
        idSuffix: `workflow-template-revision-${revision.id}`,
      });
      return { template: mapDocumentRow(write.rows[0]) as PgdWorkflowTemplate, activityLog };
    });
    return jsonCreated(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
