import { NextRequest } from 'next/server';
import { requirePcnAdmin } from '@/lib/server/auth';
import { jsonOk, jsonServerError } from '@/lib/server/response';
import { isPgToolAvailable, listBackups } from '@/utils/backupManager';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const adminError = requirePcnAdmin(req);
  if (adminError) return adminError;

  try {
    const [items, pgToolAvailable] = await Promise.all([
      Promise.resolve(listBackups()),
      isPgToolAvailable(),
    ]);
    return jsonOk({ items, pgToolAvailable });
  } catch (error: any) {
    console.error('List backups error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
