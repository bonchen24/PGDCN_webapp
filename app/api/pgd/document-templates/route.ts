import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { requirePgdSession } from '@/lib/server/pgd';
import { mapDocumentRow } from '@/lib/server/collections';
import { jsonOk, jsonServerError } from '@/lib/server/response';
import {
  getPgdDocumentTemplates,
  isPgdDocumentTemplateRecordAllowed,
  normalizePgdDocumentTemplate,
  PgdDocumentTemplate,
} from '@/utils/pgdDocumentTemplates';
import { inspectPgdTemplateSource } from '@/utils/pgdTemplatePack';
import { PGD_COLLECTIONS } from '@/utils/pgdDomain';

function projectPgdDocumentTemplate(template: PgdDocumentTemplate): PgdDocumentTemplate {
  return { ...template, sourceInspection: inspectPgdTemplateSource(template) };
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  try {
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' ORDER BY document_id`,
      [PGD_COLLECTIONS.documentTemplates],
    );
    const persisted = result.rows
      .map((row: any) => mapDocumentRow(row))
      .filter(isPgdDocumentTemplateRecordAllowed) as PgdDocumentTemplate[];

    const byId = new Map(getPgdDocumentTemplates().map((template) => [template.id, template]));
    for (const template of persisted) {
      byId.set(template.id, normalizePgdDocumentTemplate(template));
    }

    return jsonOk({
      templates: Array.from(byId.values())
        .filter((template) => template.active && template.status !== 'RETIRED')
        .map(projectPgdDocumentTemplate),
    });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
