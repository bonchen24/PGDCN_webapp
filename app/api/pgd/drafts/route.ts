import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { pool, withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation, requirePgdSession } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonNotFound, jsonOk, jsonServerError } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdDraftWorkspace,
  PgdInspectionRequest,
} from '@/utils/pgdDomain';
import {
  getPgdDossierRequirementForTemplate,
  getPgdDossierRequirements,
} from '@/utils/pgdDossier';
import {
  getPgdDocumentTemplates,
  isPgdDocumentTemplateRecordAllowed,
  normalizePgdDocumentTemplate,
  PgdDocumentTemplateFormat,
} from '@/utils/pgdDocumentTemplates';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  const { searchParams } = new URL(req.url);
  const requestId = String(searchParams.get('requestId') || '').trim();

  try {
    const params: unknown[] = [PGD_COLLECTIONS.drafts];
    const requestClause = requestId ? ` AND data->>'requestId' = $${params.push(requestId)}` : '';
    const result = await pool.query(
      `SELECT document_id, data
         FROM app_documents
        WHERE collection_name = $1
          AND data->>'domain' = 'pgd'
          AND COALESCE(data->>'status', 'DRAFT') = 'DRAFT'${requestClause}
        ORDER BY updated_at DESC, document_id DESC`,
      params,
    );
    return jsonOk({ items: result.rows.map((row: any) => mapDocumentRow(row)) });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.drafts, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const input = (await req.json().catch(() => ({}))) || {};
  const requestId = String(input.requestId || '').trim();
  const requirementCode = String(input.requirementCode || '').trim().toUpperCase();
  const requestedTemplateId = String(input.templateId || '').trim();
  const requestedTemplateKind = String(input.templateKind || '').trim().toUpperCase();
  const requestedTemplateVersion = String(input.templateVersion || '').trim();
  const format = String(input.format || '').trim().toUpperCase() as PgdDocumentTemplateFormat;
  const title = String(input.title || '').trim().replace(/\s+/g, ' ').slice(0, 240);
  const cellValues = input.cellValues && typeof input.cellValues === 'object' && !Array.isArray(input.cellValues) ? input.cellValues as Record<string, unknown> : undefined;

  if (!requestId || !requirementCode || !requestedTemplateId || !title || !cellValues || !['DOCX', 'PDF'].includes(format)) {
    return jsonBadRequest('Bản nháp PGD cần requestId, requirementCode, tiêu đề, template, định dạng và cell values hợp lệ.');
  }

  try {
    const draft = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD để lưu bản nháp.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      const requirement = getPgdDossierRequirements(request.productGroup).find((item) => item.code === requirementCode);
      if (!requirement) throw Object.assign(new Error('Requirement của bản nháp không thuộc nhóm sản phẩm hồ sơ PGD.'), { statusCode: 400 });

      const templateResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
        [PGD_COLLECTIONS.documentTemplates, requestedTemplateId],
      );
      const persistedTemplate = templateResult.rows[0] ? mapDocumentRow(templateResult.rows[0]) : undefined;
      const template = persistedTemplate && isPgdDocumentTemplateRecordAllowed(persistedTemplate)
        ? normalizePgdDocumentTemplate(persistedTemplate)
        : getPgdDocumentTemplates().find((candidate) => candidate.id === requestedTemplateId);
      if (!template || !template.active || template.status === 'RETIRED') {
        throw Object.assign(new Error('Template PGD không còn hoạt động hoặc không tồn tại.'), { statusCode: 400 });
      }
      if ((requestedTemplateKind && requestedTemplateKind !== template.kind) || (requestedTemplateVersion && requestedTemplateVersion !== template.version)) {
        throw Object.assign(new Error('Template bản nháp không còn tương thích với catalog hiện hành.'), { statusCode: 409 });
      }
      const mappedRequirement = getPgdDossierRequirementForTemplate(template.kind, request.productGroup);
      if (!mappedRequirement || mappedRequirement.code !== requirement.code) {
        throw Object.assign(new Error('Template bản nháp không khớp với requirement đang mở.'), { statusCode: 400 });
      }
      if (!template.formats.includes(format)) {
        throw Object.assign(new Error(`Template ${template.code} không hỗ trợ định dạng ${format}.`), { statusCode: 400 });
      }

      const draftId = String(input.id || '').trim() || `pgd-draft-${randomUUID()}`;
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.drafts, draftId],
      );
      const existing = existingResult.rows[0] ? (mapDocumentRow(existingResult.rows[0]) as PgdDraftWorkspace) : undefined;
      if (existing && (existing.requestId !== requestId || existing.requirementCode !== requirement.code || existing.templateId !== template.id)) {
        throw Object.assign(new Error('Không thể ghi đè bản nháp của hồ sơ, requirement hoặc template khác.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const next: PgdDraftWorkspace = {
        id: draftId,
        domain: 'pgd',
        requestId,
        requirementCode: requirement.code,
        title,
        templateId: template.id,
        templateKind: template.kind,
        templateVersion: template.version,
        format,
        cellValues,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        status: 'DRAFT',
        ...(existing?.createdByUsername || actor.username ? { createdByUsername: existing?.createdByUsername || actor.username } : {}),
        updatedByUsername: actor.username,
      };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.drafts, next.id, JSON.stringify(getDocumentPayload(next))],
      );
      return next;
    });

    return jsonOk({ draft });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
