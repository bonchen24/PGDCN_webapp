// Author: Gemini
// OS support: Web/Node
// Description: Standard HTTP responses for Next.js App Router API handlers

import { NextResponse } from 'next/server';

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { status: 201, ...init });
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonBadRequest(message: string, extra?: Record<string, unknown>): NextResponse {
  return jsonError(message, 400, extra);
}

export function jsonUnauthorized(message = 'Phiên làm việc không hợp lệ hoặc đã hết hạn.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function jsonForbidden(message = 'Tài khoản không có quyền thực hiện thao tác này.', status = 403): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function jsonNotFound(message = 'Không tìm thấy dữ liệu yêu cầu.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function jsonConflict(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function jsonServerError(error: unknown, customMessage = 'Lỗi máy chủ nội bộ.'): NextResponse {
  const message = error instanceof Error ? error.message : String(error || customMessage);
  console.error('[API Server Error]:', error);
  return NextResponse.json({ error: message || customMessage }, { status: 500 });
}
