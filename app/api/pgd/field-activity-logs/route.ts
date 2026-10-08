import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { jsonBadRequest, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { PGD_COLLECTIONS } from '@/utils/pgdDomain';
import {
  PgdFieldActivityLog,
  createPgdFieldActivityLog,
} from '@/utils/pgdArtifacts';
import {
  getPgdArtifactRequest,
  persistPgdArtifact,
  writePgdActivity,
} from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.fieldActivityLogs, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const input = (await req.json().catch(() => ({}))) as PgdFieldActivityLog;
  if (!input?.id || (input.domain && input.domain !== 'pgd') || !input.requestId) {
    return jsonBadRequest('Phiếu ghi chép PGD thiếu id, miền hoặc mã hồ sơ.');
  }

  try {
    const log = await withPgTransaction(async (client) => {
      const request = await getPgdArtifactRequest(client, input.requestId, 'FIELD_SAMPLING');
      const next = createPgdFieldActivityLog({ ...input, domain: undefined } as PgdFieldActivityLog, new Date().toISOString());
      await persistPgdArtifact(client, PGD_COLLECTIONS.fieldActivityLogs, next);
      await client.query(
        `UPDATE app_documents SET data = jsonb_set(data, '{fieldActivityLogIds}', COALESCE(data->'fieldActivityLogIds', '[]'::jsonb) || to_jsonb($2::text), true), updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, next.id, request.id],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: next.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Ghi nhận phiếu ghi chép hiện trường ${request.requestCode}`,
        idSuffix: `field-log-${request.id}`,
      });
      return next;
    });

    return jsonOk({ log });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
