import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import {
  PCN_CUSTOMER_BUSINESS_FIELDS,
  getPcnCustomerBusinessPayload,
  getPcnDocumentId,
  normalizeCustomerRecord,
  samePcnCustomerBusiness,
  stablePcnMutationId,
} from '@/lib/server/pcn-customers';
import { CustomerRef } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ customerId: string }> | { customerId: string } }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const customerId = decodeURIComponent(String(resolvedParams.customerId || '')).trim();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const incoming = body?.customer;
  if (
    !customerId ||
    customerId.length > 200 ||
    /[\\/]/.test(customerId) ||
    !incoming ||
    typeof incoming !== 'object' ||
    Array.isArray(incoming)
  ) {
    return jsonError('Mã hoặc dữ liệu khách hàng PCN không hợp lệ.', 400);
  }

  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `pcn-customer-update:${customerId.toLowerCase()}`,
      ]);
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'customers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [customerId]
      );
      let previous: CustomerRef | undefined;
      if (existingResult.rows.length > 0) {
        previous = mapDocumentRow(existingResult.rows[0]) as unknown as CustomerRef;
      }
      if (!previous) {
        const retryCandidate = normalizeCustomerRecord(incoming);
        const retryId = getPcnDocumentId(retryCandidate);
        if (retryId && retryId !== customerId) {
          const retryResult = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'customers' AND document_id = $1
             LIMIT 1 FOR UPDATE`,
            [retryId]
          );
          if (retryResult.rows.length > 0) {
            const existing = mapDocumentRow(retryResult.rows[0]) as unknown as CustomerRef;
            if (samePcnCustomerBusiness(existing, retryCandidate)) {
              return { customer: existing, id: retryId, idempotent: true as const };
            }
          }
        }
        throw Object.assign(new Error('Không tìm thấy khách hàng PCN cần cập nhật.'), { statusCode: 404 });
      }

      const record = normalizeCustomerRecord(incoming, previous);
      const nextId = getPcnDocumentId(record);
      if (!nextId || nextId.length > 200 || /[\\/]/.test(nextId)) {
        throw Object.assign(new Error('Khách hàng PCN phải có mã hoặc tên hợp lệ.'), { statusCode: 400 });
      }
      if (nextId === customerId && samePcnCustomerBusiness(previous, record)) {
        return { customer: previous, id: customerId, idempotent: true as const };
      }

      if (nextId !== customerId) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `pcn-customer-create:${nextId.toLowerCase()}`,
        ]);
        const conflictResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'customers' AND document_id = $1
           LIMIT 1 FOR UPDATE`,
          [nextId]
        );
        if (conflictResult.rows.length > 0) {
          throw Object.assign(new Error('Mã khách hàng mới đã thuộc về khách hàng khác.'), { statusCode: 409 });
        }
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('customers', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [nextId, JSON.stringify(getDocumentPayload(record))]
        );
        await client.query(
          `DELETE FROM app_documents WHERE collection_name = 'customers' AND document_id = $1`,
          [customerId]
        );
      } else {
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'customers' AND document_id = $1`,
          [customerId, JSON.stringify(getDocumentPayload(record))]
        );
      }

      const activityLog = buildActivityLog({
        id: stablePcnMutationId(
          'activity-pcn-customer-update',
          `${customerId}:${nextId}:${JSON.stringify(getPcnCustomerBusinessPayload(record))}`
        ),
        action: 'UPDATED',
        entityType: 'PCN_CUSTOMER',
        entityId: nextId,
        entityLabel: record.name,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Cập nhật khách hàng trong danh mục PCN',
        changes: diffActivityFields({ ...previous, id: customerId }, { ...record, id: nextId }, [
          ...PCN_CUSTOMER_BUSINESS_FIELDS,
          'id',
        ]),
        source: 'UI',
        createdAt: record.updatedAt,
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw Object.assign(new Error(validationError), { statusCode: 400 });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))]
      );
      return { customer: record, id: nextId, activityLog, idempotent: false as const };
    });
    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN customer update error:', error);
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ customerId: string }> | { customerId: string } }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const customerId = decodeURIComponent(String(resolvedParams.customerId || '')).trim();
  if (!customerId || customerId.length > 200 || /[\\/]/.test(customerId)) {
    return jsonError('Mã khách hàng PCN không hợp lệ.', 400);
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const activityId = stablePcnMutationId('activity-pcn-customer-delete', customerId);
      const existingActivityResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'activityLogs' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [activityId]
      );
      if (existingActivityResult.rows.length > 0) {
        return {
          id: customerId,
          deleted: true,
          activityLog: mapDocumentRow(existingActivityResult.rows[0]),
          idempotent: true as const,
        };
      }

      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'customers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [customerId]
      );
      if (existingResult.rows.length === 0) {
        return { id: customerId, deleted: false, idempotent: true as const };
      }

      const referenceResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM app_documents
         WHERE data ->> 'customerId' = $1`,
        [customerId]
      );
      const referenceCount = Number(referenceResult.rows[0]?.count || 0);
      if (referenceCount > 0) {
        throw Object.assign(
          new Error(`Không thể xóa khách hàng PCN vì còn ${referenceCount} hồ sơ đang tham chiếu.`),
          { statusCode: 409 }
        );
      }

      const customer = mapDocumentRow(existingResult.rows[0]) as unknown as CustomerRef;
      await client.query(
        `DELETE FROM app_documents WHERE collection_name = 'customers' AND document_id = $1`,
        [customerId]
      );
      const activityLog = buildActivityLog({
        id: activityId,
        action: 'DELETED',
        entityType: 'PCN_CUSTOMER',
        entityId: customerId,
        entityLabel: customer.name,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Xóa khách hàng khỏi danh mục PCN',
        changes: diffActivityFields(customer, {}, [...PCN_CUSTOMER_BUSINESS_FIELDS]),
        source: 'UI',
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw Object.assign(new Error(validationError), { statusCode: 400 });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))]
      );
      return { id: customerId, deleted: true, activityLog, idempotent: false as const };
    });
    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN customer delete error:', error);
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
