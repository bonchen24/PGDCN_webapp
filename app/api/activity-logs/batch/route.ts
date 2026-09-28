import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonForbidden, jsonServerError } from '@/lib/server/response';
import { getDocumentPayload } from '@/lib/server/collections';
import {
  buildActivityLog,
  validateActivityLogPayload,
} from '@/lib/server/activity-logs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor || !requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  if (items.length > 250) {
    return jsonError('Mỗi lần batch activity log chỉ được tối đa 250 bản ghi', 400);
  }

  for (let index = 0; index < items.length; index += 1) {
    const validationError = validateActivityLogPayload(items[index]);
    if (validationError) {
      return jsonError(`Activity log thứ ${index + 1}: ${validationError}`, 400);
    }
  }

  try {
    const inserted = await withPgTransaction(async (client) => {
      let count = 0;
      for (const item of items) {
        const normalizedLog = buildActivityLog(item);
        const result = await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [String(normalizedLog.id).trim(), JSON.stringify(getDocumentPayload(normalizedLog))]
        );
        count += result.rowCount || 0;
      }
      return count;
    });
    return jsonCreated({ inserted });
  } catch (error: any) {
    console.error('PostgreSQL activity log batch write error:', error);
    return jsonServerError(error?.message || String(error));
  }
}
