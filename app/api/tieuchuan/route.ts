// Author: Gemini
// OS support: Web/Node
// Description: Standards list endpoint from tieuchuan.xlsx

import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';
import { jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'tieuchuan.xlsx');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found', data: [] }, { status: 404 });
    }
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const standards = rows
      .map((row) => row[0])
      .filter((item) => typeof item === 'string' && item.trim().length > 0);
    return jsonOk({ data: standards });
  } catch (error: any) {
    console.error('Error reading tieuchuan.xlsx:', error);
    return NextResponse.json({ error: 'Failed to read standards', data: [] }, { status: 500 });
  }
}
