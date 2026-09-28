// Author: Gemini
// OS support: Web/Node
// Description: Next.js App Router route handler for PCN authentication and session management

import { NextRequest } from 'next/server';
import {
  authenticatePcnUser,
  getSessionUser,
  createPcnSessionToken,
  getSessionSecret,
  PCN_SESSION_COOKIE,
  PCN_SESSION_TTL_SECONDS,
} from '../../../../lib/server/auth.ts';
import { jsonOk, jsonUnauthorized, jsonError } from '../../../../lib/server/response.ts';

export async function GET(request: NextRequest) {
  const user = getSessionUser(request);
  if (!user) {
    return jsonUnauthorized('Chưa đăng nhập');
  }
  return jsonOk({ authenticated: true, user });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '').trim();

    if (!username || !password) {
      return jsonError('Thiếu tên đăng nhập hoặc mật khẩu.', 400);
    }

    const user = await authenticatePcnUser(username, password);
    const token = createPcnSessionToken(user, getSessionSecret(), PCN_SESSION_TTL_SECONDS);

    const isSecure = process.env.NODE_ENV === 'production';
    const response = jsonOk({ authenticated: true, user });

    response.cookies.set({
      name: PCN_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: PCN_SESSION_TTL_SECONDS,
      secure: isSecure,
    });

    return response;
  } catch (error: any) {
    const message = error?.message || 'Đăng nhập không thành công.';
    const status = message.includes('bị khóa') ? 403 : message.includes('chính xác') ? 401 : 400;
    return jsonError(message, status);
  }
}

export async function DELETE() {
  const response = jsonOk({ authenticated: false });
  response.cookies.set({
    name: PCN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
