import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk, jsonServerError } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdFieldInspection,
  PgdInspectionRequest,
  validatePgdInspectors,
} from '@/utils/pgdDomain';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  assertPgdAssessmentRoundAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { toPcnUserAccount } from '@/utils/pcnAuth';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.fieldInspections, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const inspection = (await req.json().catch(() => ({}))) as PgdFieldInspection;
  if (!inspection?.id || inspection.domain !== 'pgd' || !inspection.requestId || !Array.isArray(inspection.inspectorUsernames)) {
    return jsonBadRequest('Biên bản hiện trường PGD thiếu id, miền hoặc mã hồ sơ.');
  }

  try {
    await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, inspection.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD của biên bản hiện trường.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);
      assertPgdRequestStationMutationAllowed(request, 'FIELD_SAMPLING');
      await assertPgdAssessmentRoundAllowed(client, request, inspection.assessmentRoundId, actor);

      const usersResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'systemUsers' ORDER BY document_id`);
      const users = usersResult.rows.map((row: any) => toPcnUserAccount({ documentId: row.document_id, data: row.data || {} }));
      const inspectorIssues = validatePgdInspectors(inspection.inspectorUsernames, users);
      if (inspectorIssues.length > 0) {
        throw Object.assign(new Error(`Biên bản hiện trường PGD chưa hợp lệ: ${inspectorIssues.map((issue) => issue.message).join(' ')}`), { statusCode: 400 });
      }

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.fieldInspections, inspection.id, JSON.stringify(getDocumentPayload(inspection))],
      );
      await client.query(
        `UPDATE app_documents SET data = data || jsonb_build_object('fieldInspectionId', $2::text), updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, inspection.id, inspection.requestId],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: inspection.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Cập nhật biên bản hiện trường PGD cho ${request.requestCode}`,
        idSuffix: `field-${inspection.requestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_FIELD_INSPECTION',
          action: 'UPDATED',
          entityId: inspection.id,
          entityLabel: request.requestCode,
          requestCode: request.requestCode,
          actorName: actor.name || actor.username,
        }),
      });
    });

    return jsonOk({ inspection });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
