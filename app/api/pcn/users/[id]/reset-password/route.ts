// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for resetting PCN user password

import { NextRequest } from 'next/server';
import { getSessionUser } from '../../../../../../lib/server/auth.ts';
import { canManageSystemUsers } from '../../../../../../utils/systemSettingsPolicy.ts';
import { withPgTransaction } from '../../../../../../lib/server/db.ts';
import {
  jsonOk,
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonServerError,
} from '../../../../../../lib/server/response.ts';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const actor = getSessionUser(request);
  if (!actor || !canManageSystemUsers(actor)) {
    return jsonForbidden('Bạn không có quyền quản lý nhân sự PCN.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const documentId = decodeURIComponent(String(resolvedParams.id || '')).trim().toLowerCase();
  const body = await request.json().catch(() => ({}));
  const password = String(body?.password || '').trim();

  if (!documentId || password.length < 8) {
    return jsonError('Mật khẩu PCN phải có ít nhất 8 ký tự.', 400);
  }

  try {
    await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'systemUsers' AND lower(document_id) = lower($1) LIMIT 1 FOR UPDATE`,
        [documentId],
      );
      if (existingResult.rows.length === 0) {
        throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404 });
      }

      const existing = existingResult.rows[0].data || {};
      const next = { ...existing, password, 'Mật khẩu': password, updatedAt: new Date().toISOString() };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'systemUsers' AND document_id = $1`,
        [existingResult.rows[0].document_id, JSON.stringify(next)],
      );
    });

    return jsonOk({ reset: true, id: documentId });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.message === 'NOT_FOUND') {
      return jsonNotFound('Không tìm thấy nhân sự PCN.');
    }
    return jsonServerError(error, 'Không thể reset mật khẩu nhân sự PCN.');
  }
}
