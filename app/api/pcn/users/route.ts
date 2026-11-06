// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for PCN user list and creation

import { NextRequest } from 'next/server';
import { getSessionUser, requirePcnSession } from '../../../../lib/server/auth.ts';
import { canManageSystemUsers, canReadPcnUserDirectory, canSetSystemUserRole } from '../../../../utils/systemSettingsPolicy.ts';
import {
  fetchPcnUsers,
  validatePcnUserInput,
  sanitizePcnUserRow,
} from '../../../../lib/server/users.ts';
import { withPgTransaction } from '../../../../lib/server/db.ts';
import {
  jsonOk,
  jsonCreated,
  jsonError,
  jsonForbidden,
  jsonConflict,
  jsonServerError,
} from '../../../../lib/server/response.ts';

export async function GET(request: NextRequest) {
  const sessionError = requirePcnSession(request);
  if (sessionError) return sessionError;
  const actor = getSessionUser(request);
  if (!canReadPcnUserDirectory(actor)) {
    return jsonForbidden('Tài khoản không có phạm vi PCN để đọc danh sách nhân sự.');
  }

  try {
    const items = (await fetchPcnUsers()).filter((user) => user.departmentScopes?.includes('PCN'));
    return jsonOk({ items });
  } catch (error: any) {
    return jsonServerError(error, 'Không thể tải danh sách nhân sự PCN.');
  }
}

export async function POST(request: NextRequest) {
  const actor = getSessionUser(request);
  if (!actor || !canManageSystemUsers(actor)) {
    return jsonForbidden('Bạn không có quyền quản lý nhân sự PCN.');
  }

  const body = await request.json().catch(() => ({}));
  const validation = validatePcnUserInput(body || {});
  if (validation.error || !validation.data) {
    return jsonError(validation.error || 'Dữ liệu nhân sự PCN không hợp lệ.', 400);
  }
  if (!canSetSystemUserRole(actor, validation.data)) {
    return jsonForbidden('Chỉ Admin mới được gán vai trò Admin hoặc chức danh lãnh đạo.');
  }

  const documentId = String(validation.data.username || '').trim().toLowerCase();

  try {
    const result = await withPgTransaction(async (client) => {
      const existing = await client.query(
        `SELECT document_id FROM app_documents WHERE collection_name = 'systemUsers' AND lower(document_id) = lower($1) LIMIT 1 FOR UPDATE`,
        [documentId],
      );
      if (existing.rows.length > 0) {
        throw new Error('DUPLICATE_USERNAME');
      }

      const write = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('systemUsers', $1, $2::jsonb, CURRENT_TIMESTAMP)
         RETURNING document_id, data`,
        [documentId, JSON.stringify({ ...validation.data, source: 'PCN_ADMIN' })],
      );

      return write.rows[0];
    });

    return jsonCreated({ user: sanitizePcnUserRow(result) });
  } catch (error: any) {
    if (error?.message === 'DUPLICATE_USERNAME') {
      return jsonConflict('Tên đăng nhập PCN đã tồn tại.');
    }
    return jsonServerError(error, 'Không thể tạo nhân sự PCN.');
  }
}
