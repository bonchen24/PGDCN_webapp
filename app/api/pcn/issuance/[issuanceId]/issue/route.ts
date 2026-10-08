import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonServerError,
} from '@/lib/server/response';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  PcnApprovalStep,
  PcnCertificationField,
  PcnDocumentRequirement,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnSignerDelegation,
  ReturnedTestResult,
} from '@/types';
import { buildActivityLog } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { toPcnUserAccount } from '@/utils/pcnAuth';
import {
  getPcnSignerActorDenial,
  getPcnSignerAuthorization,
} from '@/utils/pcnSignerAuthorization';
import {
  getPcnIssuanceOfficialDocumentReadiness,
  getPcnIssuanceReadiness,
  issuePcnIssuancePackage,
} from '@/utils/pcnIssuance';
import { normalizePcnIssuanceTimestamp } from '@/utils/pcnDossierDate';
import { buildPcnDossierDocumentContext } from '@/utils/pcnDocumentGeneration';
import { mergePcnTemplateCatalog } from '@/utils/pcnTemplateCatalog';
import { getPcnStorageBucket } from '@/lib/server/storage';
import { DATABASE_PROFILE } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ issuanceId: string }> },
) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Cấp số phát hành PCN chỉ khả dụng trong profile PCN.');
  }
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const { issuanceId: rawIssuanceId } = await params;
  const issuanceId = decodeURIComponent(String(rawIssuanceId || '')).trim();

  const body = await req.json().catch(() => ({}));
  const issuanceNumber = String(body?.issuanceNumber || '').trim();
  const signerUsername = String(body?.signerUsername || '').trim();
  const idempotencyKey = String(body?.idempotencyKey || '').trim();

  let issuedAt = '';
  try {
    issuedAt = normalizePcnIssuanceTimestamp(body?.issuedAt || new Date().toISOString());
  } catch (error: any) {
    return jsonBadRequest(String(error?.message || error));
  }

  if (!isSafePcnSampleKey(issuanceId) || !isSafePcnSampleKey(idempotencyKey) || !issuanceNumber || !signerUsername) {
    return jsonBadRequest('Cấp số phát hành phải có mã bộ phát hành, số phát hành, người ký và idempotencyKey hợp lệ.');
  }
  if (issuanceNumber.length > 120 || signerUsername.length > 120) {
    return jsonBadRequest('Số phát hành hoặc người ký vượt quá độ dài cho phép.');
  }

  const actor = getPcnSessionUser(req)!;
  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-issuance-issue:${issuanceId}:${idempotencyKey}`]);

      const issuanceResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'issuancePackages' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [issuanceId],
      );
      if (issuanceResult.rows.length === 0) throw Object.assign(new Error('Không tìm thấy bộ phát hành.'), { statusCode: 404 });
      const issuance = mapDocumentRow(issuanceResult.rows[0]) as IssuancePackage;

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [issuance.dossierId],
      );
      if (dossierResult.rows.length === 0) throw Object.assign(new Error('Không tìm thấy hồ sơ phát hành.'), { statusCode: 404 });
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      const fingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            issuanceId,
            issuanceNumber,
            signerUsername: signerUsername.toLowerCase(),
            issuedAt,
          }),
        )
        .digest('hex');

      const activityId = stablePcnMutationId('activity-pcn-issuance-issue', `${issuanceId}:${idempotencyKey}`);
      const existingActivityResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'activityLogs' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [activityId],
      );
      if (existingActivityResult.rows.length > 0) {
        const existingActivity = mapDocumentRow(existingActivityResult.rows[0]) as Record<string, any>;
        if (existingActivity.idempotencyFingerprint !== fingerprint) {
          throw Object.assign(new Error('idempotencyKey đã được dùng cho lần cấp số khác.'), { statusCode: 409 });
        }
        const existingActorUsername = String(existingActivity.actorUsername || '').trim().toLowerCase();
        if (existingActorUsername && existingActorUsername !== actor.username.trim().toLowerCase()) {
          throw Object.assign(new Error('Idempotency key của lần cấp số thuộc về một phiên thao tác khác.'), { statusCode: 403 });
        }
        return {
          issuance,
          dossier,
          authorization: {
            mode: existingActivity.authorizationMode === 'DELEGATED' ? ('DELEGATED' as const) : ('DIRECT' as const),
            ...(existingActivity.delegationId ? { delegationId: String(existingActivity.delegationId) } : {}),
          },
          activityLog: existingActivity,
          idempotent: true as const,
        };
      }

      if (issuance.status !== 'APPROVED') {
        throw Object.assign(new Error('Bộ phát hành chưa ở trạng thái được cấp số.'), { statusCode: 409 });
      }

      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`pcn-issuance-number:${issuanceNumber.toLowerCase()}`]);
      const duplicateNumberResult = await client.query(
        `SELECT document_id FROM app_documents
         WHERE collection_name = 'issuancePackages'
           AND document_id <> $1
           AND lower(COALESCE(data->>'issuanceNumber', '')) = lower($2)
         LIMIT 1 FOR UPDATE`,
        [issuanceId, issuanceNumber],
      );
      if (duplicateNumberResult.rows.length > 0) {
        throw Object.assign(new Error('Số phát hành đã được sử dụng cho bộ phát hành khác.'), { statusCode: 409 });
      }

      const proposalResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationProposals' AND document_id = $1
         LIMIT 1`,
        [dossier.proposalId],
      );
      const proposal = proposalResult.rows[0] ? (mapDocumentRow(proposalResult.rows[0]) as CertificationProposal) : undefined;
      const fieldCodes = Array.isArray(dossier.fieldCodes)
        ? dossier.fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean)
        : [];

      const [resultRows, approvalRows, userRows, delegationRows] = await Promise.all([
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'returnedResults' AND data->>'dossierId' = $1`,
          [dossier.id],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
           ORDER BY COALESCE((data->>'sequence')::int, 999), document_id`,
          [dossier.id],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'systemUsers'`,
        ),
        client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSignerDelegations' AND data->>'status' = 'ACTIVE'`,
        ),
      ]);

      const results = resultRows.rows.map((row: any) => mapDocumentRow(row)) as ReturnedTestResult[];
      const approvalSteps = approvalRows.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[];
      const users = userRows.rows.map((row: any) => toPcnUserAccount({ documentId: row.document_id, data: row.data || {} }));
      const delegations = delegationRows.rows.map((row: any) => mapDocumentRow(row)) as PcnSignerDelegation[];

      const authorization = getPcnSignerAuthorization({
        signerUsername,
        fieldCodes: Array.isArray(dossier.fieldCodes) ? dossier.fieldCodes : [],
        issuedAt,
        users,
        delegations,
      });
      if (!authorization.authorized) {
        throw Object.assign(new Error(authorization.reason), { statusCode: 403 });
      }

      const actorDenial = getPcnSignerActorDenial({
        actorUsername: actor.username,
        signerUsername,
        authorization,
      });
      if (actorDenial) {
        throw Object.assign(new Error(actorDenial), { statusCode: 403 });
      }

      const readiness = getPcnIssuanceReadiness(dossier, results, approvalSteps);
      if (!readiness.ready) {
        throw Object.assign(new Error(readiness.reasons.join('; ')), { statusCode: 409 });
      }
      if (!proposal) throw Object.assign(new Error('Không tìm thấy Đề nghị của hồ sơ phát hành.'), { statusCode: 404 });

      const [fieldsResult, requirementsResult, documentsResult, attachmentsResult, templateResult] = await Promise.all([
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnCertificationFields' AND data->>'code' = ANY($1::text[])`,
          [fieldCodes],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDocumentRequirements' AND COALESCE((data->>'active')::boolean, false) = true AND data->>'fieldCode' = ANY($1::text[])`,
          [fieldCodes],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`,
          [dossier.id],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierAttachments' AND data->>'dossierId' = $1`,
          [dossier.id],
        ),
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnTemplateDefinitions' AND data->>'fieldCode' = ANY($1::text[])`,
          [fieldCodes],
        ),
      ]);

      const officialContext = buildPcnDossierDocumentContext({
        dossier,
        proposal,
        fields: fieldsResult.rows.map(mapDocumentRow) as PcnCertificationField[],
        documents: documentsResult.rows.map(mapDocumentRow) as PcnDossierDocument[],
        documentRequirements: requirementsResult.rows.map(mapDocumentRow) as PcnDocumentRequirement[],
        attachments: attachmentsResult.rows.map(mapDocumentRow) as PcnDossierAttachment[],
      });

      const officialTemplates = mergePcnTemplateCatalog(
        templateResult.rows.map((row: any) => ({ ...row.data, id: row.document_id })) as any[],
      );
      const officialTemplateIds = new Set(
        officialTemplates
          .filter(
            (template) =>
              fieldCodes.includes(String(template.fieldCode).trim().toUpperCase()) &&
              ['CERTIFICATE', 'DECISION'].includes(template.documentKind),
          )
          .map((template) => template.fileAssetId)
          .filter((assetId): assetId is string => Boolean(assetId)),
      );

      const officialAssetResult = await client.query(
        `SELECT id, bucket_name, source_collection, source_document_id, source_json_path, mime_type
         FROM file_assets WHERE id = ANY($1::text[])`,
        [[...officialTemplateIds]],
      );
      const privateTemplateAssetIds = new Set<string>();
      for (const template of officialTemplates) {
        const asset = officialAssetResult.rows.find((row: any) => row.id === template.fileAssetId);
        if (
          asset &&
          String(asset.bucket_name) === getPcnStorageBucket() &&
          asset.source_collection === 'pcnTemplateDefinitions' &&
          asset.source_document_id === template.id &&
          asset.source_json_path === 'fileAssetId' &&
          asset.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ) {
          privateTemplateAssetIds.add(String(asset.id));
        }
      }

      const documentReadiness = getPcnIssuanceOfficialDocumentReadiness({
        context: officialContext,
        issuance: { issuanceNumber, issuedAt, signerUsername },
        templates: officialTemplates,
        fieldCodes,
        privateTemplateAssetIds,
      });
      if (!documentReadiness.ready) {
        throw Object.assign(new Error(`Tài liệu chính thức chưa sẵn sàng: ${documentReadiness.reasons.join('; ')}`), {
          statusCode: 409,
        });
      }

      const issued = issuePcnIssuancePackage(issuance, { issuanceNumber, signerUsername, issuedAt });
      const nextDossier = { ...dossier, status: 'ISSUED' as const, updatedAt: issued.updatedAt };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'issuancePackages' AND document_id = $1`,
        [issued.id, JSON.stringify(getDocumentPayload(issued))],
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
      );

      const log = {
        ...buildActivityLog({
          id: activityId,
          action: 'STATUS_CHANGED',
          entityType: 'PCN_ISSUANCE',
          entityId: issued.id,
          entityLabel: issued.issuanceNumber,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          summary: authorization.mode === 'DELEGATED' ? 'Cấp số với người ký được ủy quyền' : 'Cấp số với người ký trực tiếp',
          source: 'UI',
          changes: diffActivityFields(issuance, issued, ['status', 'issuanceNumber', 'signerUsername', 'issuedAt']),
        }),
        idempotencyKey,
        idempotencyFingerprint: fingerprint,
        authorizationMode: authorization.mode,
        ...(authorization.delegation ? { delegationId: authorization.delegation.id } : {}),
      };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [log.id, JSON.stringify(getDocumentPayload(log))],
      );

      return {
        issuance: issued,
        dossier: nextDossier,
        authorization: {
          mode: authorization.mode,
          ...(authorization.delegation ? { delegationId: authorization.delegation.id } : {}),
        },
        activityLog: log,
        idempotent: false,
      };
    });

    return jsonOk(result);
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = Number(error?.statusCode) || (message.includes('Không tìm thấy') ? 404 : 400);
    if (status === 404) return jsonNotFound(message);
    if (status === 403) return jsonForbidden(message);
    if (status === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
