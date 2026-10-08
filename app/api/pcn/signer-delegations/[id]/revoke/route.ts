import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, isSessionAdmin } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload } from '@/lib/server/collections';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog } from '@/lib/server/activity-logs';
import { PcnSignerDelegation } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!isSessionAdmin(actor)) {
    return jsonForbidden('Chỉ Admin mới có quyền thực hiện thao tác này.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const delegationId = decodeURIComponent(String(resolvedParams.id || '')).trim();
  if (!delegationId) {
    return jsonError('Thiếu mã ủy quyền người ký.', 400);
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSignerDelegations' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [delegationId],
      );
      if (existingResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy ủy quyền người ký.'), { statusCode: 404 });
      }
      const before = {
        id: existingResult.rows[0].document_id,
        ...(existingResult.rows[0].data || {}),
      } as PcnSignerDelegation;
      if (before.status !== 'ACTIVE') {
        throw Object.assign(new Error('Ủy quyền người ký đã được thu hồi.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const after: PcnSignerDelegation = {
        ...before,
        status: 'REVOKED',
        revokedAt: now,
        revokedByUsername: actor.username,
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnSignerDelegations' AND document_id = $1`,
        [delegationId, JSON.stringify(getDocumentPayload(after))],
      );
      const log = buildActivityLog({
        action: 'UPDATED',
        entityType: 'PCN_SIGNER_DELEGATION',
        entityId: delegationId,
        entityLabel: before.grantorUsername + ' → ' + before.delegateUsername,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Thu hồi ủy quyền người ký PCN',
        changes: diffActivityFields(before, after, ['status', 'revokedAt', 'revokedByUsername']),
        source: 'UI',
      });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [log.id, JSON.stringify(getDocumentPayload(log))],
      );
      return { delegation: after, activityLog: log };
    });
    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
