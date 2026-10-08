'use client';

import { Plus, Trash2 } from 'lucide-react';

import type { PgdTemplateCell } from '../utils/pgdDocumentTemplates';
import {
  createPgdTableRow,
  getPgdTableColumnInputType,
  getPgdTableColumnLabel,
  normalizePgdTableRows,
  removePgdTableRow,
  updatePgdTableCell,
  type PgdTableScalar,
} from '../utils/pgdTableFields';

type PgdTableFieldEditorProps = {
  cell: PgdTemplateCell;
  value: unknown;
  onChange: (value: Record<string, PgdTableScalar>[]) => void;
  readOnly?: boolean;
};

function inputValue(value: PgdTableScalar): string {
  return value === null || value === undefined ? '' : String(value);
}

export default function PgdTableFieldEditor({ cell, value, onChange, readOnly = false }: PgdTableFieldEditorProps) {
  const columns = cell.tableColumns || [];
  const rows = normalizePgdTableRows(value, columns);
  const maxRows = cell.validation?.maxRows;
  const minRows = cell.validation?.minRows;
  const addRow = () => {
    if (typeof maxRows === 'number' && rows.length >= maxRows) return;
      if (!readOnly) onChange([...rows, createPgdTableRow(columns)]);
  };
  const updateCell = (rowIndex: number, column: string, nextValue: string) => {
    onChange(updatePgdTableCell(rows, rowIndex, column, nextValue));
  };
  const removeRow = (rowIndex: number) => onChange(removePgdTableRow(rows, rowIndex));

  if (columns.length === 0) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-bold text-amber-800">Trường bảng chưa khai báo cột nhập liệu.</p>;
  }

  return <div className="rounded-xl border border-slate-200 bg-white p-2">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <span className="text-[11px] text-slate-500">{rows.length ? `${rows.length} dòng` : 'Chưa có dòng dữ liệu'}{typeof minRows === 'number' ? ` · tối thiểu ${minRows}` : ''}{typeof maxRows === 'number' ? ` · tối đa ${maxRows}` : ''}</span>
      {!readOnly && <button type="button" onClick={addRow} disabled={typeof maxRows === 'number' && rows.length >= maxRows} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-black text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={12} /> Thêm dòng</button>}
    </div>
    {rows.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 px-2.5 py-3 text-center text-[11px] text-slate-400">Nhấn “Thêm dòng” để nhập {cell.label.toLowerCase()}.</p> : <div className="mobile-scroll-x min-w-0 max-w-full overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-100 text-[11px]">
        <thead className="bg-slate-50"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-2 py-2 text-left text-[11px] font-black text-slate-500">{cell.tableColumnLabels?.[column] || getPgdTableColumnLabel(column)}</th>)}<th className="w-10 px-2 py-2" aria-label="Thao tác" /></tr></thead>
        <tbody className="divide-y divide-slate-100 bg-white">{rows.map((row, rowIndex) => <tr key={`${cell.key}-${rowIndex}`}>
          {columns.map((column) => { const label = cell.tableColumnLabels?.[column] || getPgdTableColumnLabel(column); return <td key={column} className="min-w-36 px-2 py-1.5 align-top"><input aria-label={`${label} dòng ${rowIndex + 1}`} disabled={readOnly} type={getPgdTableColumnInputType(column)} value={inputValue(row[column])} onChange={(event) => updateCell(rowIndex, column, event.target.value)} className="mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500" /></td>; })}
          <td className="px-2 py-1.5 align-top">{!readOnly && <button type="button" onClick={() => removeRow(rowIndex)} aria-label={`Xóa dòng ${rowIndex + 1}`} title={`Xóa dòng ${rowIndex + 1}`} className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"><Trash2 size={13} /><span className="sr-only">Xóa dòng</span></button>}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </div>;
}

// --- End of PgdTableFieldEditor.tsx ---
