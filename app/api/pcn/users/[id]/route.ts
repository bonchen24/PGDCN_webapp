// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for PCN user update and deletion

import { NextRequest } from 'next/server';
import { getSessionUser } from '../../../../../lib/server/auth.ts';
import { canManageSystemUsers } from '../../../../../utils/systemSettingsPolicy.ts';
import {
  validatePcnUserInput,
  sanitizePcnUserRow,
  findPcnUserReferences,
} from '../../../../../lib/server/users.ts';
import { withPgTransaction } from '../../../../../lib/server/db.ts';
import {
  jsonOk,
  jsonError,
  jsonForbidden,
  jsonNotFound,
  jsonConflict,
  jsonServerError,
} from '../../../../../lib/server/response.ts';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const actor = getSessionUser(request);
  if (!actor || !canManageSystemUsers(actor)) {
    return jsonForbidden('Bạn không có quyền quản lý nhân sự PCN.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const documentId = decodeURIComponent(String(resolvedParams.id || '')).trim().toLowerCase();
  if (!documentId) {
    return jsonError('Thiếu username nhân sự PCN.', 400);
  }

  const body = await request.json().catch(() => ({}));

  try {
    const result = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'systemUsers' AND lower(document_id) = lower($1) LIMIT 1 FOR UPDATE`,
        [documentId],
      );
      if (existingResult.rows.length === 0) {
        throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404 });
      }

      const existing = existingResult.rows[0].data || {};
      const validation = validatePcnUserInput(body || {}, existing);
      if (validation.error || !validation.data) {
        throw Object.assign(new Error(validation.error || 'Dữ liệu nhân sự PCN không hợp lệ.'), { statusCode: 400 });
      }

      const next = { ...validation.data, username: documentId, updatedAt: new Date().toISOString() };
      const write = await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'systemUsers' AND document_id = $1
         RETURNING document_id, data`,
        [existingResult.rows[0].document_id, JSON.stringify(next)],
      );

      return write.rows[0];
    });

    return jsonOk({ user: sanitizePcnUserRow(result) });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.message === 'NOT_FOUND') {
      return jsonNotFound('Không tìm thấy nhân sự PCN.');
    }
    if (error?.statusCode === 400) {
      return jsonError(error.message, 400);
    }
    return jsonServerError(error, 'Không thể cập nhật nhân sự PCN.');
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const actor = getSessionUser(request);
  if (!actor || !canManageSystemUsers(actor)) {
    return jsonForbidden('Bạn không có quyền quản lý nhân sự PCN.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const documentId = decodeURIComponent(String(resolvedParams.id || '')).trim().toLowerCase();
  if (!documentId) {
    return jsonError('Thiếu username nhân sự PCN.', 400);
  }

  if (actor.username.toLowerCase() === documentId) {
    return jsonError('Không thể xóa tài khoản Admin đang đăng nhập.', 400);
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data
         FROM app_documents
         WHERE collection_name = 'systemUsers'
           AND lower(document_id) = lower($1)
         LIMIT 1 FOR UPDATE`,
        [documentId],
      );
      if (existingResult.rows.length === 0) {
        throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404 });
      }

      const existing = existingResult.rows[0].data || {};
      const references = await findPcnUserReferences(client, documentId);
      if (references.length > 0) {
        const referenceSummary = references.slice(0, 5).map((r) => `${r.collection}/${r.documentId}`).join(', ');
        throw Object.assign(
          new Error(`Không thể xóa nhân sự đang được tham chiếu bởi dữ liệu nghiệp vụ: ${referenceSummary}. Hãy chuyển/thu hồi phân công trước.`),
          { statusCode: 409 },
        );
      }

      await client.query(
        `DELETE FROM app_documents
         WHERE collection_name = 'systemUsers' AND document_id = $1`,
        [existingResult.rows[0].document_id],
      );

      return { username: documentId, name: String(existing.name || existing['Họ và Tên'] || documentId) };
    });

    return jsonOk({ deleted: true, user: result });
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.message === 'NOT_FOUND') {
      return jsonNotFound('Không tìm thấy nhân sự PCN.');
    }
    if (error?.statusCode === 409) {
      return jsonConflict(error.message);
    }
    return jsonServerError(error, 'Không thể xóa nhân sự PCN.');
  }
}
