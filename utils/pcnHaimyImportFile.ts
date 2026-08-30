// Author: Codex
// OS support: Web
// Description: Browser-only parsing boundary for operator-selected Haimy exports

import type { PcnHaimyExportRecord } from '../types.ts';

export const PCN_HAIMY_IMPORT_MAX_ROWS = 5000;

type HaimyField = keyof PcnHaimyExportRecord;

const FIELD_ALIASES: Record<HaimyField, string[]> = {
  sourceSystem: ['sourcesystem', 'source system', 'he thong nguon', 'nguon'],
  externalRegistrationId: ['externalregistrationid', 'external registration id', 'external id', 'ma dang ky', 'ma dang ky ben ngoai', 'registration id'],
  externalBatchId: ['externalbatchid', 'external batch id', 'ma lo ben ngoai', 'ma lo'],
  externalCertificateId: ['externalcertificateid', 'external certificate id', 'ma gcn ben ngoai', 'ma chung chi ben ngoai'],
  registrationCode: ['registrationcode', 'registration code', 'so dang ky', 'ma dang ky noi bo'],
  customerName: ['customername', 'customer name', 'ten khach hang', 'khach hang', 'don vi de nghi'],
  productName: ['productname', 'product name', 'ten san pham', 'san pham', 'ten hang hoa'],
  model: ['model', 'ma san pham', 'kieu loai'],
  brand: ['brand', 'thuong hieu', 'nhan hieu'],
  fieldCode: ['fieldcode', 'field code', 'ma linh vuc', 'linh vuc', 'quy chuan', 'qcvn'],
  quantity: ['quantity', 'so luong', 'so luong mau', 'quantity provided'],
};

function normalizedHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function findValue(row: Record<string, unknown>, aliases: string[]): unknown {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [normalizedHeader(key), value] as const);
  for (const alias of aliases) {
    const normalizedAlias = normalizedHeader(alias);
    const found = normalizedEntries.find(([key]) => key === normalizedAlias);
    if (found) return found[1];
  }
  return undefined;
}

export function normalizePcnHaimyExportRows(rows: unknown[]): PcnHaimyExportRecord[] {
  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return row as PcnHaimyExportRecord;
    const source = row as Record<string, unknown>;
    const normalized: PcnHaimyExportRecord = {};
    (Object.keys(FIELD_ALIASES) as HaimyField[]).forEach((field) => {
      const value = findValue(source, FIELD_ALIASES[field]);
      if (value !== undefined) normalized[field] = value;
    });
    return normalized;
  });
}

function extractJsonRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') throw new Error('File Haimy phải chứa một mảng bản ghi.');
  const object = value as Record<string, unknown>;
  for (const key of ['records', 'items', 'data']) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }
  throw new Error('Không tìm thấy mảng records/items/data trong file Haimy.');
}

function assertRowLimit(rows: unknown[]): void {
  if (rows.length === 0) throw new Error('File Haimy không có bản ghi để rà soát.');
  if (rows.length > PCN_HAIMY_IMPORT_MAX_ROWS) throw new Error(`File Haimy vượt giới hạn ${PCN_HAIMY_IMPORT_MAX_ROWS.toLocaleString('vi-VN')} dòng.`);
}

export function parsePcnHaimyJsonText(text: string): PcnHaimyExportRecord[] {
  const trimmed = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!trimmed) throw new Error('File Haimy đang trống.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('File JSON Haimy không hợp lệ.');
  }
  const rows = extractJsonRows(parsed);
  assertRowLimit(rows);
  return normalizePcnHaimyExportRows(rows);
}

export async function parsePcnHaimyExportFile(file: File): Promise<PcnHaimyExportRecord[]> {
  const fileName = String(file?.name || '').toLocaleLowerCase('vi-VN');
  if (fileName.endsWith('.json')) return parsePcnHaimyJsonText(await file.text());
  if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
    throw new Error('Chỉ nhận file Haimy dạng .json, .csv hoặc .xlsx.');
  }

  const xlsx = await import('xlsx');
  const input = fileName.endsWith('.csv') ? await file.text() : await file.arrayBuffer();
  const workbook = xlsx.read(input, { type: fileName.endsWith('.csv') ? 'string' : 'array', raw: false, cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File Haimy không có worksheet.');
  const rows = xlsx.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { defval: '', raw: false }) as unknown[];
  assertRowLimit(rows);
  return normalizePcnHaimyExportRows(rows);
}

// --- End of pcnHaimyImportFile.ts ---
