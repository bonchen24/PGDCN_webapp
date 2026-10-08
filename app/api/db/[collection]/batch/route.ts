// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for batch inserting/updating documents

import { NextRequest } from 'next/server';
import { getSessionUser } from '../../../../../lib/server/auth.ts';
import { withPgTransaction } from '../../../../../lib/server/db.ts';
import {
  isAllowedCollection,
  getDocumentPayload,
} from '../../../../../lib/server/collections.ts';
import {
  jsonOk,
  jsonNotFound,
  jsonUnauthorized,
  jsonServerError,
} from '../../../../../lib/server/response.ts';

type RouteContext = {
  params: Promise<{ collection: string }>;
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
  const items = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];

  if (items.length === 0) {
    return jsonOk({ count: 0 });
  }

  try {
    await withPgTransaction(async (client) => {
      for (const item of items) {
        const id = String(item?.id || item?.document_id || '').trim();
        if (!id) continue;
        const payload = getDocumentPayload(item);
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id)
           DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
          [collectionName, id, JSON.stringify(payload)],
        );
      }
    });

    return jsonOk({ count: items.length });
  } catch (error: any) {
    return jsonServerError(error, `Không thể lưu lô dữ liệu collection ${collectionName}.`);
  }
}
