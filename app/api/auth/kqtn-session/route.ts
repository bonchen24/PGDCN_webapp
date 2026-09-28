// Author: Gemini
// OS support: Web/Node
// Description: KQTN Session login and logout endpoint

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/postgres';
import { jsonBadRequest, jsonServerError, jsonUnauthorized } from '@/lib/server/response';
import {
  clearKqtnSessionCookie,
  createKqtnSessionToken,
  setKqtnSessionCookie,
} from '@/lib/server/kqtn-auth';
import { normalizeSystemUserRole } from '@/utils/systemUserRole';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  const inputUsername = String(body?.username || '').trim().toLowerCase();
  const username = inputUsername.replace(/^@/, '').split('@')[0];
  const password = String(body?.password || '').trim();

  if (!username || !password) {
    return jsonBadRequest('Thiếu tên đăng nhập hoặc mật khẩu.');
  }

  try {
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'systemUsers'
         AND (
           lower(document_id) = lower($1)
           OR split_part(lower(COALESCE(data->>'username', data->>'Tên đăng nhập', data->>'email', data->>'Email', '')), '@', 1) = lower($1)
         )
       LIMIT 1`,
      [username],
    );

    const userData = result.rows[0]?.data;
    if (!userData) {
      return jsonUnauthorized('Tài khoản hoặc mật khẩu không chính xác.');
    }

    const storedPassword = String(userData.password || userData['Mật khẩu'] || '').trim();
    const preferenceKeys = Array.from(
      new Set(
        [
          username,
          result.rows[0]?.document_id,
          userData.username,
          userData['Tên đăng nhập'],
          userData.email,
          userData['Email'],
        ]
          .map((value) => String(value || '').trim().toLowerCase().replace(/^@/, '').split('@')[0])
          .filter(Boolean),
      ),
    );

    const preferenceResult = await pool.query(
      `SELECT data FROM app_documents
       WHERE collection_name = 'userPreferences'
         AND lower(document_id) = ANY($1::text[])
       LIMIT 1`,
      [preferenceKeys],
    );

    const customPasswordValue = String(preferenceResult.rows[0]?.data?.customPassword || '').trim();
    const customPassword = customPasswordValue && customPasswordValue !== 'Abc123456' ? customPasswordValue : '';
    const passwordMatches =
      password === (customPassword || storedPassword || 'Abc123456') ||
      (password === 'Abc123456' && !storedPassword);

    if (!passwordMatches) {
      return jsonUnauthorized('Tài khoản hoặc mật khẩu không chính xác.');
    }

    const token = createKqtnSessionToken(username);
    const role = normalizeSystemUserRole(userData);
    const response = NextResponse.json({ authenticated: true, username, role });
    setKqtnSessionCookie(response, token);
    return response;
  } catch (error: any) {
    console.error('KQTN session login error:', error);
    return jsonServerError(error);
  }
}

export async function DELETE() {
  const response = new NextResponse(null, { status: 204 });
  clearKqtnSessionCookie(response);
  return response;
}
