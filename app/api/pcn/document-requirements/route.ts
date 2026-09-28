import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/postgres';
import { jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { mapDocumentRow } from '@/lib/server/helpers';

export async function GET(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('PCN document requirements chỉ khả dụng trong profile PCN.');
  }

  const { searchParams } = new URL(req.url);
  const fieldCodes = String(searchParams.get('fieldCodes') || '')
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  try {
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'pcnDocumentRequirements'
         AND COALESCE((data->>'active')::boolean, false) = true
         AND ($1::text[] = '{}' OR data->>'fieldCode' = ANY($1::text[]))
       ORDER BY COALESCE((data->>'sortOrder')::int, 0), document_id`,
      [fieldCodes],
    );
    return jsonOk({ items: result.rows.map(mapDocumentRow) });
  } catch (error: any) {
    console.error('PCN document requirement read error:', error);
    return jsonError(error?.message || String(error), 500);
  }
}
