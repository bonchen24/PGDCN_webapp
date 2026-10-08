import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { jsonBadRequest, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { PGD_COLLECTIONS } from '@/utils/pgdDomain';
import {
  PgdInspectionPlan,
  createPgdInspectionPlan,
} from '@/utils/pgdArtifacts';
import {
  getPgdArtifactRequest,
  persistPgdArtifact,
  writePgdActivity,
} from '@/lib/server/pgd-operations';

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
      const next = createPgdInspectionPlan({ ...input, domain: undefined } as PgdInspectionPlan, new Date().toISOString());
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
