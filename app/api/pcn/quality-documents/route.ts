import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, isSessionAdmin } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { isSafePcnSampleKey } from '@/lib/server/workflow-templates';
import { stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import {
  buildPcnQualityDocument,
  samePcnQualityDocumentMetadata,
} from '@/lib/server/pcn-quality-documents';
import { PcnQualityDocument } from '@/types';

export const dynamic = 'force-dynamic';

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

  const incoming = body?.document;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return jsonError('Thiếu metadata tài liệu chất lượng PCN.', 400);
  }
  if (
    Object.prototype.hasOwnProperty.call(incoming, 'fileAssetId') ||
    Object.prototype.hasOwnProperty.call(incoming, 'fileName')
  ) {
    return jsonError('Pointer file tài liệu chất lượng phải đi qua boundary gắn file riêng.', 400);
  }
  const documentId = String(incoming.id || '').trim();
  if (!isSafePcnSampleKey(documentId)) {
    return jsonError('Mã tài liệu chất lượng PCN không hợp lệ.', 400);
  }

  let candidate: PcnQualityDocument;
  try {
    candidate = buildPcnQualityDocument({ ...incoming, id: documentId }, new Date().toISOString());
  } catch (error: any) {
    return jsonError(String(error?.message || error), 400);
  }

  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-quality-create:${documentId}`]);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `pcn-quality-code:${candidate.documentCode.toLowerCase()}:${candidate.version}`,
      ]);
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnQualityDocuments' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [documentId]
      );
      if (existingResult.rows.length > 0) {
        const existing = mapDocumentRow(existingResult.rows[0]) as PcnQualityDocument;
        if (!samePcnQualityDocumentMetadata(existing, candidate)) {
          throw Object.assign(
            new Error('Mã tài liệu chất lượng đã tồn tại nhưng metadata không giống yêu cầu retry.'),
            { statusCode: 409 }
          );
        }
        return { document: existing, idempotent: true as const };
      }
      const duplicateCodeResult = await client.query(
        `SELECT document_id FROM app_documents
         WHERE collection_name = 'pcnQualityDocuments'
           AND lower(COALESCE(data->>'documentCode', '')) = lower($1)
           AND COALESCE(data->>'version', '') = $2
         LIMIT 1 FOR UPDATE`,
        [candidate.documentCode, candidate.version]
      );
      if (duplicateCodeResult.rows.length > 0) {
        throw Object.assign(new Error('Mã và phiên bản tài liệu chất lượng đã tồn tại.'), { statusCode: 409 });
      }

      const write = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnQualityDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)
         RETURNING document_id, data`,
        [candidate.id, JSON.stringify(getDocumentPayload(candidate))]
      );
      const activityLog = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-quality-create', candidate.id),
        action: 'CREATED',
        entityType: 'PCN_QUALITY_DOCUMENT',
        entityId: candidate.id,
        entityLabel: candidate.documentCode,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Tạo tài liệu chất lượng/chỉ định PCN',
        changes: diffActivityFields({}, candidate, [
          'documentCode',
          'title',
          'category',
          'fieldCodes',
          'version',
          'status',
          'issuedAt',
          'effectiveFrom',
          'validUntil',
          'ownerUsername',
          'note',
        ]),
        source: 'UI',
        createdAt: candidate.createdAt,
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
        document: mapDocumentRow(write.rows[0]) as PcnQualityDocument,
        activityLog,
        idempotent: false as const,
      };
    });
    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN quality document create error:', error);
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
