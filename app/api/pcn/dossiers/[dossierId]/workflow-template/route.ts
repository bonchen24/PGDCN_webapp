import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { matchPcnPublishedWorkflowTemplates, resolveWorkflowTemplateForCreate } from '@/utils/pgdcnIntakeTemplateMatching';
import { buildPcnWorkflowTaskSeed } from '@/utils/pcnWorkflowRuntime';
import { snapshotPcnWorkflowTemplate } from '@/utils/pcnWorkflowTemplate';
import type { CertificationDossier, PcnDossierWorkflowTask, PcnWorkflowTemplate } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> },
) {
  const actor = getPcnSessionUser(req);
  if (!actor) return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  if (!requirePcnMutation(actor)) return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();
  const selection = await req.json().catch(() => ({})) as { id?: string; version?: number };
  if (!dossierId) return jsonBadRequest('Mã hồ sơ không hợp lệ.');
  if (!String(selection.id || '').trim() || !Number.isInteger(selection.version)) {
    return jsonBadRequest('Cần chọn mã và phiên bản bộ hồ sơ mẫu đã publish.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId],
      );
      if (!dossierResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PCN.'), { statusCode: 404 });
      const current = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (current.workflowTemplatePending !== true || current.workflowTemplateId || current.workflowSnapshot) {
        throw Object.assign(new Error('Chỉ hồ sơ PCN mới đang chờ gắn bộ hồ sơ mẫu mới được cập nhật liên kết.'), { statusCode: 409 });
      }

      const templatesResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnWorkflowTemplates' AND data->>'status' = 'PUBLISHED'`,
      );
      const templates = templatesResult.rows.map((row: any) => mapDocumentRow(row) as PcnWorkflowTemplate);
      const candidates = matchPcnPublishedWorkflowTemplates(templates, {
        fieldCodes: current.fieldCodes,
        method: current.method,
        dossierType: current.dossierType,
      });
      const resolution = resolveWorkflowTemplateForCreate(candidates, selection);
      if (resolution.status === 'invalid-selection') {
        throw Object.assign(new Error('Bộ hồ sơ mẫu đã chọn không còn được publish hoặc không còn phù hợp với hồ sơ PCN.'), { statusCode: 409 });
      }
      if (resolution.status !== 'resolved') {
        throw Object.assign(new Error('Chưa có một bộ hồ sơ mẫu phù hợp để gắn vào hồ sơ PCN.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const workflowSnapshot = snapshotPcnWorkflowTemplate(resolution.template, {
        capturedAt: now,
        capturedBy: actor.username || 'SYSTEM',
      });
      const dossierFieldSet = new Set(current.fieldCodes.map((code) => String(code).trim().toUpperCase()));
      workflowSnapshot.nodes = workflowSnapshot.nodes.map((node) => ({
        ...node,
        requirementIds: node.requirementIds.filter((requirementId) => {
          const prefix = String(requirementId).split('-')[0].toUpperCase();
          return !['QC4', 'QC9'].includes(prefix) || dossierFieldSet.has(prefix);
        }),
      }));
      const updated: CertificationDossier = {
        ...current,
        workflowTemplateId: resolution.template.id,
        workflowTemplateVersion: resolution.template.version,
        workflowSnapshot,
        workflowTemplatePending: false,
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $2`,
        [JSON.stringify(getDocumentPayload(updated)), dossierId],
      );

      const workflowTasks = buildPcnWorkflowTaskSeed(workflowSnapshot, dossierId, actor.username || 'SYSTEM', now);
      for (const task of workflowTasks) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('pcnDossierWorkflowTasks', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [task.id, JSON.stringify(getDocumentPayload(task))],
        );
      }

      const activityLog = buildActivityLog({
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        action: 'UPDATED',
        entityType: 'PCN_DOSSIER',
        entityId: dossierId,
        entityLabel: current.dossierCode,
        summary: `Gắn bộ hồ sơ mẫu ${resolution.template.code} phiên bản ${resolution.template.version}`,
        source: 'UI',
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
      return { dossier: updated, workflowTasks: workflowTasks as PcnDossierWorkflowTask[], activityLogs: [activityLog] };
    });
    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    const message = error?.message || String(error);
    return status === 404 ? jsonNotFound(message) : status === 409 ? jsonConflict(message) : jsonBadRequest(message);
  }
}
