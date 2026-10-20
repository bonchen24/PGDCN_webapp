// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for PCN system settings

import { NextRequest } from 'next/server';
import { getSessionUser, requirePcnAdmin } from '../../../../lib/server/auth.ts';
import { DATABASE_PROFILE } from '../../../../lib/server/env.ts';
import { pool, withPgTransaction } from '../../../../lib/server/db.ts';
import { getDocumentPayload, mapDocumentRow } from '../../../../lib/server/collections.ts';
import {
  jsonOk,
  jsonError,
  jsonNotFound,
  jsonUnauthorized,
  jsonServerError,
} from '../../../../lib/server/response.ts';
import { buildActivityLog, validateActivityLogPayload } from '../../../../lib/server/activity-logs.ts';
import { stablePcnMutationId } from '../../../../lib/server/pcn-signer-delegations.ts';
import { diffActivityFields } from '../../../../utils/activityLog.ts';
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

export async function PUT(request: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Cài đặt PCN chỉ khả dụng trong profile PCN.');
  }

  const authorizationError = requirePcnAdmin(request);
  if (authorizationError) return authorizationError;

  const actor = getSessionUser(request)!;
  const body = await request.json().catch(() => ({}));
  const incoming = body?.settings;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return jsonError('Dữ liệu cài đặt PCN không hợp lệ.', 400);
  }

  const now = new Date().toISOString();
  const requestedSettings = normalizePcnSettings({
    ...incoming,
    id: 'pcn-settings',
    updatedAt: now,
    updatedBy: actor.username,
  });

  try {
    const result = await withPgTransaction(async (client) => {
      const previousResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'systemConfig' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        ['pcn-settings'],
      );
      const previous = previousResult.rows[0]
        ? normalizePcnSettings(mapDocumentRow(previousResult.rows[0]))
        : normalizePcnSettings({});
      const settings = normalizePcnSettings(requestedSettings);

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('systemConfig', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        ['pcn-settings', JSON.stringify(getDocumentPayload(settings))],
      );

      const activityLog = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-settings-update', JSON.stringify(settings)),
        action: 'UPDATED',
        entityType: 'SYSTEM',
        entityId: 'pcn-settings',
        entityLabel: 'Cài đặt PCN',
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: actor.systemRole || actor.role,
        summary: 'Cập nhật cấu hình vận hành PCN',
        changes: diffActivityFields(previous, settings, ['fieldCodes', 'labRoutes', 'checklist', 'coding', 'ocr', 'storage']),
        source: 'UI',
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw Object.assign(new Error(validationError), { statusCode: 400 });

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))],
      );
      return { settings, activityLog };
    });

    return jsonOk(result);
  } catch (error: any) {
    if (error?.statusCode === 400) return jsonError(error.message, 400);
    return jsonServerError(error, 'Không thể cập nhật cài đặt PCN.');
  }
}
