import { NextRequest } from 'next/server';
import { pool, withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  PGD_COLLECTIONS,
  assertPgdWorkflowRequirementReferences,
  buildPgdWorkflowTemplateRecord,
  canProposePgdWorkflow,
  isPgdWorkflowManager,
  isSafePcnSampleKey,
  writePgdActivity,
} from '@/lib/server/workflow-templates';
import { validatePgdWorkflowTemplate, PgdWorkflowTemplate } from '@/utils/pgdWorkflowTemplate';
import { PcnUserAccount } from '@/types';
import { invalidateRedisCache, readThroughRedisCache } from '@/lib/server/redis-cache';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PGD không hợp lệ hoặc đã hết hạn.');
  }

  try {
    if (!isPgdWorkflowManager(actor) && !canProposePgdWorkflow(actor)) return jsonForbidden('Tài khoản chưa được cấp quyền PGD để gửi đề xuất mẫu.');
    const manager = isPgdWorkflowManager(actor);
    const canPropose = canProposePgdWorkflow(actor);
    const items = await readThroughRedisCache({
      app: 'pgd',
      resource: 'workflow-templates',
      ttlSeconds: 15,
      scope: {
        username: actor.username,
        systemRole: actor.systemRole ?? null,
        managementRoleCode: actor.managementRoleCode ?? null,
        professionalRoleCodes: [...(actor.professionalRoleCodes || [])].sort(),
        departmentScopes: [...(actor.departmentScopes || [])].sort(),
        pgdRole: actor.pgdRole ?? null,
        manager: manager,
        canPropose: canPropose,
      },
      loader: async () => {
        const result = await pool.query(manager
          ? `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' ORDER BY COALESCE(data->>'code', ''), COALESCE((data->>'version')::int, 0) DESC, document_id`
          : `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd'
              AND ((COALESCE(data->>'scope', 'COMMON') = 'COMMON' AND data->>'status' = 'PUBLISHED')
                OR (data->>'scope' = 'PERSONAL' AND data->>'status' = 'DRAFT' AND data->>'createdBy' = $2))
              ORDER BY COALESCE(data->>'code', ''), COALESCE((data->>'version')::int, 0) DESC, document_id`,
          manager ? [PGD_COLLECTIONS.workflowTemplates] : [PGD_COLLECTIONS.workflowTemplates, actor.username]);
        return result.rows.map(mapDocumentRow);
      },
    });
    return jsonOk({ items });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req) as PcnUserAccount | null;
  if (!actor) {
    return jsonUnauthorized('Phiên PGD không hợp lệ hoặc đã hết hạn.');
  }
  const manager = isPgdWorkflowManager(actor);
  if (!manager && !canProposePgdWorkflow(actor)) return jsonForbidden('Tài khoản chưa được cấp quyền PGD để gửi đề xuất mẫu.');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const now = new Date().toISOString();
  const template = buildPgdWorkflowTemplateRecord(body?.template, actor, now);
  template.scope = manager ? 'COMMON' : 'PERSONAL';
  if (!isSafePcnSampleKey(template.id) || !template.code || !template.name || template.status !== 'DRAFT') {
    return jsonError('Template workflow PGD mới phải có id, mã, tên và bắt đầu ở trạng thái DRAFT.', 400);
  }

  const validation = validatePgdWorkflowTemplate(template, { allowIncompleteDraft: true });
  if (!validation.valid) {
    return jsonError(validation.errors.join(' '), 400, { issues: validation.errors });
  }

  try {
    const result = await withPgTransaction(async (client) => {
      await assertPgdWorkflowRequirementReferences(client, template);
      const write = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING
         RETURNING document_id, data`,
        [PGD_COLLECTIONS.workflowTemplates, template.id, JSON.stringify(getDocumentPayload(template))]
      );
      if (!write.rows.length) {
        throw Object.assign(new Error('Mã template workflow PGD đã tồn tại.'), { statusCode: 409 });
      }
      const activityLog = await writePgdActivity(client, actor, {
        action: 'CONFIGURED',
        entityId: template.id,
        entityLabel: template.name,
        summary: `Tạo bản nháp lưu trình PGD ${template.name} v${template.version}.`,
        idSuffix: `workflow-template-create-${template.id}`,
      });
      return { template: mapDocumentRow(write.rows[0]) as PgdWorkflowTemplate, activityLog };
    });
    await invalidateRedisCache('pgd', 'workflow-templates');
    return jsonCreated(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
