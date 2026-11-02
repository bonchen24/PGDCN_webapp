import { NextRequest } from 'next/server';
import { pool, withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
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

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }

  try {
    const manager = isPcnWorkflowManager(actor);
    const canPropose = canProposePcnWorkflow(actor);
    const canViewPcn = (actor.departmentScopes || []).includes('PCN');
    if (!manager && !canViewPcn) return jsonForbidden('Tài khoản chưa được cấp phạm vi PCN để xem bộ hồ sơ mẫu.');
    const result = await pool.query(manager
      ? `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnWorkflowTemplates' ORDER BY COALESCE(data->>'code', ''), COALESCE((data->>'version')::int, 0) DESC, document_id`
      : canPropose
        ? `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnWorkflowTemplates'
          AND ((COALESCE(data->>'scope', 'COMMON') = 'COMMON' AND data->>'status' = 'PUBLISHED')
            OR (data->>'scope' = 'PERSONAL' AND data->>'status' = 'DRAFT' AND data->>'createdBy' = $1))
          ORDER BY COALESCE(data->>'code', ''), COALESCE((data->>'version')::int, 0) DESC, document_id`
        : `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnWorkflowTemplates'
          AND COALESCE(data->>'scope', 'COMMON') = 'COMMON' AND data->>'status' = 'PUBLISHED'
          ORDER BY COALESCE(data->>'code', ''), COALESCE((data->>'version')::int, 0) DESC, document_id`,
      !manager && canPropose ? [actor.username] : []);
    return jsonOk({ items: result.rows.map(mapDocumentRow) });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req) as PcnUserAccount | null;
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  const manager = isPcnWorkflowManager(actor);
  if (!manager && !canProposePcnWorkflow(actor)) return jsonForbidden('Tài khoản chưa được cấp quyền PCN để gửi đề xuất mẫu.');

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const now = new Date().toISOString();
  const template = buildPcnWorkflowTemplateRecord(body?.template, actor, now);
  template.scope = manager ? 'COMMON' : 'PERSONAL';
  if (!isSafePcnSampleKey(template.id) || !template.code || !template.name || template.status !== 'DRAFT') {
    return jsonError('Template workflow mới phải có id, mã, tên và bắt đầu ở trạng thái DRAFT.', 400);
  }

  const validation = validatePcnWorkflowTemplate(template, { allowIncompleteDraft: true });
  if (!validation.valid) {
    return jsonError(validation.errors.join(' '), 400, { issues: validation.errors });
  }

  try {
    const result = await withPgTransaction(async (client) => {
      await assertPcnWorkflowRequirementReferences(client, template);
      const write = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnWorkflowTemplates', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING
         RETURNING document_id, data`,
        [template.id, JSON.stringify(getDocumentPayload(template))],
      );
      if (write.rows.length === 0) {
        throw Object.assign(new Error('Mã template workflow đã tồn tại.'), { statusCode: 409 });
      }
      const activityLog = await writePcnWorkflowActivity(client, {
        action: 'CONFIGURED',
        entityId: template.id,
        entityLabel: template.name,
        summary: `Tạo bản nháp lưu trình ${template.name} v${template.version}.`,
        actor,
        createdAt: now,
      });
      return { template: mapDocumentRow(write.rows[0]) as PcnWorkflowTemplate, activityLog };
    });
    return jsonCreated(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
