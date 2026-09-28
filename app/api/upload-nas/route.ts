// Author: Gemini
// OS support: Web/Node
// Description: NAS FTP upload endpoint

import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { Client as FtpClient } from 'basic-ftp';
import { jsonBadRequest, jsonError, jsonOk } from '@/lib/server/response';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  const { buffer: base64Data, filename } = body || {};
  if (!base64Data || !filename) {
    return jsonBadRequest('Thiếu dữ liệu tệp hoặc tên tệp');
  }

  if (!process.env.FTP_HOST) {
    console.log('Mock FTP Upload success - Env FTP_HOST not defined.');
    return jsonOk({ success: true, mocked: true, message: 'Lưu giả lập thành công (tệp .env chưa có NAS IP)' });
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const stream = Readable.from(buffer);

    const client = new FtpClient();
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      port: parseInt(process.env.FTP_PORT || '21', 10),
      secure: process.env.FTP_SECURE === 'true',
    });

    await client.uploadFrom(stream, `/${filename}`);
    client.close();

    return jsonOk({ success: true, message: 'Đã tải tệp lên NAS thành công' });
  } catch (error: any) {
    console.error('NAS FTP Upload Error:', error);
    return jsonError(String(error), 500);
  }
}
