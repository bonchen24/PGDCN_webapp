export type SummaryCellValue = string | number | boolean | null | undefined;

export interface SummaryGridRow {
  id: string;
  cells: Record<string, SummaryCellValue>;
  displayCells?: Record<string, SummaryCellValue>;
  searchText: string;
}

export interface SummaryGridColumn {
  id: string;
  label: string;
  width?: number;
  visible?: boolean;
  editable?: boolean;
  inputType?: 'text' | 'number' | 'date' | 'textarea' | 'select';
  options?: Array<{ value: string; label: string }>;
  sticky?: boolean;
}

export function summaryCellText(value: SummaryCellValue): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return String(value);
}

export function summaryRowsToCsv(rows: SummaryGridRow[], columns: SummaryGridColumn[]): string {
  const escape = (value: SummaryCellValue) => {
    const text = summaryCellText(value).replaceAll('"', '""');
    return /[",\n\r]/.test(text) ? `"${text}"` : text;
  };
  const header = columns.map((column) => escape(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => escape(row.cells[column.id])).join(','));
  return `\uFEFF${[header, ...body].join('\n')}`;
}
