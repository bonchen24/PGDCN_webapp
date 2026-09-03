'use client';

import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

import {
  normalizePgdTemplateCells,
  type PgdCellType,
  type PgdTemplateCell,
} from '../utils/pgdDocumentTemplates';

type PgdCellManagerProps = {
  cells: PgdTemplateCell[];
  onChange: (cells: PgdTemplateCell[]) => void;
  readOnly?: boolean;
  title?: string;
};

const CELL_TYPES: PgdCellType[] = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'TABLE'];

function inputClassName(): string {
  return 'min-h-8 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
}

export default function PgdCellManager({ cells, onChange, readOnly = false, title = 'Quản lý cell biểu mẫu' }: PgdCellManagerProps) {
  const orderedCells = useMemo(() => normalizePgdTemplateCells(cells), [cells]);
  const updateCell = (key: string, patch: Partial<PgdTemplateCell>) => {
    onChange(orderedCells.map((cell) => cell.key === key ? { ...cell, ...patch } : cell));
  };
  const addCell = () => {
    const nextIndex = orderedCells.length + 1;
    onChange(normalizePgdTemplateCells([
      ...orderedCells,
      { key: `cell_${nextIndex}`, label: `Trường ${nextIndex}`, sectionCode: 'custom', row: nextIndex, column: 1, type: 'TEXT', required: false },
    ]));
  };
  const removeCell = (key: string) => onChange(orderedCells.filter((cell) => cell.key !== key));

  return <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label={title}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 className="text-sm font-black text-slate-800">{title}</h2><p className="mt-1 text-[10px] leading-4 text-slate-500">Mỗi cell có vị trí, kiểu dữ liệu và binding riêng; khi phát hành sẽ được snapshot theo phiên bản.</p></div>
      {!readOnly && <button type="button" onClick={addCell} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white hover:bg-blue-500"><Plus size={13} /> Thêm cell</button>}
    </div>
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[1180px] border-separate border-spacing-y-1 text-left" aria-label="Danh sách cell PGD">
        <thead><tr className="text-[9px] font-black uppercase tracking-wide text-slate-400"><th className="w-7" /><th className="px-1">Key</th><th className="px-1">Nhãn</th><th className="w-28 px-1">Section</th><th className="w-16 px-1">Dòng</th><th className="w-16 px-1">Cột</th><th className="w-28 px-1">Kiểu</th><th className="w-20 px-1">Bật</th><th className="w-20 px-1">Bắt buộc</th><th className="w-28 px-1">Đơn vị</th><th className="w-44 px-1">Binding</th><th className="w-52 px-1">Cột bảng</th><th className="w-24 px-1">Dòng min/max</th><th className="w-12 px-1" /></tr></thead>
        <tbody>{orderedCells.map((cell) => <tr key={cell.key} className="bg-slate-50 align-middle">
          <td className="rounded-l-lg px-1 text-slate-300"><GripVertical size={14} /></td>
          <td className="px-1"><input aria-label={`Key ${cell.key}`} disabled={readOnly} className={`${inputClassName()} font-mono`} value={cell.key} onChange={(event) => updateCell(cell.key, { key: event.target.value.replace(/[^a-zA-Z0-9_]/g, '_') })} /></td>
          <td className="px-1"><input aria-label={`Nhãn ${cell.key}`} disabled={readOnly} className={inputClassName()} value={cell.label} onChange={(event) => updateCell(cell.key, { label: event.target.value })} /></td>
          <td className="px-1"><input aria-label={`Section ${cell.key}`} disabled={readOnly} className={inputClassName()} value={cell.sectionCode} onChange={(event) => updateCell(cell.key, { sectionCode: event.target.value })} /></td>
          <td className="px-1"><input aria-label={`Dòng ${cell.key}`} disabled={readOnly} type="number" min="1" className={inputClassName()} value={cell.row} onChange={(event) => updateCell(cell.key, { row: Number(event.target.value) || 1 })} /></td>
          <td className="px-1"><input aria-label={`Cột ${cell.key}`} disabled={readOnly} type="number" min="1" className={inputClassName()} value={cell.column} onChange={(event) => updateCell(cell.key, { column: Number(event.target.value) || 1 })} /></td>
          <td className="px-1"><select aria-label={`Kiểu ${cell.key}`} disabled={readOnly} className={inputClassName()} value={cell.type} onChange={(event) => updateCell(cell.key, { type: event.target.value as PgdCellType })}>{CELL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></td>
          <td className="px-1"><label className="flex min-h-8 items-center justify-center gap-1 text-[10px] font-bold text-slate-600"><input aria-label={`Bật ${cell.key}`} disabled={readOnly} type="checkbox" checked={cell.active !== false} onChange={(event) => updateCell(cell.key, { active: event.target.checked })} /> Có</label></td>
          <td className="px-1"><label className="flex min-h-8 items-center justify-center gap-1 text-[10px] font-bold text-slate-600"><input aria-label={`Bắt buộc ${cell.key}`} disabled={readOnly} type="checkbox" checked={cell.required} onChange={(event) => updateCell(cell.key, { required: event.target.checked })} /> Có</label></td>
          <td className="px-1"><input aria-label={`Đơn vị ${cell.key}`} disabled={readOnly} className={inputClassName()} value={cell.unit || ''} onChange={(event) => updateCell(cell.key, { unit: event.target.value || undefined })} /></td>
          <td className="px-1"><input aria-label={`Binding ${cell.key}`} disabled={readOnly} className={`${inputClassName()} font-mono`} value={cell.binding || ''} onChange={(event) => updateCell(cell.key, { binding: event.target.value || undefined })} placeholder="request.productName" /></td>
          <td className="px-1"><div className="space-y-1"><input aria-label={`Cột bảng ${cell.key}`} disabled={readOnly || cell.type !== 'TABLE'} className={`${inputClassName()} font-mono`} value={(cell.tableColumns || []).join(', ')} onChange={(event) => { const tableColumns = event.target.value.split(',').map((item) => item.trim()).filter(Boolean); const tableColumnLabels = tableColumns.length ? Object.fromEntries(tableColumns.map((column) => [column, cell.tableColumnLabels?.[column] || ''])) : undefined; updateCell(cell.key, { tableColumns: tableColumns.length ? tableColumns : undefined, tableColumnLabels }); }} placeholder="time, activity" /><input aria-label={`Nhãn cột bảng ${cell.key}`} disabled={readOnly || cell.type !== 'TABLE'} className={inputClassName()} value={(cell.tableColumns || []).map((column) => cell.tableColumnLabels?.[column] || '').join(', ')} onChange={(event) => { const labels = event.target.value.split(',').map((item) => item.trim()); const tableColumnLabels = Object.fromEntries((cell.tableColumns || []).map((column, index) => [column, labels[index] || ''])); updateCell(cell.key, { tableColumnLabels }); }} placeholder="Nhãn cột tiếng Việt" /></div></td>
          <td className="px-1"><div className="grid grid-cols-2 gap-1"><input aria-label={`Dòng tối thiểu ${cell.key}`} disabled={readOnly || cell.type !== 'TABLE'} type="number" min="0" className={inputClassName()} value={cell.validation?.minRows ?? ''} onChange={(event) => updateCell(cell.key, { validation: { ...cell.validation, ...(event.target.value ? { minRows: Number(event.target.value) } : {}) } })} placeholder="min" /><input aria-label={`Dòng tối đa ${cell.key}`} disabled={readOnly || cell.type !== 'TABLE'} type="number" min="0" className={inputClassName()} value={cell.validation?.maxRows ?? ''} onChange={(event) => updateCell(cell.key, { validation: { ...cell.validation, ...(event.target.value ? { maxRows: Number(event.target.value) } : {}) } })} placeholder="max" /></div></td>
          <td className="rounded-r-lg px-1 text-right">{!readOnly && <button type="button" onClick={() => removeCell(cell.key)} aria-label={`Xóa cell ${cell.key}`} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>}</td>
        </tr>)}</tbody>
      </table>
      {orderedCells.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-[10px] text-slate-400">Chưa có cell. Thêm cell để cấu hình biểu mẫu.</div>}
    </div>
  </section>;
}
