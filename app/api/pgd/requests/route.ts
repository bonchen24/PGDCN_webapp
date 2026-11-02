import { NextRequest } from 'next/server';
import { pool, withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonCreated } from '@/lib/server/response';
import {
  DEFAULT_PGD_CATALOG,
  formatPgdRequestCode,
  getPgdActiveCatalog,
  getPgdVietnamDateKey,
  isPgdCatalogRecordAllowed,
  mergePgdCatalogDefaults,
  PGD_COLLECTIONS,
  PgdCatalogItem,
  PgdInspectionRequest,
  PgdInspectionRequestCreateInput,
  PgdSample,
  createPgdInspectionRequest,
  createPgdSampleFromIntakeDraft,
  validatePgdIntakeSampleDrafts,
} from '@/utils/pgdDomain';
import { buildPgdDossierChecklist } from '@/utils/pgdDossier';
import { selectPgdPublishedWorkflowTemplate, snapshotPgdWorkflowTemplate, type PgdWorkflowTemplate } from '@/utils/pgdWorkflowTemplate';
import { writePgdActivity } from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.requests, 'write');
  if (mutationError) return mutationError;

  try {
    const actor = getPgdSessionUser(req)!;
    const input = (await req.json().catch(() => ({}))) as PgdInspectionRequestCreateInput;

    const sampleDrafts = Array.isArray(input.sampleDrafts) ? input.sampleDrafts : [];
    const sampleIssues = validatePgdIntakeSampleDrafts(sampleDrafts);
    if (sampleIssues.length > 0) {
      return jsonBadRequest(`Dữ liệu mẫu PGD chưa hợp lệ: ${sampleIssues.map((issue) => issue.field).join(', ')}`);
    }

    const { sampleDrafts: _sampleDrafts, ...requestInput } = input;
    const catalogResult = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' ORDER BY document_id`,
      [PGD_COLLECTIONS.catalog],
    );
    const persistedCatalog = catalogResult.rows
      .map((row: any) => mapDocumentRow(row))
      .filter(isPgdCatalogRecordAllowed) as PgdCatalogItem[];
    const activeCatalog = getPgdActiveCatalog(mergePgdCatalogDefaults(persistedCatalog));
    const catalog = activeCatalog.length > 0 ? activeCatalog : getPgdActiveCatalog(DEFAULT_PGD_CATALOG);
    const now = new Date().toISOString();

    const result = await withPgTransaction(async (client) => {
      const existing = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, input.id],
      );
      if (existing.rows[0]) {
        return { request: mapDocumentRow(existing.rows[0]) as PgdInspectionRequest, samples: [] as PgdSample[] };
      }

      const vietnamDateKey = getPgdVietnamDateKey(new Date(now));
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`pgd-request-sequence:${vietnamDateKey}`]);
      const serialResult = await client.query(
        `SELECT COALESCE(MAX(CAST(substring(data->>'requestCode' FROM '^PGD-[0-9]{6}-([0-9]{2})$') AS INTEGER)), 0) AS last_serial
           FROM app_documents
          WHERE collection_name = $1
            AND data->>'domain' = 'pgd'
            AND data->>'requestCode' ~ $2`,
        [PGD_COLLECTIONS.requests, `^PGD-${vietnamDateKey}-[0-9]{2}$`],
      );
      const nextSerial = Number(serialResult.rows[0]?.last_serial || 0) + 1;
      const requestCode = formatPgdRequestCode(nextSerial, new Date(now));

      const createdRequest = createPgdInspectionRequest(
        {
          ...requestInput,
          requestCode,
          ownerUsername: actor.username,
          ownerAssignedAt: now,
        },
        now,
        catalog,
      );

      const workflowTemplateResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' AND data->>'status' = 'PUBLISHED'`,
        [PGD_COLLECTIONS.workflowTemplates],
      );
      const workflowTemplate = selectPgdPublishedWorkflowTemplate(
        workflowTemplateResult.rows.map((row: any) => mapDocumentRow(row) as PgdWorkflowTemplate),
        { productGroup: createdRequest.productGroup, methodCode: String(createdRequest.assessmentMethod || createdRequest.method || '').trim().toUpperCase() || undefined },
      );
      const workflowSnapshot = workflowTemplate
        ? snapshotPgdWorkflowTemplate(workflowTemplate, { capturedAt: now, capturedBy: actor.username })
        : undefined;

      const samples = sampleDrafts.map((draft) =>
        createPgdSampleFromIntakeDraft(createdRequest.id, draft, actor.username, now),
      );

      const request = {
        ...createdRequest,
        sampleIds: samples.map((sample) => sample.id),
        ...(workflowTemplate ? { workflowTemplateId: workflowTemplate.id, workflowTemplateVersion: workflowTemplate.version } : {}),
        ...(workflowSnapshot ? { workflowSnapshot } : {}),
        dossierChecklist: buildPgdDossierChecklist(createdRequest.productGroup, now, workflowSnapshot?.requirementDefinitions || [], workflowSnapshot?.stages || []),
      };

      const duplicateCode = await client.query(
        `SELECT document_id FROM app_documents
         WHERE collection_name = $1 AND lower(trim(data->>'requestCode')) = lower(trim($2))
         LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, request.requestCode],
      );
      if (duplicateCode.rows[0]) {
        throw Object.assign(new Error(`Mã PYC PGD ${request.requestCode} đã tồn tại.`), { statusCode: 409 });
      }

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`,
        [PGD_COLLECTIONS.requests, request.id, JSON.stringify(getDocumentPayload(request))],
      );

      for (const sample of samples) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`,
          [PGD_COLLECTIONS.samples, sample.id, JSON.stringify(getDocumentPayload(sample))],
        );
      }

      await writePgdActivity(client, actor, {
        action: 'CREATED',
        entityId: request.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Tiếp nhận PYC giám định ${request.requestCode}${samples.length > 0 ? ` và ${samples.length} mẫu` : ''}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_REQUEST',
          action: 'CREATED',
          entityId: request.id,
          entityLabel: request.requestCode,
          requestCode: request.requestCode,
          actorName: actor.name || actor.username,
        }),
      });

      return { request, samples };
    });

    return jsonCreated(result);
  } catch (error: any) {
    console.error('PGD request create error:', error);
    return jsonBadRequest(error?.message || String(error));
  }
}
