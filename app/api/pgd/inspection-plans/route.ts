import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { jsonBadRequest, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { PGD_COLLECTIONS } from '@/utils/pgdDomain';
import {
  PgdInspectionPlan,
  createPgdInspectionPlan,
} from '@/utils/pgdArtifacts';
import { getPgdArtifactRequest, persistPgdArtifact, writePgdActivity } from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';
import type { PgdInspectionAssignment } from '@/utils/pgdDomain';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.inspectionPlans, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const input = (await req.json().catch(() => ({}))) as PgdInspectionPlan;
  if (!input?.id || (input.domain && input.domain !== 'pgd') || !input.requestId) {
    return jsonBadRequest('Kế hoạch PGD thiếu id, miền hoặc mã hồ sơ.');
  }

  try {
    const plan = await withPgTransaction(async (client) => {
      const request = await getPgdArtifactRequest(client, input.requestId, 'PREPARATION');
      const action = String((input as PgdInspectionPlan & { action?: string }).action || '').trim().toUpperCase();
      if (action === 'ACCEPT' || action === 'RETURN') {
        if (request.workflowSchemaVersion !== 2 && request.workflowSnapshot?.workflowSchemaVersion !== 2) {
          throw Object.assign(new Error('Xác nhận lịch chỉ áp dụng cho hồ sơ workflow v2.'), { statusCode: 409 });
        }
        const planResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'requestId' = $3 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
          [PGD_COLLECTIONS.inspectionPlans, input.id, request.id],
        );
        if (!planResult.rows[0]) throw Object.assign(new Error('Không tìm thấy lịch PGD cần xác nhận.'), { statusCode: 404 });
        const existing = mapDocumentRow(planResult.rows[0]) as PgdInspectionPlan;
        const assignmentResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`,
          [PGD_COLLECTIONS.assignments, request.id],
        );
        const assignment = assignmentResult.rows[0] ? mapDocumentRow(assignmentResult.rows[0]) as PgdInspectionAssignment : undefined;
        const leadUsername = String(assignment?.leadInspectorUsername || existing.team.find((member) => member.role === 'LEAD')?.username || '').trim().toLowerCase();
        if (!leadUsername || leadUsername !== String(actor.username || '').trim().toLowerCase()) {
          throw Object.assign(new Error('Chỉ trưởng đoàn được phân công mới có thể chấp nhận hoặc trả lịch.'), { statusCode: 403 });
        }
        const reason = String((input as PgdInspectionPlan & { reason?: string }).reason || '').trim();
        if (action === 'RETURN' && !reason) throw Object.assign(new Error('Cần ghi lý do trả lịch cho phòng.'), { statusCode: 400 });
        const next = {
          ...existing,
          acceptance: { status: action === 'ACCEPT' ? 'ACCEPTED' as const : 'RETURNED' as const, actedByUsername: actor.username, actedAt: new Date().toISOString(), ...(reason ? { reason } : {}) },
          updatedAt: new Date().toISOString(),
        };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
          [PGD_COLLECTIONS.inspectionPlans, JSON.stringify(getDocumentPayload(next)), next.id],
        );
        await writePgdActivity(client, actor, {
          action: 'UPDATED',
          entityId: next.id,
          entityLabel: request.requestCode,
          requestCode: request.requestCode,
          summary: action === 'ACCEPT' ? `Trưởng đoàn chấp nhận lịch đánh giá ${request.requestCode}` : `Trưởng đoàn trả lịch đánh giá ${request.requestCode}: ${reason}`,
          idSuffix: `plan-response-${next.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          notify: buildPgdNotificationDraft({ entityType: 'PGD_REQUEST', action: 'STATUS_CHANGED', entityId: next.id, entityLabel: request.requestCode, requestCode: request.requestCode, actorName: actor.name || actor.username, targetUsernames: [request.receivedByUsername, assignment?.leadInspectorUsername].filter((username): username is string => Boolean(username)) }),
        });
        return next;
      }

      const normalizedInput = { ...input, domain: undefined } as PgdInspectionPlan;
      const next = createPgdInspectionPlan(normalizedInput, new Date().toISOString());
      const isV2 = request.workflowSchemaVersion === 2 || request.workflowSnapshot?.workflowSchemaVersion === 2;
      if (isV2) next.acceptance = { status: 'PENDING' };
      await persistPgdArtifact(client, PGD_COLLECTIONS.inspectionPlans, next);
      await client.query(
        `UPDATE app_documents SET data = data || jsonb_build_object('inspectionPlanId', $2::text), updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, next.id, request.id],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: next.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Cập nhật kế hoạch giám định PGD cho ${request.requestCode}`,
        idSuffix: `plan-${request.id}`,
      });
      return next;
    });

    return jsonOk({ plan });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
