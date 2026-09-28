import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import {
  PCN_CUSTOMER_BUSINESS_FIELDS,
  getPcnDocumentId,
  normalizeCustomerRecord,
  samePcnCustomerBusiness,
  stablePcnMutationId,
} from '@/lib/server/pcn-customers';
import { CustomerRef } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const incoming = body?.customer;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return jsonError('Thiếu dữ liệu khách hàng PCN.', 400);
  }
  const customer = normalizeCustomerRecord(incoming);
  const customerId = getPcnDocumentId(customer);
  if (!customerId || customerId.length > 200 || /[\\/]/.test(customerId)) {
    return jsonError('Khách hàng PCN phải có mã hoặc tên hợp lệ.', 400);
  }

  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `pcn-customer-create:${customerId.toLowerCase()}`,
      ]);
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'customers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [customerId]
      );
      if (existingResult.rows.length > 0) {
        const existing = mapDocumentRow(existingResult.rows[0]) as unknown as CustomerRef;
        if (!samePcnCustomerBusiness(existing, customer)) {
          throw Object.assign(
            new Error('Mã khách hàng đã tồn tại nhưng thông tin không giống yêu cầu retry.'),
            { statusCode: 409 }
          );
        }
        return { customer: existing, id: customerId, idempotent: true as const };
      }
      const write = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('customers', $1, $2::jsonb, CURRENT_TIMESTAMP)
         RETURNING document_id, data`,
        [customerId, JSON.stringify(getDocumentPayload(customer))]
      );
      const activityLog = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-customer-create', customerId),
        action: 'CREATED',
        entityType: 'PCN_CUSTOMER',
        entityId: customerId,
        entityLabel: customer.name,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Tạo khách hàng trong danh mục PCN',
        changes: diffActivityFields({}, customer, [...PCN_CUSTOMER_BUSINESS_FIELDS]),
        source: 'UI',
        createdAt: customer.createdAt,
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw Object.assign(new Error(validationError), { statusCode: 400 });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))]
      );
      return {
        customer: mapDocumentRow(write.rows[0]) as unknown as CustomerRef,
        id: customerId,
        activityLog,
        idempotent: false as const,
      };
    });
    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN customer create error:', error);
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
