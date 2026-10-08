import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { requirePgdSession } from '@/lib/server/pgd';
import { mapDocumentRow } from '@/lib/server/collections';
import { jsonOk, jsonServerError } from '@/lib/server/response';
import { PGD_COLLECTIONS } from '@/utils/pgdDomain';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  try {
    const { searchParams } = new URL(req.url);
    const requestId = String(searchParams.get('requestId') || '').trim();
    const params: unknown[] = [PGD_COLLECTIONS.documents];
    const where = [`collection_name = $1`, `data->>'domain' = 'pgd'`];
    if (requestId) {
      where.push(`data->>'requestId' = $${params.push(requestId)}`);
    }

    const result = await pool.query(
      `SELECT document_id, data FROM app_documents WHERE ${where.join(' AND ')} ORDER BY updated_at DESC`,
      params,
    );
    return jsonOk({ documents: result.rows.map((row: any) => mapDocumentRow(row)) });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
