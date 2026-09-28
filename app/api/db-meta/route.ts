// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for PostgreSQL collection metadata

import { NextRequest } from 'next/server';
import { pool } from '../../../lib/server/db.ts';
import { isAllowedCollection } from '../../../lib/server/collections.ts';
import { jsonOk, jsonServerError } from '../../../lib/server/response.ts';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawNames = String(searchParams.get('collections') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const names = Array.from(new Set(rawNames)).filter(isAllowedCollection);

  if (names.length === 0) {
    return jsonOk({ meta: {} });
  }

  try {
    const result = await pool.query(
      `SELECT collection_name, COUNT(*)::int AS count, MAX(updated_at) AS max_updated_at
       FROM app_documents
       WHERE collection_name = ANY($1::text[])
       GROUP BY collection_name`,
      [names],
    );

    const meta: Record<string, { count: number; maxUpdatedAt: string | null }> = {};
    for (const name of names) {
      meta[name] = { count: 0, maxUpdatedAt: null };
    }
    for (const row of result.rows) {
      meta[row.collection_name] = {
        count: row.count,
        maxUpdatedAt: row.max_updated_at ? new Date(row.max_updated_at).toISOString() : null,
      };
    }

    return jsonOk({ meta });
  } catch (error: any) {
    return jsonServerError(error, 'Không thể đọc metadata collections.');
  }
}
