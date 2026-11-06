import { NextRequest } from 'next/server';
import { getPcnSessionUser, requirePcnAdmin } from '@/lib/server/auth';
import { jsonBadRequest, jsonOk } from '@/lib/server/response';
import { deleteBackup, recordBackupActivity } from '@/utils/backupManager';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const adminError = requirePcnAdmin(req);
  if (adminError) return adminError;

  try {
    const { filename: rawFilename } = await params;
    const filename = String(rawFilename || '');
    deleteBackup(filename);
    const sessionUser = getPcnSessionUser(req);
    const auditActor = sessionUser ? {
      username: sessionUser.username,
      name: sessionUser.name,
      role: (sessionUser.systemRole || sessionUser.role) as any,
    } : {};
    await recordBackupActivity('DELETED', filename, auditActor, 'UI');
    return jsonOk({ deleted: filename });
  } catch (error: any) {
    console.error('Backup delete error:', error);
    return jsonBadRequest(error?.message || String(error));
  }
}
