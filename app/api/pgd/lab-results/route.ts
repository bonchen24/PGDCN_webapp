import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdInspectionRequest,
  PgdLabResult,
  buildPgdLabResult,
} from '@/utils/pgdDomain';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  assertPgdAssessmentRoundAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.labResults, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const result = (await req.json().catch(() => ({}))) as PgdLabResult;
  if (!result?.id || result.domain !== 'pgd' || !result.requestId || !result.labRequestId || !Array.isArray(result.values)) {
    return jsonBadRequest('Kết quả PTN PGD thiếu thông tin liên kết.');
  }

  try {
    const persistedResult = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, result.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD của kết quả PTN.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);
      assertPgdRequestStationMutationAllowed(request, 'LAB_RESULTS');
      await assertPgdAssessmentRoundAllowed(client, request, result.assessmentRoundId, actor);

      const labRequestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
        [PGD_COLLECTIONS.labRequests, result.labRequestId],
      );
      if (!labRequestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy yêu cầu PTN PGD.'), { statusCode: 404 });
      if (String(labRequestResult.rows[0].data?.requestId || '') !== result.requestId) {
        throw Object.assign(new Error('Kết quả PTN không khớp hồ sơ PGD.'), { statusCode: 409 });
      }
      if (String(labRequestResult.rows[0].data?.assessmentRoundId || '') !== String(result.assessmentRoundId || '')) {
        throw Object.assign(new Error('Kết quả PTN và yêu cầu PTN phải thuộc cùng một đợt đánh giá.'), { statusCode: 409 });
      }

      const persistedResult = buildPgdLabResult(result, actor.username, new Date().toISOString());
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.labResults, persistedResult.id, JSON.stringify(getDocumentPayload(persistedResult))],
      );
      await client.query(
        `UPDATE app_documents SET data = data || jsonb_build_object('status', 'RESULT_RECEIVED', 'resultId', $2::text), updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.labRequests, persistedResult.id, persistedResult.labRequestId],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: persistedResult.id,
        entityLabel: persistedResult.reportNumber || 'Kết quả PTN PGD',
        requestCode: request.requestCode,
        summary: `Tiếp nhận kết quả PTN PGD cho ${request.requestCode}`,
        idSuffix: `lab-result-${persistedResult.labRequestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_LAB_RESULT',
          action: 'CREATED',
          entityId: persistedResult.id,
          entityLabel: request.requestCode,
          requestCode: request.requestCode,
          actorName: actor.name || actor.username,
        }),
      });
      return persistedResult;
    });

    return jsonOk({ result: persistedResult });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
