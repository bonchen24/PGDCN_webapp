import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { pool, withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, isSessionAdmin } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonOk, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  validatePcnSignerDelegationInput,
} from '@/lib/server/pcn-signer-delegations';
import { toPcnUserAccount } from '@/utils/pcnAuth';
import { getPcnSignerAuthorization } from '@/utils/pcnSignerAuthorization';
import { buildActivityLog } from '@/lib/server/activity-logs';
import { PcnSignerDelegation } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }

  try {
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'pcnSignerDelegations'
       ORDER BY COALESCE(data->>'effectiveUntil', '') DESC, document_id`,
    );
    return jsonOk({
      items: result.rows.map((row: any) => ({
        id: row.document_id,
        ...(row.data || {}),
      })),
    });
  } catch (error: any) {
    console.error('PCN signer delegation list error:', error);
    return jsonServerError(error?.message || String(error));
  }
}

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!isSessionAdmin(actor)) {
    return jsonForbidden('Chỉ Admin mới có quyền thực hiện thao tác này.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const validation = validatePcnSignerDelegationInput(body || {});
  if (validation.error || !validation.data) {
    return jsonError(validation.error || 'Dữ liệu ủy quyền người ký không hợp lệ.', 400);
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const userResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'systemUsers'
           AND lower(document_id) = ANY($1::text[])`,
        [[validation.data!.grantorUsername, validation.data!.delegateUsername, validation.data!.approvedByUsername]],
      );
      const users = userResult.rows.map((row: any) =>
        toPcnUserAccount({ documentId: row.document_id, data: row.data || {} })
      );
      const delegationId = 'pcn-delegation-' + randomUUID();
      const now = new Date().toISOString();
      const delegation: PcnSignerDelegation = {
        id: delegationId,
        ...validation.data!,
        createdAt: now,
        updatedAt: now,
      };
      const authorization = getPcnSignerAuthorization({
        signerUsername: delegation.delegateUsername,
        fieldCodes: delegation.fieldCodes,
        issuedAt: delegation.effectiveFrom,
        users,
        delegations: [delegation],
      });
      if (!authorization.authorized && authorization.mode !== 'DIRECT') {
        throw Object.assign(new Error(authorization.reason), { statusCode: 400 });
      }

      const write = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnSignerDelegations', $1, $2::jsonb, CURRENT_TIMESTAMP)
         RETURNING document_id, data`,
        [delegationId, JSON.stringify(getDocumentPayload(delegation))],
      );
      const log = buildActivityLog({
        action: 'CREATED',
        entityType: 'PCN_SIGNER_DELEGATION',
        entityId: delegationId,
        entityLabel: delegation.grantorUsername + ' → ' + delegation.delegateUsername,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Tạo ủy quyền người ký PCN',
        source: 'UI',
      });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [log.id, JSON.stringify(getDocumentPayload(log))],
      );
      return { delegation: mapDocumentRow(write.rows[0]), activityLog: log };
    });
    return jsonCreated(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
