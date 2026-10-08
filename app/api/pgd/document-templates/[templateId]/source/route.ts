import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import { pool } from '@/lib/server/db';
import { requirePgdSession } from '@/lib/server/pgd';
import { mapDocumentRow } from '@/lib/server/collections';
import { jsonConflict, jsonNotFound, jsonServerError } from '@/lib/server/response';
import {
  getPgdDocumentTemplates,
  isPgdDocumentTemplateRecordAllowed,
  normalizePgdDocumentTemplate,
} from '@/utils/pgdDocumentTemplates';
import { inspectPgdTemplateSource, resolvePgdTemplateSourcePath } from '@/utils/pgdTemplatePack';
import { PGD_COLLECTIONS } from '@/utils/pgdDomain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  try {
    const { templateId } = await params;
    const requestedId = decodeURIComponent(String(templateId || '')).trim();

    const result = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
      [PGD_COLLECTIONS.documentTemplates, requestedId],
    );
    const persisted = result.rows[0] ? mapDocumentRow(result.rows[0]) : undefined;
    const template =
      persisted && isPgdDocumentTemplateRecordAllowed(persisted)
        ? normalizePgdDocumentTemplate(persisted)
        : getPgdDocumentTemplates().find((candidate) => candidate.id === requestedId);

    if (!template) {
      return jsonNotFound('Không tìm thấy template DOCX PGD.');
    }

    const inspection = inspectPgdTemplateSource(template);
    const sourcePath = resolvePgdTemplateSourcePath(template);
    if (!sourcePath || inspection.status !== 'READY') {
      return jsonConflict(inspection.message || 'File DOCX nguồn PGD chưa sẵn sàng.');
    }

    const fileBuffer = fs.readFileSync(sourcePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${template.fileName.replace(/"/g, '_')}"`,
        'Content-Length': String(fileBuffer.byteLength),
      },
    });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
