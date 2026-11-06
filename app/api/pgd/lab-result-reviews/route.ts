import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { PGD_COLLECTIONS, PgdInspectionRequest } from '@/utils/pgdDomain';
import { applyPgdDossierConditionalRequirements } from '@/utils/pgdDossier';
import {
  PgdLabResultReview,
  createPgdLabResultReview,
} from '@/utils/pgdArtifacts';
import {
  assertPgdAssessmentRoundAllowed,
  getPgdArtifactRequest,
  persistPgdArtifact,
  writePgdActivity,
} from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.labResultReviews, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const input = (await req.json().catch(() => ({}))) as PgdLabResultReview;
  if (!input?.id || (input.domain && input.domain !== 'pgd') || !input.requestId) {
    return jsonBadRequest('Bản đánh giá KQTN PGD thiếu id, miền hoặc mã hồ sơ.');
  }

  try {
    const review = await withPgTransaction(async (client) => {
      const request = await getPgdArtifactRequest(client, input.requestId, 'LAB_RESULTS');
      await assertPgdAssessmentRoundAllowed(client, request, input.assessmentRoundId, actor);
      const resultIds = Array.from(new Set((input.labResultIds || []).map((id) => String(id).trim()).filter(Boolean)));
      const resultRows = resultIds.length === 0 ? [] : await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' AND data->>'requestId' = $3 AND COALESCE(data->>'assessmentRoundId', '') = $4 AND document_id = ANY($2::text[])`,
        [PGD_COLLECTIONS.labResults, resultIds, request.id, String(input.assessmentRoundId || '')],
      );
      if (resultRows.rows.length !== resultIds.length) {
        throw Object.assign(new Error('Bản đánh giá KQTN có kết quả PTN không tồn tại trong miền PGD.'), { statusCode: 409 });
      }
      const now = new Date().toISOString();
      const next = createPgdLabResultReview({
        ...input,
        labResultIds: resultIds,
        domain: undefined,
        ...(input.retestRequired === true ? { retestRequestedAt: now, retestRequestedByUsername: actor.username } : {}),
      } as PgdLabResultReview, now);
      await persistPgdArtifact(client, PGD_COLLECTIONS.labResultReviews, next);
      const dossierChecklist = applyPgdDossierConditionalRequirements(request.dossierChecklist, next, now);
      const nextRequest: PgdInspectionRequest = {
        ...request,
        labResultReviewId: next.id,
        dossierChecklist,
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), request.id],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: next.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Đánh giá kết quả thử nghiệm PGD cho ${request.requestCode}`,
        idSuffix: `lab-review-${request.id}`,
      });
      return { review: next, request: nextRequest };
    });

    return jsonOk(review);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
