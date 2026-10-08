import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdApprovalStep,
  PgdInspectionCertificate,
  PgdInspectionRequest,
  getPgdApprovalDenial,
} from '@/utils/pgdDomain';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  buildPgdDossierPackageSnapshot,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
}

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.approvals, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const step = (await req.json().catch(() => ({}))) as PgdApprovalStep;
  if (!step?.id || step.domain !== 'pgd' || !step.requestId || !step.role) {
    return jsonBadRequest('Bước phê duyệt PGD thiếu thông tin.');
  }
  if (!['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL'].includes(step.role)) {
    return jsonBadRequest('Vai trò phê duyệt PGD không hợp lệ.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, step.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD để phê duyệt.'), { statusCode: 404 });
      const current = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(current);
      assertPgdRequestStationMutationAllowed(current, 'REPORT_APPROVAL_RETURN');

      const approvalDenial = getPgdApprovalDenial(current.status, step.role, actor);
      if (approvalDenial) throw Object.assign(new Error(approvalDenial), { statusCode: 403 });

      if (step.role === 'LEADERSHIP_APPROVAL') {
        const technicalApproval = await client.query(
          `SELECT document_id FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' AND data->>'requestId' = $2 AND data->>'role' = 'TECHNICAL_REVIEW' AND data->>'status' = 'APPROVED' LIMIT 1`,
          [PGD_COLLECTIONS.approvals, step.requestId],
        );
        if (!technicalApproval.rows[0]) {
          throw Object.assign(new Error('Hồ sơ PGD phải được phê duyệt chuyên môn trước khi trình lãnh đạo.'), { statusCode: 409 });
        }
      }

      const packageSnapshot = await buildPgdDossierPackageSnapshot(client, current);
      if (!packageSnapshot.manifest.complete) {
        throw Object.assign(
          new Error(
            `Bộ hồ sơ PGD chưa hoàn chỉnh: thiếu ${packageSnapshot.manifest.missingRequirementCodes.length} mục checklist hoặc ${packageSnapshot.manifest.missingAssetIds.length} file private.`,
          ),
          { statusCode: 409 },
        );
      }

      const packageManifestHash = createHash('sha256').update(stableJson(packageSnapshot.manifest)).digest('hex');
      const now = new Date().toISOString();
      const approvedStep = {
        ...step,
        sequence: step.role === 'TECHNICAL_REVIEW' ? 1 : 2,
        status: 'APPROVED' as const,
        actedByUsername: actor.username,
        actedAt: now,
        packageManifestHash,
        packageManifestSnapshot: packageSnapshot.manifest,
      };

      let nextStatus = current.status;
      if (step.role === 'LEADERSHIP_APPROVAL') nextStatus = 'SIGNED';
      const nextRequest = { ...current, status: nextStatus, updatedAt: now };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.approvals, approvedStep.id, JSON.stringify(getDocumentPayload(approvedStep))],
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(nextRequest)), step.requestId],
      );

      let certificate: PgdInspectionCertificate | undefined;
      if (step.role === 'LEADERSHIP_APPROVAL') {
        const reportResult = await client.query(
          `SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`,
          [PGD_COLLECTIONS.reports, step.requestId],
        );
        if (!reportResult.rows[0]?.data?.templateSnapshot || !String(reportResult.rows[0]?.data?.conclusion || '').trim()) {
          throw Object.assign(new Error('Báo cáo PGD chưa đủ snapshot/kết luận để trình lãnh đạo phê duyệt.'), { statusCode: 409 });
        }
        const certificateResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
          [PGD_COLLECTIONS.certificates, step.requestId],
        );
        if (!certificateResult.rows[0]) {
          throw Object.assign(new Error('Chưa có dự thảo chứng thư PGD để lãnh đạo ký.'), { statusCode: 409 });
        }
        const currentCertificate = mapDocumentRow(certificateResult.rows[0]) as PgdInspectionCertificate;
        if (currentCertificate.status !== 'DRAFT' || !currentCertificate.templateSnapshot) {
          throw Object.assign(new Error('Chứng thư PGD chưa ở trạng thái dự thảo hợp lệ để trình ký.'), { statusCode: 409 });
        }
        certificate = { ...currentCertificate, status: 'SIGNED', signedByUsername: actor.username, signedAt: now, updatedAt: now };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
          [PGD_COLLECTIONS.certificates, JSON.stringify(getDocumentPayload(certificate)), certificate.id],
        );
      }

      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: approvedStep.id,
        entityLabel: step.role === 'TECHNICAL_REVIEW' ? 'Phê duyệt chuyên môn PGD' : 'Phê duyệt lãnh đạo PGD',
        requestCode: current.requestCode,
        summary: `${step.role === 'TECHNICAL_REVIEW' ? 'Phê duyệt chuyên môn' : 'Phê duyệt lãnh đạo'} hồ sơ ${current.requestCode}`,
        idSuffix: `approval-${step.role}-${step.requestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_APPROVAL',
          action: 'STATUS_CHANGED',
          entityId: approvedStep.id,
          entityLabel: current.requestCode,
          requestCode: current.requestCode,
          previousStatus: current.status,
          nextStatus,
          actorName: actor.name || actor.username,
        }),
      });

      return { approval: approvedStep, request: nextRequest, ...(certificate ? { certificate } : {}) };
    });

    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
