// Author: Gemini
// OS support: Web/Node
// Description: Authentication, session management and user credentials for Next.js App Router API handlers

import { NextResponse, type NextRequest } from 'next/server';
import type { PcnUserAccount } from '../../types.ts';
import {
  verifyPcnSessionToken,
  createPcnSessionToken,
  shouldUseSecurePcnSessionCookie,
  findPcnUser,
  getPcnUserLookupKeys,
  verifyPcnPassword,
  toPcnUserAccount,
  type PcnUserRow,
} from '../../utils/pcnAuth.ts';
import { normalizeUserKey } from '../../utils/userIdentity.ts';
import { canManageSystemUsers, canViewSystemSettings } from '../../utils/systemSettingsPolicy.ts';
import { pool } from './db.ts';
import { jsonForbidden, jsonUnauthorized } from './response.ts';

export const PCN_SESSION_COOKIE = 'pcn_certification_session';
export const PCN_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours
export { createPcnSessionToken };

export function getSessionSecret(): string {
  return String(
    process.env.PCN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SESSION_SECRET ||
    'pcn-session-secret-fallback-key'
  ).trim();
}

export function extractSessionToken(request: Request | NextRequest): string | null {
  // 1. From Cookie header
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${PCN_SESSION_COOKIE}=([^;]+)`));
  if (match && match[1]) {
    return decodeURIComponent(match[1]);
  }

  // 2. From Authorization header
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // 3. From custom header
  const customHeader = request.headers.get('x-pcn-session');
  if (customHeader) {
    return customHeader.trim();
  }

  return null;
}

export function getSessionUser(request: Request | NextRequest): PcnUserAccount | null {
  const token = extractSessionToken(request);
  if (!token) return null;
  return verifyPcnSessionToken(token, getSessionSecret());
}

export function requireSessionUser(request: Request | NextRequest): PcnUserAccount {
  const user = getSessionUser(request);
  if (!user) {
    throw new Error('UNAUTHORIZED');
  }
  return user;
}

export function isSessionAdmin(user: PcnUserAccount | null): boolean {
  return Boolean(user && user.systemRole === 'admin');
}

export function isSessionManager(user: PcnUserAccount | null): boolean {
  return Boolean(user && canManageSystemUsers(user));
}

export function isSessionSettingsViewer(user: PcnUserAccount | null): boolean {
  return Boolean(user && canViewSystemSettings(user));
}

export async function authenticatePcnUser(usernameInput: string, passwordInput: string): Promise<PcnUserAccount> {
  const username = String(usernameInput || '').trim();
  const password = String(passwordInput || '').trim();

  if (!username || !password) {
    throw new Error('Thiếu tên đăng nhập hoặc mật khẩu.');
  }

  // Development bypass
  if (process.env.NODE_ENV !== 'production' && username.toLowerCase() === 'admin' && password === 'admin') {
    return {
      username: 'admin',
      name: 'Admin',
      role: 'admin',
      systemRole: 'admin',
      departmentRoleCode: 'LEADERSHIP',
      fieldCodes: [],
      active: true,
      position: 'Quản trị (Dự phòng)',
    };
  }

  const lookupKeys = Array.from(new Set([username.toLowerCase(), normalizeUserKey(username)].filter(Boolean)));
  const targetedResult = await pool.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'systemUsers'
       AND (
         lower(document_id) = ANY($1::text[])
         OR lower(data->>'username') = ANY($1::text[])
         OR lower(data->>'Tên đăng nhập') = ANY($1::text[])
         OR lower(data->>'email') = ANY($1::text[])
         OR lower(data->>'Email') = ANY($1::text[])
       )
     ORDER BY document_id`,
    [lookupKeys],
  );

  let rows = targetedResult.rows.map((row): PcnUserRow => ({
    documentId: String(row.document_id),
    data: row.data || {},
  }));
  let userRow = findPcnUser(rows, username);

  if (!userRow) {
    const fallbackResult = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'systemUsers'
       ORDER BY document_id`,
    );
    rows = fallbackResult.rows.map((row): PcnUserRow => ({
      documentId: String(row.document_id),
      data: row.data || {},
    }));
    userRow = findPcnUser(rows, username);
  }

  if (!userRow) {
    throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
  }

  const preferenceResult = await pool.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'userPreferences'
       AND lower(document_id) = ANY($1::text[])
     LIMIT 1`,
    [getPcnUserLookupKeys(userRow)],
  );
  const customPassword = String(preferenceResult.rows[0]?.data?.customPassword || '').trim();

  if (!verifyPcnPassword(userRow, password, customPassword)) {
    throw new Error('Tài khoản hoặc mật khẩu không chính xác.');
  }

  const user = toPcnUserAccount(userRow);
  if (!user.active) {
    throw new Error('Tài khoản PCN đã bị khóa. Vui lòng liên hệ Admin PCN.');
  }

  return user;
}

export const getPcnSessionUser = getSessionUser;

export function requirePcnMutation(
  reqOrActor: NextRequest | PcnUserAccount | null
): NextResponse | null {
  const actor = reqOrActor && 'headers' in reqOrActor
    ? getSessionUser(reqOrActor as NextRequest)
    : (reqOrActor as PcnUserAccount | null);
  if (!actor) return jsonUnauthorized('Phiên PCN không còn hợp lệ.');
  if (actor.active === false) return jsonForbidden('Tài khoản PCN đã bị khóa.');
  return null;
}

export function requirePcnSession(
  reqOrActor: NextRequest | PcnUserAccount | null
): NextResponse | null {
  const actor = reqOrActor && 'headers' in reqOrActor
    ? getSessionUser(reqOrActor as NextRequest)
    : (reqOrActor as PcnUserAccount | null);
  if (!actor) return jsonUnauthorized('Phiên PCN không còn hợp lệ.');
  if (actor.active === false) return jsonForbidden('Tài khoản PCN đã bị khóa.');
  return null;
}

export function requirePcnAdmin(
  reqOrActor: NextRequest | PcnUserAccount | null
): NextResponse | null {
  const sessionError = requirePcnSession(reqOrActor);
  if (sessionError) return sessionError;
  const actor = reqOrActor && 'headers' in reqOrActor
    ? getSessionUser(reqOrActor as NextRequest)
    : (reqOrActor as PcnUserAccount | null);
  if (actor?.systemRole !== 'admin') {
    return jsonForbidden('Chỉ quản trị viên hệ thống PCN mới có quyền thực hiện.');
  }
  return null;
}
