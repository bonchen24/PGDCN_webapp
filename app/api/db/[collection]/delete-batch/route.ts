// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for batch deleting documents

import { NextRequest } from 'next/server';
import { getSessionUser } from '../../../../../lib/server/auth.ts';
import { pool } from '../../../../../lib/server/db.ts';
import { isAllowedCollection } from '../../../../../lib/server/collections.ts';
import {
  jsonOk,
  jsonNotFound,
  jsonUnauthorized,
  jsonServerError,
} from '../../../../../lib/server/response.ts';

type RouteContext = {
  params: { collection: string } | Promise<{ collection: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const actor = getSessionUser(request);
  if (!actor) {
    return jsonUnauthorized('Phiên làm việc không hợp lệ hoặc đã hết hạn.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const collectionName = decodeURIComponent(String(resolvedParams.collection || '')).trim();

  if (!isAllowedCollection(collectionName)) {
    return jsonNotFound(`Collection không hợp lệ: ${collectionName}`);
  }

  const body = await request.json().catch(() => ({}));
  const docIds = Array.isArray(body?.docIds) ? body.docIds : [];

  if (docIds.length === 0) {
    return jsonOk({ count: 0 });
  }

  try {
    await pool.query(
      `DELETE FROM app_documents
       WHERE collection_name = $1 AND document_id = ANY($2::text[])`,
      [collectionName, docIds],
    );
    return jsonOk({ count: docIds.length });
  } catch (error: any) {
    return jsonServerError(error, `Không thể xóa lô dữ liệu collection ${collectionName}.`);
  }
}
