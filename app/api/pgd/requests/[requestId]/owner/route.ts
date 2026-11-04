import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdDossierManager } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonNotFound, jsonOk } from '@/lib/server/response';
import { toPcnUserAccount } from '@/utils/pcnAuth';
import { diffActivityFields } from '@/utils/activityLog';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';
import {
  assignPgdDossierOwner,
  PGD_COLLECTIONS,
  PgdInspectionRequest,
} from '@/utils/pgdDomain';
import {
  assertPgdRequestEvidenceMutationAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const managerError = requirePgdDossierManager(req);
  if (managerError) return managerError;

  const actor = getPgdSessionUser(req)!;
  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const ownerUsername = String(body?.ownerUsername || '').trim();
  if (!requestId || !ownerUsername) {
    return jsonBadRequest('Cần có mã hồ sơ và username người phụ trách PGD.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
           WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd'
           LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });
      const current = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(current);

      const ownerResult = await client.query(
        `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'systemUsers'
             AND (
               lower(document_id) = lower($1)
               OR lower(COALESCE(data->>'username', data->>'Tên đăng nhập', data->>'email', data->>'Email', '')) = lower($1)
               OR split_part(lower(COALESCE(data->>'username', data->>'Tên đăng nhập', data->>'email', data->>'Email', '')), '@', 1) = lower($1)
             )
           LIMIT 1 FOR UPDATE`,
        [ownerUsername],
      );
      const owner = ownerResult.rows[0]
        ? toPcnUserAccount({ documentId: ownerResult.rows[0].document_id, data: ownerResult.rows[0].data || {} })
        : undefined;
      if (!owner || owner.active === false || !owner.departmentScopes?.includes('PGD') || owner.pgdRole === 'PGD_VIEWER' || (owner.systemRole || owner.role) === 'viewer') {
        throw Object.assign(new Error('Chủ hồ sơ phải là nhân sự đang hoạt động và có scope PGD.'), { statusCode: 400 });
      }

      if (current.ownerUsername === owner.username) return current;

      const now = new Date().toISOString();
      const next = assignPgdDossierOwner(current, owner.username, now);
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(next)), requestId],
      );

      await writePgdActivity(client, actor, {
        action: 'ASSIGNED',
        entityType: 'PGD_REQUEST',
        entityId: next.id,
        entityLabel: next.requestCode,
        requestCode: next.requestCode,
        summary: `Phân công lại chủ hồ sơ PGD ${next.requestCode} cho ${owner.username}`,
        changes: diffActivityFields(current, next, ['ownerUsername', 'ownerAssignedAt']),
        idSuffix: `owner-${next.id}-${now}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_REQUEST',
          action: 'ASSIGNED',
          entityId: next.id,
          entityLabel: next.requestCode,
          requestCode: next.requestCode,
          actorName: actor.name || actor.username,
          targetUsernames: [owner.username],
        }),
      });

      return next;
    });

    return jsonOk({ request: result });
  } catch (error: any) {
    console.error('PGD assign owner error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404) return jsonNotFound(error?.message || String(error));
    return jsonBadRequest(error?.message || String(error));
  }
}
