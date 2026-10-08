import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { PGD_COLLECTIONS } from '@/utils/pgdDomain';
import {
  PgdDossierIndex,
  buildPgdDossierIndex,
} from '@/utils/pgdArtifacts';
import {
  getPgdArtifactRequest,
  persistPgdArtifact,
  writePgdActivity,
} from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.dossierIndexes, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const input = (await req.json().catch(() => ({}))) as PgdDossierIndex;
  if ((input.domain && input.domain !== 'pgd') || !input?.requestId) {
    return jsonBadRequest('Mục lục hồ sơ PGD thiếu miền hoặc mã hồ sơ.');
  }

  try {
    const index = await withPgTransaction(async (client) => {
      const request = await getPgdArtifactRequest(client, input.requestId, 'REPORT_APPROVAL_RETURN');
      const next = buildPgdDossierIndex({ ...input, domain: undefined } as PgdDossierIndex, new Date().toISOString());
      const documentIds = next.entries.map((entry) => entry.documentId).filter((id): id is string => Boolean(id));
      if (documentIds.length > 0) {
        const documents = await client.query(
          `SELECT document_id FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' AND data->>'requestId' = $2 AND document_id = ANY($3::text[])`,
          [PGD_COLLECTIONS.dossierDocuments, request.id, documentIds],
        );
        if (documents.rows.length !== documentIds.length) {
          throw Object.assign(new Error('Mục lục hồ sơ chỉ được tham chiếu tài liệu PGD hiện hành của hồ sơ.'), { statusCode: 409 });
        }
      }
      await persistPgdArtifact(client, PGD_COLLECTIONS.dossierIndexes, next);
      await client.query(
        `UPDATE app_documents SET data = data || jsonb_build_object('dossierIndexId', $2::text), updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, next.id, request.id],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: next.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Cập nhật bìa và mục lục hồ sơ PGD ${request.requestCode}`,
        idSuffix: `dossier-index-${request.id}`,
      });
      return next;
    });

    return jsonOk({ index });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
