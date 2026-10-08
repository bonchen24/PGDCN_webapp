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
  sortType?: 'text' | 'number' | 'date';
}

export type SummaryGridSortDirection = 'asc' | 'desc';
export interface SummaryGridSortState {
  columnId: string;
  direction: SummaryGridSortDirection;
}

type SummarySortKind = 'text' | 'number' | 'date';

function compareSummaryId(left: string, right: string): number {
  const localized = left.localeCompare(right, 'vi-VN', { numeric: true, sensitivity: 'base' });
  return localized || (left < right ? -1 : left > right ? 1 : 0);
}

function isIsoDateValue(value: SummaryCellValue): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function isNumericValue(value: SummaryCellValue): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string' || !value.trim()) return false;
  return Number.isFinite(Number(value.trim().replace(',', '.')));
}

function getSummarySortKind(rows: SummaryGridRow[], column: Pick<SummaryGridColumn, 'id' | 'inputType' | 'sortType'>): SummarySortKind {
  if (column.sortType) return column.sortType;
  if (column.inputType === 'date') return 'date';
  if (column.inputType === 'number') return 'number';
  const values = rows.map((row) => row.cells[column.id]).filter((value) => value !== null && value !== undefined && value !== '');
  if (values.length > 0 && values.every(isIsoDateValue)) return 'date';
  if (values.length > 0 && values.every(isNumericValue)) return 'number';
  return 'text';
}

export function toggleSummarySort(current: SummaryGridSortState | null, columnId: string): SummaryGridSortState | null {
  if (!current || current.columnId !== columnId) return { columnId, direction: 'asc' };
  if (current.direction === 'asc') return { columnId, direction: 'desc' };
  return null;
}

export function sortSummaryRows(
  rows: SummaryGridRow[],
  column: Pick<SummaryGridColumn, 'id' | 'inputType' | 'sortType'>,
  direction: SummaryGridSortDirection,
): SummaryGridRow[] {
  const kind = getSummarySortKind(rows, column);
  const compareText = (left: SummaryCellValue, right: SummaryCellValue) => summaryCellText(left).localeCompare(summaryCellText(right), 'vi-VN', { numeric: true, sensitivity: 'base' });
  return [...rows].sort((left, right) => {
    const leftValue = left.cells[column.id];
    const rightValue = right.cells[column.id];
    const leftEmpty = leftValue === null || leftValue === undefined || leftValue === '';
    const rightEmpty = rightValue === null || rightValue === undefined || rightValue === '';
    if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1;

    let comparison = 0;
    if (!leftEmpty && !rightEmpty && kind === 'number') {
      const leftNumber = typeof leftValue === 'number' ? leftValue : Number(String(leftValue).trim().replace(',', '.'));
      const rightNumber = typeof rightValue === 'number' ? rightValue : Number(String(rightValue).trim().replace(',', '.'));
      comparison = Number.isFinite(leftNumber) && Number.isFinite(rightNumber) ? leftNumber - rightNumber : compareText(leftValue, rightValue);
    } else if (!leftEmpty && !rightEmpty && kind === 'date') {
      const leftDate = Date.parse(String(leftValue));
      const rightDate = Date.parse(String(rightValue));
      comparison = Number.isFinite(leftDate) && Number.isFinite(rightDate) ? leftDate - rightDate : compareText(leftValue, rightValue);
    } else if (!leftEmpty && !rightEmpty) {
      comparison = compareText(leftValue, rightValue);
    }

    if (comparison !== 0) return direction === 'asc' ? comparison : -comparison;
    return compareSummaryId(left.id, right.id);
  });
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
