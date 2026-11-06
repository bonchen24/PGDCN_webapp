import { NextRequest } from 'next/server';
import { getPcnSessionUser, requirePcnAdmin } from '@/lib/server/auth';
import { jsonBadRequest, jsonOk, jsonServerError } from '@/lib/server/response';
import {
  applyRetention,
  createBackup,
  getBackupRetentionPolicy,
  isPgToolAvailable,
  recordBackupActivity,
} from '@/utils/backupManager';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const adminError = requirePcnAdmin(req);
  if (adminError) return adminError;

  try {
    if (!(await isPgToolAvailable())) {
      return jsonServerError('pg_dump chưa được cài đặt trên máy chủ. Vui lòng cài PostgreSQL client tools.');
    }
    const backup = await createBackup('manual');
    const sessionUser = getPcnSessionUser(req);
    const auditActor = sessionUser ? {
      username: sessionUser.username,
      name: sessionUser.name,
      role: (sessionUser.systemRole || sessionUser.role) as any,
    } : {};

    await recordBackupActivity('CREATED', backup.filename, auditActor, 'UI');
    const retention = getBackupRetentionPolicy();
    applyRetention(retention.retentionCount, retention.maxTotalBytes);
    return jsonOk(backup);
  } catch (error: any) {
    console.error('Manual backup error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
