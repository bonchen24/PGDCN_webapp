import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePcnAdmin } from '@/lib/server/auth';
import { jsonBadRequest, jsonNotFound } from '@/lib/server/response';
import { getBackupPath } from '@/utils/backupManager';

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
    const filePath = getBackupPath(filename);

    if (!fs.existsSync(filePath)) {
      return jsonNotFound('Tệp sao lưu không tồn tại.');
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(path.basename(filePath))}"`,
        'Content-Length': String(fileBuffer.length),
      },
    });
  } catch (error: any) {
    console.error('Backup download error:', error);
    return jsonBadRequest(error?.message || String(error));
  }
}
