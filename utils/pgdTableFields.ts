export type PgdTableScalar = string | number | boolean | null;
export type PgdTableRow = Record<string, PgdTableScalar>;

const COLUMN_LABELS: Record<string, string> = {
  action: 'Xử lý',
  activity: 'Nội dung',
  code: 'Mã',
  date: 'Ngày',
  description: 'Mô tả',
  disposition: 'Xử lý mẫu',
  document: 'Chứng từ',
  item: 'Hạng mục',
  method: 'Phương pháp',
  name: 'Họ tên',
  number: 'Số',
  owner: 'Phụ trách',
  phone: 'Số điện thoại',
  quantity: 'Số lượng',
  result: 'Kết quả',
  role: 'Vai trò',
  sampleCode: 'Mã mẫu',
  seal: 'Niêm phong',
  standard: 'Tiêu chuẩn',
  time: 'Thời gian',
  unit: 'Đơn vị',
  username: 'Tài khoản',
  value: 'Giá trị',
};

function scalarValue(value: unknown): PgdTableScalar {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}

export function getPgdTableColumnLabel(column: string): string {
  const key = String(column || '').trim();
  if (COLUMN_LABELS[key]) return COLUMN_LABELS[key];
  const label = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
  return label.replace(/^./, (character) => character.toUpperCase()) || 'Trường';
}

export function getPgdTableColumnInputType(column: string): 'text' | 'number' | 'date' | 'time' {
  const key = String(column || '').trim().toLowerCase();
  if (key === 'date') return 'date';
  if (key === 'time') return 'time';
  if (key === 'quantity') return 'number';
  return 'text';
}

export function createPgdTableRow(columns: readonly string[], seed: Record<string, unknown> = {}): PgdTableRow {
  return Object.fromEntries(columns.map((column) => [column, scalarValue(seed[column])])) as PgdTableRow;
}

export function normalizePgdTableRows(value: unknown, columns: readonly string[]): PgdTableRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === 'object' && !Array.isArray(row))
    .map((row) => createPgdTableRow(columns, row as Record<string, unknown>));
}

export function updatePgdTableCell(rows: readonly PgdTableRow[], rowIndex: number, column: string, value: PgdTableScalar): PgdTableRow[] {
  return rows.map((row, index) => index === rowIndex ? { ...row, [column]: value } : { ...row });
}

export function removePgdTableRow(rows: readonly PgdTableRow[], rowIndex: number): PgdTableRow[] {
  return rows.filter((_, index) => index !== rowIndex).map((row) => ({ ...row }));
}

// --- End of pgdTableFields.ts ---
