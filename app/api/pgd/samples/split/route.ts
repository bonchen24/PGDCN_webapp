import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonCreated, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdInspectionRequest,
  splitPgdSample,
} from '@/utils/pgdDomain';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.samples, 'write');
  if (mutationError) return mutationError;

  try {
    const actor = getPgdSessionUser(req)!;
    const input = (await req.json().catch(() => ({}))) || {};
    const base = splitPgdSample({
      requestId: String(input.requestId || ''),
      sampleCodePrefix: String(input.sampleCodePrefix || 'PGD'),
      description: String(input.description || ''),
      quantity: Number(input.quantity),
      unit: input.unit ? String(input.unit) : undefined,
      sampledAt: input.sampledAt ? String(input.sampledAt) : undefined,
      samplingLocation: input.samplingLocation ? String(input.samplingLocation) : undefined,
      sampledByUsername: input.sampledByUsername ? String(input.sampledByUsername) : undefined,
      sampleSize: input.sampleSize ? String(input.sampleSize) : undefined,
      lotQuantity: input.lotQuantity === undefined ? undefined : Number(input.lotQuantity),
      lotUnit: input.lotUnit ? String(input.lotUnit) : undefined,
    });
    const samples = [base.lab, base.retained];

    await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, base.lab.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD để tách mẫu.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);
      assertPgdRequestStationMutationAllowed(request, 'FIELD_SAMPLING');

      for (const sample of samples) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
          [PGD_COLLECTIONS.samples, sample.id, JSON.stringify(getDocumentPayload(sample))],
        );
      }
      await client.query(
        `UPDATE app_documents SET data = data || jsonb_build_object('sampleIds', $2::jsonb), updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(samples.map((sample) => sample.id)), base.lab.requestId],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: base.lab.requestId,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Tách mẫu gửi PTN và mẫu lưu cho ${request.requestCode}`,
        idSuffix: `samples-${base.lab.requestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_SAMPLE',
          action: 'CREATED',
          entityId: base.lab.requestId,
          entityLabel: request.requestCode,
          requestCode: request.requestCode,
          actorName: actor.name || actor.username,
        }),
      });
    });

    return jsonCreated({ samples });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
