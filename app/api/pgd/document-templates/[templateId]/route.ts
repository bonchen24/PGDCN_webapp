import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonForbidden, jsonOk, jsonServerError } from '@/lib/server/response';
import {
  normalizePgdTemplateCells,
  validatePgdDocumentTemplate,
  PgdDocumentTemplate,
} from '@/utils/pgdDocumentTemplates';
import { inspectPgdTemplateSource } from '@/utils/pgdTemplatePack';
import { PGD_COLLECTIONS } from '@/utils/pgdDomain';
import { writePgdActivity } from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.documentTemplates, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const role = String(actor.pgdRole || '').toUpperCase();
  if (actor.systemRole !== 'admin' && actor.role !== 'admin' && !['PGD_ADMIN', 'PGD_MANAGER'].includes(role)) {
    return jsonForbidden('Chỉ quản trị viên hoặc Quản lý có scope PGD được quản lý template DOCX.');
  }

  try {
    const { templateId } = await params;
    const requestedId = decodeURIComponent(String(templateId || '')).trim();
    const incoming = ((await req.json().catch(() => ({}))) || {}) as Partial<PgdDocumentTemplate>;

    const candidate = {
      ...incoming,
      id: requestedId,
      domain: 'pgd' as const,
      cells: normalizePgdTemplateCells(Array.isArray(incoming.cells) ? incoming.cells : []),
      active: incoming.status !== 'RETIRED',
    } as Partial<PgdDocumentTemplate>;

    const issues = validatePgdDocumentTemplate(candidate);
    if (issues.length > 0) {
      return jsonBadRequest(`Template PGD chưa hợp lệ: ${issues.join(' ')}`);
    }

    const sourceInspection = inspectPgdTemplateSource(candidate as PgdDocumentTemplate);
    if (sourceInspection.status !== 'READY') {
      return jsonBadRequest(sourceInspection.message || 'File DOCX nguồn PGD chưa khớp placeholder metadata.');
    }

    const persisted = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.documentTemplates, requestedId],
      );
      const existing = existingResult.rows[0] ? (mapDocumentRow(existingResult.rows[0]) as PgdDocumentTemplate) : undefined;
      const isPublished = existing?.status === 'PUBLISHED';
      const nextId = isPublished ? `${requestedId}-v${Date.now()}` : requestedId;
      const nextVersion = isPublished
        ? `${String(existing?.version || candidate.version || '1.0')
            .split('.')
            .map((part) => Number(part) || 0)
            .map((part, index) => (index === 1 ? part + 1 : part))
            .join('.')}`
        : String(candidate.version || existing?.version || '1.0');

      const next = {
        ...(candidate as PgdDocumentTemplate),
        id: nextId,
        version: nextVersion,
        status: String(candidate.status || 'DRAFT') as PgdDocumentTemplate['status'],
        ...(isPublished ? { supersedesTemplateId: requestedId } : {}),
        updatedAt: new Date().toISOString(),
      } as PgdDocumentTemplate & { supersedesTemplateId?: string; updatedAt: string };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.documentTemplates, next.id, JSON.stringify(getDocumentPayload(next))],
      );

      await writePgdActivity(client, actor, {
        action: existing ? 'UPDATED' : 'CREATED',
        entityId: next.id,
        entityLabel: next.code,
        summary: `${existing ? 'Cập nhật' : 'Tạo mới'} template DOCX PGD ${next.code} phiên bản ${next.version}`,
        idSuffix: `template-${next.id}`,
      });

      return next;
    });

    return jsonOk({ template: persisted });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
