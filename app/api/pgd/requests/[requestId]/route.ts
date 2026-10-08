import { NextRequest } from 'next/server';
import { pool, withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdSession } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  DEFAULT_PGD_CATALOG,
  getPgdActiveCatalog,
  getPgdDossierDeletionDenial,
  getPgdDossierEditDenial,
  isPgdCatalogRecordAllowed,
  mergePgdCatalogDefaults,
  normalizePgdInspectionRequestEdit,
  PGD_COLLECTIONS,
  PgdCatalogItem,
  PgdInspectionRequest,
  updatePgdInspectionRequest,
} from '@/utils/pgdDomain';
import { writePgdActivity } from '@/lib/server/pgd-operations';
import { hardDeleteOwnedDocumentGraph } from '@/lib/server/pcn-dossiers';
import { deleteOwnedFileAssets } from '@/lib/server/storage';
import { diffActivityFields } from '@/utils/activityLog';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  const actor = getPgdSessionUser(req)!;
  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const patch = normalizePgdInspectionRequestEdit(body);
  if (!requestId) return jsonBadRequest('Thiếu mã hồ sơ PGD.');
  if (Object.keys(patch).length === 0) return jsonBadRequest('Không có thông tin hồ sơ PGD hợp lệ để cập nhật.');

  try {
    const catalogResult = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' ORDER BY document_id`,
      [PGD_COLLECTIONS.catalog],
    );
    const persistedCatalog = catalogResult.rows
      .map((row: any) => mapDocumentRow(row))
      .filter(isPgdCatalogRecordAllowed) as PgdCatalogItem[];
    const activeCatalog = getPgdActiveCatalog(mergePgdCatalogDefaults(persistedCatalog));
    const catalog = activeCatalog.length > 0 ? activeCatalog : getPgdActiveCatalog(DEFAULT_PGD_CATALOG);

    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
           WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd'
           LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });
      const current = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;

      const denial = getPgdDossierEditDenial(current, actor);
      if (denial) {
        const statusCode = /đã ký|đã ký\/trả|thu hồi|khóa/i.test(denial) ? 409 : 403;
        throw Object.assign(new Error(denial), { statusCode });
      }
      if (current.deletedAt) throw Object.assign(new Error('Hồ sơ PGD đã bị xóa, không thể sửa.'), { statusCode: 409 });

      const now = new Date().toISOString();
      const next = updatePgdInspectionRequest(current, patch, now, catalog);

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(next)), requestId],
      );

      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityType: 'PGD_REQUEST',
        entityId: next.id,
        entityLabel: next.requestCode,
        requestCode: next.requestCode,
        summary: `Cập nhật thông tin hồ sơ PGD ${next.requestCode}`,
        changes: diffActivityFields(current, next, [
          'intakeChannel', 'requester', 'customerSnapshot', 'productName', 'productCode', 'brand', 'productDetails',
          'quantity', 'unit', 'weight', 'weightUnit', 'lotCode', 'transportName', 'inspectionScope',
          'inspectionLocation', 'inspectionScheduledAt', 'standards', 'method', 'assessmentMethod',
          'registryMetadata', 'targetDate', 'note',
        ]),
        idSuffix: `edit-${next.id}-${now}`,
      });

      return next;
    });

    return jsonOk({ request: result });
  } catch (error: any) {
    console.error('PGD request update error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404) return jsonNotFound(error?.message || String(error));
    if (statusCode === 403) return jsonForbidden(error?.message || String(error));
    if (statusCode === 409) return jsonConflict(error?.message || String(error));
    return jsonBadRequest(error?.message || String(error));
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  const actor = getPgdSessionUser(req)!;
  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const reason = String(body?.reason || '').trim();
  const confirmationCode = String(body?.confirmationCode || '').trim();

  if (!requestId) return jsonBadRequest('Thiếu mã hồ sơ PGD.');
  if (!reason || reason.length > 1000 || !confirmationCode) {
    return jsonBadRequest('Xóa hồ sơ PGD phải có lý do tối đa 1000 ký tự và mã xác nhận.');
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

      const denial = getPgdDossierDeletionDenial(current, actor);
      if (denial) {
        const statusCode = denial.includes('không thể xóa') ? 409 : 403;
        throw Object.assign(new Error(denial), { statusCode });
      }
      if (confirmationCode !== current.requestCode) {
        throw Object.assign(new Error('Mã xác nhận không khớp với mã hồ sơ PGD.'), { statusCode: 409 });
      }

      await writePgdActivity(client, actor, {
        action: 'DELETED',
        entityType: 'PGD_REQUEST',
        entityId: current.id,
        entityLabel: current.requestCode,
        requestCode: current.requestCode,
        summary: `Xóa vĩnh viễn hồ sơ PGD ${current.requestCode}: ${reason}`,
        idSuffix: `hard-delete-${current.id}-${Date.now()}`,
      });

      const deletedAssets = await hardDeleteOwnedDocumentGraph(client, {
        parentCollection: PGD_COLLECTIONS.requests,
        parentId: current.id,
        relationField: 'requestId',
      });

      return { requestId: current.id, requestCode: current.requestCode, deletedAssets };
    });

    await deleteOwnedFileAssets(result.deletedAssets, 'pgd');
    return jsonOk({ deleted: true, requestId: result.requestId, requestCode: result.requestCode });
  } catch (error: any) {
    console.error('PGD request delete error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404) return jsonNotFound(error?.message || String(error));
    if (statusCode === 403) return jsonForbidden(error?.message || String(error));
    if (statusCode === 409) return jsonConflict(error?.message || String(error));
    return jsonBadRequest(error?.message || String(error));
  }
}
