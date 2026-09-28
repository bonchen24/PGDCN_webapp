// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for PCN user personal settings and Gemini AI credentials

import { NextRequest } from 'next/server';
import { getSessionUser, getSessionSecret } from '../../../../lib/server/auth.ts';
import { pool, withPgTransaction } from '../../../../lib/server/db.ts';
import { getDocumentPayload } from '../../../../lib/server/collections.ts';
import {
  decryptPcnGeminiApiKey,
  encryptPcnGeminiApiKey,
  maskPcnGeminiApiKey,
  normalizePcnGeminiApiKey,
} from '../../../../utils/pcnGeminiCredentials.ts';
import {
  jsonOk,
  jsonError,
  jsonUnauthorized,
  jsonServerError,
} from '../../../../lib/server/response.ts';

function getPcnPreferenceLookupKeys(username: string): string[] {
  const raw = String(username || '').trim().toLowerCase();
  const normalized = raw.replace(/^@/, '').split('@')[0].trim();
  return Array.from(new Set([raw, normalized].filter(Boolean)));
}

function getPcnGeminiApiKeyFromPreferences(data: Record<string, any> | undefined): string | undefined {
  const encrypted = String(data?.geminiApiKeyEncrypted || '').trim();
  const secret = getSessionSecret();
  const decrypted = encrypted ? decryptPcnGeminiApiKey(encrypted, secret) : undefined;
  if (decrypted) return decrypted;
  try {
    const legacyKey = normalizePcnGeminiApiKey(data?.geminiApiKey);
    return legacyKey || undefined;
  } catch {
    return undefined;
  }
}

function buildPcnPersonalSettingsResponse(data: Record<string, any> | undefined) {
  const apiKey = getPcnGeminiApiKeyFromPreferences(data);
  const geminiModel = String(data?.geminiModel || '').trim();
  return {
    provider: 'GOOGLE_GEMINI',
    credentialScope: 'PERSONAL_PROJECT',
    geminiApiKeyConfigured: Boolean(apiKey),
    ...(apiKey ? { geminiApiKeyHint: maskPcnGeminiApiKey(apiKey) } : {}),
    ...(geminiModel ? { geminiModel } : {}),
  };
}

export async function GET(request: NextRequest) {
  const actor = getSessionUser(request);
  if (!actor) {
    return jsonUnauthorized('Thiết lập cá nhân PCN chỉ khả dụng khi đã đăng nhập.');
  }

  try {
    const lookupKeys = getPcnPreferenceLookupKeys(actor.username);
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'userPreferences'
         AND lower(document_id) = ANY($1::text[])
       LIMIT 1`,
      [lookupKeys],
    );
    return jsonOk({ settings: buildPcnPersonalSettingsResponse(result.rows[0]?.data) });
  } catch (error: any) {
    return jsonServerError(error, 'Không thể đọc thiết lập cá nhân.');
  }
}

export async function PUT(request: NextRequest) {
  const actor = getSessionUser(request);
  if (!actor) {
    return jsonUnauthorized('Thiết lập cá nhân PCN chỉ khả dụng khi đã đăng nhập.');
  }

  const body = await request.json().catch(() => ({}));
  const incoming = body?.settings;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return jsonError('Dữ liệu thiết lập AI cá nhân không hợp lệ.', 400);
  }

  const secret = getSessionSecret();
  try {
    const nextSettings = await withPgTransaction(async (client) => {
      const lookupKeys = getPcnPreferenceLookupKeys(actor.username);
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'userPreferences'
           AND lower(document_id) = ANY($1::text[])
         LIMIT 1 FOR UPDATE`,
        [lookupKeys],
      );
      const existingRow = existingResult.rows[0];
      const previousData = (existingRow?.data || {}) as Record<string, any>;
      const nextData: Record<string, any> = { ...previousData };

      const hasApiKeyInput = Object.prototype.hasOwnProperty.call(incoming, 'geminiApiKey');
      const requestedApiKey = hasApiKeyInput ? normalizePcnGeminiApiKey(incoming.geminiApiKey) : '';
      const shouldClearApiKey = incoming.clearGeminiApiKey === true;

      if (requestedApiKey) {
        nextData.geminiApiKeyEncrypted = encryptPcnGeminiApiKey(requestedApiKey, secret);
        delete nextData.geminiApiKey;
      } else if (shouldClearApiKey) {
        delete nextData.geminiApiKeyEncrypted;
        delete nextData.geminiApiKey;
      }

      const requestedModel = String(incoming.geminiModel ?? '').trim();
      if (requestedModel.length > 160) {
        throw Object.assign(new Error('Gemini model không hợp lệ.'), { statusCode: 400 });
      }
      if (requestedModel) nextData.geminiModel = requestedModel;
      else delete nextData.geminiModel;

      const documentId = String(existingRow?.document_id || lookupKeys[lookupKeys.length - 1] || actor.username).trim();
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('userPreferences', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [documentId, JSON.stringify(getDocumentPayload(nextData))],
      );

      return buildPcnPersonalSettingsResponse(nextData);
    });

    return jsonOk({ settings: nextSettings });
  } catch (error: any) {
    if (error?.statusCode === 400) {
      return jsonError(error.message, 400);
    }
    return jsonServerError(error, 'Không thể cập nhật thiết lập cá nhân.');
  }
}
