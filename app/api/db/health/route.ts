import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { jsonOk, jsonServerError } from '@/lib/server/response';

export const dynamic = 'force-dynamic';

export async function GET() {
  const profile = (process.env.DATABASE_PROFILE || 'pcn').trim();
  try {
    const result = await pool.query('SELECT current_database() AS database_name');
    return jsonOk({
      status: 'ok',
      database: 'postgresql',
      profile,
      databaseName: result.rows[0]?.database_name || null,
    });
  } catch (error: any) {
    return jsonServerError(error?.message || String(error));
  }
}
