// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for reading PostgreSQL document collections

import { NextRequest } from 'next/server';
import { getSessionUser } from '../../../../lib/server/auth.ts';
import { pool } from '../../../../lib/server/db.ts';
import {
  isAllowedCollection,
  mapDocumentRow,
} from '../../../../lib/server/collections.ts';
import { sanitizePcnUserRow } from '../../../../lib/server/users.ts';
import { isPcnSystemManager } from '../../../../utils/pcnRbac.ts';
import {
  jsonOk,
  jsonNotFound,
  jsonForbidden,
  jsonUnauthorized,
  jsonServerError,
} from '../../../../lib/server/response.ts';

type RouteContext = {
  params: Promise<{ collection: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const actor = getSessionUser(request);
  if (!actor) {
    return jsonUnauthorized('Phiên làm việc không hợp lệ hoặc đã hết hạn.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const collectionName = decodeURIComponent(String(resolvedParams.collection || '')).trim();

  if (!isAllowedCollection(collectionName)) {
    return jsonNotFound(`Collection không hợp lệ: ${collectionName}`);
  }
  if (collectionName === 'dossierAttachments' && !isPcnSystemManager(actor) && !actor.departmentScopes?.includes('PCN')) {
    return jsonForbidden('Tài khoản chưa được cấp phạm vi PCN.');
  }

  try {
    const result = await pool.query(
      `SELECT document_id, data
       FROM app_documents
       WHERE collection_name = $1
       ORDER BY updated_at DESC, document_id ASC`,
      [collectionName],
    );

    const items = collectionName === 'systemUsers'
      ? result.rows.map(sanitizePcnUserRow)
      : result.rows.map(mapDocumentRow);

    return jsonOk({ items });
  } catch (error: any) {
    return jsonServerError(error, `Không thể đọc dữ liệu collection ${collectionName}.`);
  }
}
