// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for PCN system settings

import { NextRequest } from 'next/server';
import { getSessionUser } from '../../../../lib/server/auth.ts';
import { pool } from '../../../../lib/server/db.ts';
import { mapDocumentRow } from '../../../../lib/server/collections.ts';
import {
  jsonOk,
  jsonUnauthorized,
  jsonServerError,
} from '../../../../lib/server/response.ts';
import { normalizePcnSettings } from '@/utils/pcnSettings';

export async function GET(request: NextRequest) {
  const actor = getSessionUser(request);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }

  try {
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'systemConfig' AND document_id = $1
       LIMIT 1`,
      ['pcn-settings'],
    );
    const stored = result.rows[0] ? mapDocumentRow(result.rows[0]) : {};
    return jsonOk({ settings: normalizePcnSettings(stored) });
  } catch (error: any) {
    return jsonServerError(error, 'Không thể đọc cài đặt PCN.');
  }
}
