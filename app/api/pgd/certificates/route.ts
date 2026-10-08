import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
} from '@/utils/pgdDomain';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.certificates, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const certificate = (await req.json().catch(() => ({}))) as PgdInspectionCertificate;
  if (!certificate?.id || certificate.domain !== 'pgd' || !certificate.requestId || !certificate.title) {
    return jsonBadRequest('Chứng thư PGD thiếu thông tin hồ sơ hoặc tiêu đề.');
  }

  let persistedCertificate: PgdInspectionCertificate | undefined;
  try {
    await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, certificate.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD của chứng thư.'), { statusCode: 404 });
      const currentRequest = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(currentRequest);
      assertPgdRequestStationMutationAllowed(currentRequest, 'REPORT_APPROVAL_RETURN');

      const reportResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`,
        [PGD_COLLECTIONS.reports, certificate.requestId],
      );
      if (!reportResult.rows[0]) throw Object.assign(new Error('Chưa có báo cáo giám định PGD đã kiểm tra để lập chứng thư.'), { statusCode: 409 });
      const sourceReport = mapDocumentRow(reportResult.rows[0]) as PgdInspectionReport;
      if (!sourceReport.templateSnapshot) throw Object.assign(new Error('Báo cáo PGD chưa có snapshot template để lập chứng thư.'), { statusCode: 409 });

      const existingResult = await client.query(
        `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.certificates, certificate.id],
      );
      if (existingResult.rows[0]?.data?.status === 'SIGNED' || certificate.status === 'SIGNED') {
        throw Object.assign(
          new Error('Chứng thư PGD đã ký hoặc đang mang trạng thái ký; chỉ thao tác phê duyệt lãnh đạo mới được ghi nhận chữ ký.'),
          { statusCode: 409 },
        );
      }

      const now = new Date().toISOString();
      const nextCertificate: PgdInspectionCertificate = {
        ...certificate,
        domain: 'pgd',
        standardSnapshot: [...currentRequest.standards],
        templateSnapshot: sourceReport.templateSnapshot,
        status: 'DRAFT',
        createdAt: certificate.createdAt || now,
        updatedAt: now,
      };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.certificates, nextCertificate.id, JSON.stringify(getDocumentPayload(nextCertificate))],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: nextCertificate.id,
        entityLabel: nextCertificate.title,
        requestCode: currentRequest.requestCode,
        summary: `Lập/cập nhật dự thảo chứng thư PGD cho ${currentRequest.requestCode}`,
        idSuffix: `certificate-${certificate.requestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_CERTIFICATE',
          action: 'UPDATED',
          entityId: nextCertificate.id,
          entityLabel: currentRequest.requestCode,
          requestCode: currentRequest.requestCode,
          actorName: actor.name || actor.username,
        }),
      });
      persistedCertificate = nextCertificate;
    });

    return jsonOk({ certificate: persistedCertificate || certificate });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
