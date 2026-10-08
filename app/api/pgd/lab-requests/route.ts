import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdSample,
  buildPgdLabRequest,
} from '@/utils/pgdDomain';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.labRequests, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const labRequest = (await req.json().catch(() => ({}))) as PgdLabRequest;
  if (!labRequest?.id || labRequest.domain !== 'pgd' || !labRequest.requestId || !labRequest.sampleId || !labRequest.handover) {
    return jsonBadRequest('Yêu cầu PTN PGD thiếu thông tin liên kết mẫu/hồ sơ.');
  }

  try {
    const persistedLabRequest = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, labRequest.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD của yêu cầu PTN.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);
      assertPgdRequestStationMutationAllowed(request, 'FIELD_SAMPLING');

      const sampleResult = await client.query(
        `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
        [PGD_COLLECTIONS.samples, labRequest.sampleId],
      );
      const sample = sampleResult.rows[0]?.data as PgdSample | undefined;
      if (!sample || sample.requestId !== labRequest.requestId || sample.disposition !== 'LAB') {
        throw Object.assign(new Error('Mẫu PTN không thuộc hồ sơ PGD hoặc không phải phần mẫu gửi PTN.'), { statusCode: 409 });
      }

      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.labRequests, labRequest.id],
      );
      const existing = existingResult.rows[0] ? (mapDocumentRow(existingResult.rows[0]) as PgdLabRequest) : undefined;
      const persistedLabRequest = buildPgdLabRequest(labRequest, actor.username, new Date().toISOString(), existing);

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.labRequests, persistedLabRequest.id, JSON.stringify(getDocumentPayload(persistedLabRequest))],
      );
      await client.query(
        `UPDATE app_documents
         SET data = data || jsonb_build_object('handedOverAt', $2::text, 'laboratoryName', $3::text), updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = $1 AND document_id = $4`,
        [PGD_COLLECTIONS.samples, persistedLabRequest.handover?.sentAt, persistedLabRequest.laboratoryName, persistedLabRequest.sampleId],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: persistedLabRequest.id,
        entityLabel: persistedLabRequest.laboratoryName,
        requestCode: request.requestCode,
        summary: `Gửi yêu cầu PTN PGD đến ${persistedLabRequest.laboratoryName} cho ${request.requestCode}`,
        idSuffix: `lab-request-${persistedLabRequest.requestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_LAB_REQUEST',
          action: 'UPDATED',
          entityId: persistedLabRequest.id,
          entityLabel: request.requestCode,
          requestCode: request.requestCode,
          actorName: actor.name || actor.username,
        }),
      });
      return persistedLabRequest;
    });

    return jsonOk({ labRequest: persistedLabRequest });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
