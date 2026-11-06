import { NextRequest } from 'next/server';
import { getPcnSessionUser, requirePcnAdmin } from '@/lib/server/auth';
import { jsonBadRequest, jsonOk, jsonServerError } from '@/lib/server/response';
import { isPgToolAvailable, restoreBackup } from '@/utils/backupManager';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const adminError = requirePcnAdmin(req);
  if (adminError) return adminError;

  const { filename: rawFilename } = await params;
  const filename = String(rawFilename || '');

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body?.confirm !== 'KHOIPHUC') {
    return jsonBadRequest('Thiếu xác nhận khôi phục.');
  }

  try {
    if (!(await isPgToolAvailable())) {
      return jsonServerError('pg_restore chưa được cài đặt trên máy chủ. Vui lòng cài PostgreSQL client tools.');
    }
    const actor = getPcnSessionUser(req);
    await restoreBackup(filename, actor ? {
      username: actor.username,
      name: actor.name,
      role: (actor.systemRole || actor.role) as any,
    } : undefined);
    return jsonOk({ restored: filename });
  } catch (error: any) {
    console.error('Backup restore error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
