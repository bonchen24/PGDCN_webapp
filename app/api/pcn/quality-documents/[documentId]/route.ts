import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, isSessionAdmin } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { diffActivityFields } from '@/utils/activityLog';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { isSafePcnSampleKey } from '@/lib/server/workflow-templates';
import { stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { buildPcnQualityDocument } from '@/lib/server/pcn-quality-documents';
import { PcnQualityDocument } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> | { documentId: string } }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!isSessionAdmin(actor)) {
    return jsonForbidden('Chỉ Admin mới có quyền thực hiện thao tác này.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const documentId = decodeURIComponent(String(resolvedParams.documentId || '')).trim();
  if (!isSafePcnSampleKey(documentId)) {
    return jsonError('Mã tài liệu chất lượng PCN không hợp lệ.', 400);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const updates = body?.updates;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return jsonError('Thiếu metadata cập nhật tài liệu chất lượng PCN.', 400);
  }
  const allowedFields = [
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
  ] as const;
  const unknownFields = Object.keys(updates).filter(
    (field) => !(allowedFields as readonly string[]).includes(field)
  );
  if (unknownFields.length > 0) {
    return jsonError(
      `Trường cập nhật tài liệu chất lượng không được phép: ${unknownFields.join(', ')}`,
      400
    );
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnQualityDocuments' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [documentId]
      );
      if (existingResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy tài liệu chất lượng PCN.'), { statusCode: 404 });
      }
      const existing = mapDocumentRow(existingResult.rows[0]) as PcnQualityDocument;
      let built: PcnQualityDocument;
      try {
        built = buildPcnQualityDocument(
          { ...existing, ...updates, id: documentId },
          new Date().toISOString()
        );
      } catch (error: any) {
        throw Object.assign(new Error(String(error?.message || error)), { statusCode: 400 });
      }
      const next: PcnQualityDocument = {
        ...built,
        ...(existing.createdAt ? { createdAt: existing.createdAt } : {}),
      };
      const changes = diffActivityFields(existing, next, [...allowedFields]);
      if (changes.length === 0) return { document: existing, idempotent: true as const };

      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `pcn-quality-code:${next.documentCode.toLowerCase()}:${next.version}`,
      ]);
      const duplicateCodeResult = await client.query(
        `SELECT document_id FROM app_documents
         WHERE collection_name = 'pcnQualityDocuments'
           AND document_id <> $1
           AND lower(COALESCE(data->>'documentCode', '')) = lower($2)
           AND COALESCE(data->>'version', '') = $3
         LIMIT 1 FOR UPDATE`,
        [documentId, next.documentCode, next.version]
      );
      if (duplicateCodeResult.rows.length > 0) {
        throw Object.assign(new Error('Mã và phiên bản tài liệu chất lượng đã tồn tại.'), { statusCode: 409 });
      }

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnQualityDocuments' AND document_id = $1`,
        [documentId, JSON.stringify(getDocumentPayload(next))]
      );
      const activityLog = buildActivityLog({
        id: stablePcnMutationId(
          'activity-pcn-quality-update',
          `${documentId}:${JSON.stringify(changes)}`
        ),
        action: 'UPDATED',
        entityType: 'PCN_QUALITY_DOCUMENT',
        entityId: documentId,
        entityLabel: next.documentCode,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Cập nhật tài liệu chất lượng/chỉ định PCN',
        changes,
        source: 'UI',
        createdAt: next.updatedAt,
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw Object.assign(new Error(validationError), { statusCode: 400 });
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))]
      );
      return { document: next, activityLog, idempotent: false as const };
    });
    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN quality document update error:', error);
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
