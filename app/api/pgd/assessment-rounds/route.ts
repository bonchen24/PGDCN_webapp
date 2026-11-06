import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { PGD_COLLECTIONS, type PgdAssessmentRound, type PgdInspectionAssignment, type PgdInspectionRequest } from '@/utils/pgdDomain';
import { getPgdAssignmentApprovalDenial } from '@/utils/pgdWorkflow';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';
import { hasPgdDossierCapability } from '@/utils/pgdDossierCapabilities';
import { closePgdAssessmentRound, createPgdAssessmentRound } from '@/utils/pgdAssessmentRounds';
import { writePgdActivity } from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.assessmentRounds, 'write');
  if (mutationError) return mutationError;
  const actor = getPgdSessionUser(req)!;
  const body = await req.json().catch(() => ({})) as { requestId?: string; id?: string; action?: string; reason?: string };
  const requestId = String(body.requestId || '').trim();
  const action = String(body.action || '').trim().toUpperCase();
  if (!requestId || !['CREATE', 'CLOSE'].includes(action)) return jsonBadRequest('Thao tác đợt đánh giá PGD thiếu hồ sơ hoặc action hợp lệ.');

  try {
    const round = await withPgTransaction(async (client) => {
      const requestResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`, [PGD_COLLECTIONS.requests, requestId]);
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      if (request.workflowSchemaVersion !== 2 && request.workflowSnapshot?.workflowSchemaVersion !== 2) throw Object.assign(new Error('Đợt đánh giá chỉ áp dụng cho hồ sơ workflow v2.'), { statusCode: 409 });
      if (!['FIELD_INSPECTION', 'WAITING_LAB_RESULTS', 'RESULTS_REVIEW'].includes(request.status)) throw Object.assign(new Error('Chỉ có thể quản lý đợt đánh giá trong giai đoạn B4.'), { statusCode: 409 });

      const assignmentResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`, [PGD_COLLECTIONS.assignments, request.id]);
      const assignment = assignmentResult.rows[0] ? mapDocumentRow(assignmentResult.rows[0]) as PgdInspectionAssignment : undefined;
      const manager = !getPgdAssignmentApprovalDenial('APPROVED', actor);
      if (!manager && !hasPgdDossierCapability(assignment, actor.username, 'TEAM_LEAD') && !hasPgdDossierCapability(assignment, actor.username, 'ASSESSOR')) {
        throw Object.assign(new Error('Tài khoản chưa được phân công capability đánh giá cho hồ sơ này.'), { statusCode: 403 });
      }

      const existingResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY (data->>'sequence')::int, document_id FOR UPDATE`, [PGD_COLLECTIONS.assessmentRounds, request.id]);
      const rounds = existingResult.rows.map((row: any) => mapDocumentRow(row) as PgdAssessmentRound);
      const now = new Date().toISOString();
      let next: PgdAssessmentRound;

      if (action === 'CREATE') {
        const id = String(body.id || `pgd-round-${randomUUID()}`).trim();
        const duplicate = rounds.find((item) => item.id === id);
        if (duplicate) return duplicate;
        const previous = rounds[rounds.length - 1];
        if (previous && previous.outcome !== 'NON_CONFORMING') throw Object.assign(new Error('Chỉ mở đợt tiếp theo sau khi đợt trước có kết luận không phù hợp.'), { statusCode: 409 });
        next = createPgdAssessmentRound({ id, requestId: request.id, openedByUsername: actor.username, existingRounds: rounds, reason: body.reason }, now);
      } else {
        const id = String(body.id || '').trim();
        const current = rounds.find((item) => item.id === id);
        if (!current) throw Object.assign(new Error('Không tìm thấy đợt đánh giá cần đóng.'), { statusCode: 404 });
        if (current.status === 'CLOSED') return current;
        const reviewResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'assessmentRoundId' = $3 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`, [PGD_COLLECTIONS.labResultReviews, request.id, current.id]);
        const review = reviewResult.rows[0]?.data;
        if (!review || review.status !== 'FINAL') throw Object.assign(new Error('Cần lưu kết luận đánh giá KQTN cuối cùng cho đợt này trước khi đóng.'), { statusCode: 409 });
        const outcome = review.retestRequired === true || review.conformity === 'NON_CONFORMING' ? 'NON_CONFORMING' : review.conformity === 'CONFORMING' ? 'CONFORMING' : undefined;
        if (!outcome) throw Object.assign(new Error('Kết luận KQTN chưa cho phép đóng đợt đánh giá.'), { statusCode: 409 });
        next = closePgdAssessmentRound(current, { closedByUsername: actor.username, outcome }, now);
      }

      await client.query(`INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP) ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`, [PGD_COLLECTIONS.assessmentRounds, next.id, JSON.stringify(getDocumentPayload(next))]);
      const nextRequest: PgdInspectionRequest = {
        ...request,
        assessmentRoundIds: Array.from(new Set([...(request.assessmentRoundIds || []), next.id])),
        currentAssessmentRoundId: next.status === 'OPEN' ? next.id : request.currentAssessmentRoundId,
        updatedAt: now,
      };
      await client.query(`UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`, [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), request.id]);
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: next.id,
        entityLabel: `${request.requestCode} · ${next.label}`,
        requestCode: request.requestCode,
        summary: action === 'CREATE' ? `Mở ${next.label} cho ${request.requestCode}${next.reason ? `: ${next.reason}` : ''}` : `Đóng ${next.label} của ${request.requestCode} · ${next.outcome}`,
        idSuffix: `assessment-round-${next.id}-${action.toLowerCase()}`,
        notify: buildPgdNotificationDraft({ entityType: 'PGD_REQUEST', action: 'UPDATED', entityId: request.id, entityLabel: request.requestCode, requestCode: request.requestCode, actorName: actor.name || actor.username, targetUsernames: [assignment?.leadInspectorUsername, ...(assignment?.inspectorUsernames || []), assignment?.technicalReviewerUsername].filter((username): username is string => Boolean(username)) }),
      });
      return next;
    });
    return jsonOk({ round });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
