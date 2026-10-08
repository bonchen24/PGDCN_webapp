import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonNotFound, jsonOk } from '@/lib/server/response';
import { diffActivityFields } from '@/utils/activityLog';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';
import {
  getPgdStatusLabel,
  PGD_COLLECTIONS,
  PgdInspectionRequest,
  PgdInspectionStatus,
} from '@/utils/pgdDomain';
import { getPgdOperationalStepGateDenial } from '@/utils/pgdWorkflow';
import { readPgdTransitionContext, writePgdActivity } from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.requests, 'write');
  if (mutationError) return mutationError;

  const { requestId: rawRequestId } = await params;
  const requestId = String(rawRequestId || '').trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const nextStatus = String(body?.status || '').trim().toUpperCase() as PgdInspectionStatus;
  const exceptionReason = String(body?.reason || '').trim();

  if (!requestId || !nextStatus) {
    return jsonBadRequest('Thiếu mã hồ sơ hoặc trạng thái PGD tiếp theo.');
  }

  if (['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(nextStatus) && (!exceptionReason || exceptionReason.length > 1000)) {
    return jsonBadRequest('Nhánh trả bổ sung/tạm dừng/hủy hồ sơ PGD bắt buộc có lý do tối đa 1000 ký tự.');
  }

  try {
    const actor = getPgdSessionUser(req)!;
    const result = await withPgTransaction(async (client) => {
      const currentResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!currentResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });
      const current = mapDocumentRow(currentResult.rows[0]) as PgdInspectionRequest;
      if (current.domain !== 'pgd') throw Object.assign(new Error('Hồ sơ không thuộc miền PGD.'), { statusCode: 409 });

      const context = await readPgdTransitionContext(client, requestId);
      const denial = getPgdOperationalStepGateDenial({ currentStatus: current.status, nextStatus, evidence: context });
      if (denial) throw Object.assign(new Error(denial), { statusCode: 409 });

      const now = new Date().toISOString();
      const next = {
        ...current,
        status: nextStatus,
        updatedAt: now,
        ...(['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(nextStatus)
          ? { exceptionReason, exceptionAt: now, exceptionByUsername: actor.username }
          : {}),
      };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(next)), requestId],
      );

      await writePgdActivity(client, actor, {
        action: 'STATUS_CHANGED',
        entityId: next.id,
        entityLabel: next.requestCode,
        requestCode: next.requestCode,
        summary: `Chuyển trạng thái hồ sơ PGD sang ${getPgdStatusLabel(next.status)}${exceptionReason ? `: ${exceptionReason}` : ''}`,
        changes: diffActivityFields(current, next, ['status']),
        idSuffix: `status-${current.status}-${next.status}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_REQUEST',
          action: 'STATUS_CHANGED',
          entityId: next.id,
          entityLabel: next.requestCode,
          requestCode: next.requestCode,
          previousStatus: current.status,
          nextStatus: next.status,
          actorName: actor.name || actor.username,
        }),
      });

      return next;
    });

    return jsonOk({ request: result });
  } catch (error: any) {
    console.error('PGD transition error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404) return jsonNotFound(error?.message || String(error));
    if (statusCode === 409) return jsonConflict(error?.message || String(error));
    return jsonBadRequest(error?.message || String(error));
  }
}
