// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for writing and deleting single documents

import { NextRequest } from 'next/server';
import { getSessionUser } from '../../../../../lib/server/auth.ts';
import { pool } from '../../../../../lib/server/db.ts';
import {
  isAllowedCollection,
  getDocumentPayload,
  mapDocumentRow,
} from '../../../../../lib/server/collections.ts';
import {
  jsonOk,
  jsonError,
  jsonNotFound,
  jsonUnauthorized,
  jsonServerError,
} from '../../../../../lib/server/response.ts';

type RouteContext = {
  params: { collection: string; id: string } | Promise<{ collection: string; id: string }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const actor = getSessionUser(request);
  if (!actor) {
    return jsonUnauthorized('Phiên làm việc không hợp lệ hoặc đã hết hạn.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const collectionName = decodeURIComponent(String(resolvedParams.collection || '')).trim();
  const documentId = decodeURIComponent(String(resolvedParams.id || '')).trim();

  if (!isAllowedCollection(collectionName)) {
    return jsonNotFound(`Collection không hợp lệ: ${collectionName}`);
  }
  if (!documentId) {
    return jsonError('Thiếu document id', 400);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const payload = getDocumentPayload(body);

    const result = await pool.query(
      `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
       VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (collection_name, document_id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP
       RETURNING document_id, data`,
      [collectionName, documentId, JSON.stringify(payload)],
    );

    return jsonOk(mapDocumentRow(result.rows[0]));
  } catch (error: any) {
    return jsonServerError(error, `Không thể lưu dữ liệu document ${documentId}.`);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const actor = getSessionUser(request);
  if (!actor) {
    return jsonUnauthorized('Phiên làm việc không hợp lệ hoặc đã hết hạn.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const collectionName = decodeURIComponent(String(resolvedParams.collection || '')).trim();
  const documentId = decodeURIComponent(String(resolvedParams.id || '')).trim();

  if (!isAllowedCollection(collectionName)) {
    return jsonNotFound(`Collection không hợp lệ: ${collectionName}`);
  }
  if (!documentId) {
    return jsonError('Thiếu document id', 400);
  }

  try {
    await pool.query(
      `DELETE FROM app_documents
       WHERE collection_name = $1 AND document_id = $2`,
      [collectionName, documentId],
    );
    return jsonOk({ success: true, id: documentId });
  } catch (error: any) {
    return jsonServerError(error, `Không thể xóa document ${documentId}.`);
  }
}
