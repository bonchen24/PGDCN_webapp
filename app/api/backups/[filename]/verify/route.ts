import { NextRequest } from 'next/server';
import { requirePcnAdmin } from '@/lib/server/auth';
import { jsonBadRequest, jsonOk } from '@/lib/server/response';
import { verifyBackupArchive } from '@/utils/backupManager';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const adminError = requirePcnAdmin(req);
  if (adminError) return adminError;

  try {
    const { filename: rawFilename } = await params;
    const filename = String(rawFilename || '');
    const verification = await verifyBackupArchive(filename);
    return jsonOk(verification);
  } catch (error: any) {
    console.error('Backup verification error:', error);
    return jsonBadRequest(error?.message || String(error));
  }
}
