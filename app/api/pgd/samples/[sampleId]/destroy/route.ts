import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdInspectionRequest,
  PgdSample,
} from '@/utils/pgdDomain';
import { markPgdSampleDestroyed } from '@/utils/pgdDossier';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sampleId: string }> },
) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.samples, 'write');
  if (mutationError) return mutationError;

  const { sampleId: rawSampleId } = await params;
  const sampleId = decodeURIComponent(String(rawSampleId || '')).trim();
  const body = (await req.json().catch(() => ({}))) || {};
  const note = String(body?.note ?? '').trim();

  if (!sampleId || !note) {
    return jsonBadRequest('Cần có mã mẫu và lý do hủy mẫu PGD.');
  }

  try {
    const actor = getPgdSessionUser(req)!;
    const sample = await withPgTransaction(async (client) => {
      const sampleResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.samples, sampleId],
      );
      if (!sampleResult.rows[0]) throw Object.assign(new Error('Không tìm thấy mẫu PGD.'), { statusCode: 404 });
      const currentSample = mapDocumentRow(sampleResult.rows[0]) as PgdSample;
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, currentSample.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD của mẫu cần hủy.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);
      assertPgdRequestStationMutationAllowed(request, 'FIELD_SAMPLING');
      const destroyed = markPgdSampleDestroyed(currentSample, actor.username, note, new Date().toISOString());
      await client.query(
        `UPDATE app_documents
            SET data = $2::jsonb,
                updated_at = CURRENT_TIMESTAMP
          WHERE collection_name = $1
            AND document_id = $3`,
        [PGD_COLLECTIONS.samples, JSON.stringify(getDocumentPayload(destroyed)), destroyed.id],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityType: 'PGD_SAMPLE',
        entityId: destroyed.id,
        entityLabel: destroyed.sampleCode,
        requestCode: request.requestCode,
        summary: `Hủy mẫu lưu PGD ${destroyed.sampleCode} của ${request.requestCode}`,
        idSuffix: `sample-destroy-${destroyed.id}`,
      });
      return destroyed;
    });

    return jsonOk({ sample });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
