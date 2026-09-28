// Author: Gemini
// OS support: Web/Node
// Description: KQTN session authentication, cookies, and payment authorization

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { pool } from './postgres';
import { jsonForbidden, jsonUnauthorized } from './response';
import { getDocumentPayload } from './collections';
import { normalizeSystemUserRole } from '@/utils/systemUserRole';
import { isKqtnPaymentManager, isKqtnPaymentStateChanged } from '@/utils/kqtnPaymentPolicy';

export const KQTN_SESSION_COOKIE = 'ddt_kqtn_session';
export const KQTN_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const KQTN_SESSION_SECRET = String(
  process.env.DDT_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || randomUUID(),
).trim();

export function createKqtnSessionToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expiresAt: Date.now() + KQTN_SESSION_TTL_SECONDS * 1000,
    }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', KQTN_SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function getKqtnSessionUsername(req: NextRequest | Request): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${KQTN_SESSION_COOKIE}=([^;]+)`));
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expectedSignature = createHmac('sha256', KQTN_SESSION_SECRET).update(payload).digest('base64url');
  const providedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expectedSignature);
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const username = String(parsed?.username || '').trim();
    const expiresAt = Number(parsed?.expiresAt || 0);
    return username && expiresAt > Date.now() ? username : null;
  } catch {
    return null;
  }
}

export function setKqtnSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds = KQTN_SESSION_TTL_SECONDS,
): void {
  response.cookies.set(KQTN_SESSION_COOKIE, token, {
    path: '/',
    maxAge: maxAgeSeconds,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function clearKqtnSessionCookie(response: NextResponse): void {
  response.cookies.set(KQTN_SESSION_COOKIE, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function requireKqtnSession(req: NextRequest | Request): Promise<string | NextResponse> {
  const username = getKqtnSessionUsername(req);
  if (!username) {
    return jsonUnauthorized('Phiên đăng nhập KQTN không hợp lệ hoặc đã hết hạn.');
  }
  return username;
}

export async function getSystemUserAccessByUsername(username: string): Promise<any | null> {
  const normalized = String(username || '').trim().toLowerCase().replace(/^@/, '').split('@')[0];
  if (!normalized) return null;
  const result = await pool.query(
    `SELECT data FROM app_documents
     WHERE collection_name = 'systemUsers'
       AND (
         lower(document_id) = lower($1)
         OR split_part(lower(COALESCE(data->>'username', data->>'Tên đăng nhập', data->>'email', data->>'Email', '')), '@', 1) = lower($1)
       )
     LIMIT 1`,
    [normalized],
  );
  return result.rows[0]?.data || null;
}

export async function getSystemUserRoleByUsername(username: string): Promise<string | null> {
  const userData = await getSystemUserAccessByUsername(username);
  return userData ? normalizeSystemUserRole(userData) : null;
}

export async function authorizeKqtnPaymentMutation(
  req: NextRequest | Request,
  documents: Array<{ id: string; data: any }>,
  db: any = pool,
): Promise<Map<string, any> | NextResponse> {
  const ids = documents.map((document) => document.id).filter(Boolean);
  if (ids.length === 0) return new Map();
  const existing = await db.query(
    `SELECT document_id, data FROM app_documents WHERE collection_name = 'kqtnRecords' AND document_id = ANY($1::text[]) FOR UPDATE`,
    [ids],
  );
  const existingById = new Map<string, any>();
  for (const row of existing.rows) {
    existingById.set(String(row.document_id), row.data);
  }
  const paymentChanged = documents.some((document) =>
    isKqtnPaymentStateChanged(existingById.get(document.id), document.data || {}),
  );
  if (!paymentChanged) return existingById;

  const username = getKqtnSessionUsername(req);
  if (!username) {
    return jsonUnauthorized('Phiên đăng nhập KQTN không hợp lệ hoặc đã hết hạn.');
  }
  const user = await getSystemUserAccessByUsername(username);
  if (!isKqtnPaymentManager(user)) {
    return jsonForbidden('Chỉ Admin, Quản lý phòng hoặc Văn thư chuyên trách được cập nhật trạng thái thanh toán KQTN.');
  }
  return existingById;
}

export function preserveKqtnPaymentState(currentData: any, incomingData: any): Record<string, any> {
  const payload = getDocumentPayload(incomingData);
  if (!currentData || isKqtnPaymentStateChanged(currentData, payload)) return payload;
  for (const field of ['customerPaymentConfirmed', 'customerPaymentConfirmedAt', 'customerPaymentConfirmedBy']) {
    if (Object.prototype.hasOwnProperty.call(currentData, field)) payload[field] = currentData[field];
    else delete payload[field];
  }
  return payload;
}
