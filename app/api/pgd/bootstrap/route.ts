import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { requirePgdSession } from '@/lib/server/pgd';
import { mapDocumentRow } from '@/lib/server/collections';
import { jsonOk, jsonServerError } from '@/lib/server/response';
import { sanitizePcnUserRow } from '@/lib/server/users';
import {
  DEFAULT_PGD_CATALOG,
  getPgdActiveCatalog,
  isPgdCatalogRecordAllowed,
  mergePgdCatalogDefaults,
  PGD_COLLECTIONS,
  PgdCatalogItem,
} from '@/utils/pgdDomain';
import {
  getPgdDocumentTemplates,
  isPgdDocumentTemplateRecordAllowed,
  normalizePgdDocumentTemplate,
  PgdDocumentTemplate,
} from '@/utils/pgdDocumentTemplates';
import { inspectPgdTemplateSource } from '@/utils/pgdTemplatePack';

function projectPgdDocumentTemplate(template: PgdDocumentTemplate): PgdDocumentTemplate {
  return { ...template, sourceInspection: inspectPgdTemplateSource(template) };
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  try {
    const collections = [
      PGD_COLLECTIONS.catalog,
      PGD_COLLECTIONS.requests,
      PGD_COLLECTIONS.assignments,
      PGD_COLLECTIONS.fieldInspections,
      PGD_COLLECTIONS.samples,
      PGD_COLLECTIONS.labRequests,
      PGD_COLLECTIONS.labResults,
      PGD_COLLECTIONS.resultTemplates,
      PGD_COLLECTIONS.documentTemplates,
      PGD_COLLECTIONS.reports,
      PGD_COLLECTIONS.certificates,
      PGD_COLLECTIONS.approvals,
      PGD_COLLECTIONS.dossierDocuments,
      PGD_COLLECTIONS.documents,
      PGD_COLLECTIONS.inspectionPlans,
      PGD_COLLECTIONS.caseEvents,
      PGD_COLLECTIONS.fieldActivityLogs,
      PGD_COLLECTIONS.labResultReviews,
      PGD_COLLECTIONS.dossierIndexes,
      PGD_COLLECTIONS.calibrationInstruments,
      PGD_COLLECTIONS.workflowTemplates,
    ];

    const results = await Promise.all(
      collections.map((collection) =>
        pool.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'domain' = 'pgd' ORDER BY document_id`,
          [collection],
        ),
      ),
    );

    const items = results.map((result) => result.rows.map((row: any) => mapDocumentRow(row)));
    const [customerResult, userResult] = await Promise.all([
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'customers' ORDER BY document_id`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'systemUsers' ORDER BY document_id`),
    ]);

    const pgdUsers = userResult.rows
      .map(sanitizePcnUserRow)
      .filter((user: any) => user.departmentScopes?.includes('PGD'));

    const persistedDocumentTemplates = items[8].filter(isPgdDocumentTemplateRecordAllowed) as PgdDocumentTemplate[];
    const documentTemplatesById = new Map(getPgdDocumentTemplates().map((template) => [template.id, template]));
    for (const template of persistedDocumentTemplates) {
      documentTemplatesById.set(template.id, normalizePgdDocumentTemplate(template));
    }

    const persistedCatalog = items[0].filter(isPgdCatalogRecordAllowed) as PgdCatalogItem[];
    const activeCatalog = getPgdActiveCatalog(mergePgdCatalogDefaults(persistedCatalog));

    return jsonOk({
      customers: customerResult.rows.map((row: any) => mapDocumentRow(row)),
      users: pgdUsers,
      catalog: activeCatalog.length > 0 ? activeCatalog : getPgdActiveCatalog(DEFAULT_PGD_CATALOG),
      requests: items[1].filter((request: any) => !request.deletedAt),
      assignments: items[2],
      fieldInspections: items[3],
      samples: items[4],
      labRequests: items[5],
      labResults: items[6],
      templates: items[7],
      documentTemplates: Array.from(documentTemplatesById.values())
        .filter((template) => template.active && template.status !== 'RETIRED')
        .map(projectPgdDocumentTemplate),
      reports: items[9],
      certificates: items[10],
      approvals: items[11],
      dossierDocuments: items[12],
      documents: items[13],
      inspectionPlans: items[14],
      caseEvents: items[15],
      fieldActivityLogs: items[16],
      labResultReviews: items[17],
      dossierIndexes: items[18],
      calibrationInstruments: items[19],
      workflowTemplates: items[20].filter((template: any) => template?.domain === 'pgd'),
    });
  } catch (error: any) {
    console.error('PGD bootstrap error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
