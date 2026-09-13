'use client';

import { Download, GripVertical, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { mergeColumnConfig, shouldPersistColumnConfig } from '../utils/columnConfigPersistence';
import { summaryCellText, summaryRowsToCsv, type SummaryGridColumn, type SummaryGridRow } from '../utils/summaryRegister';

type StoredColumn = SummaryGridColumn & { width: number; visible: boolean };

type Props = {
  domain: 'PCN' | 'PGD';
  columns: SummaryGridColumn[];
  rows: SummaryGridRow[];
  currentUsername?: string | null;
  canEdit: boolean;
  canEditRow?: (rowId: string) => boolean;
  filterRows?: (rows: SummaryGridRow[]) => SummaryGridRow[];
  filterControls?: React.ReactNode;
  onOpenRow: (rowId: string) => void;
  onCommitCell: (rowId: string, columnId: string, value: string) => Promise<void>;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

const DEFAULT_WIDTH = 148;
const PAGE_SIZES = [20, 50, 100] as const;

function normaliseColumns(columns: SummaryGridColumn[]): StoredColumn[] {
  return columns.map((column) => ({
    ...column,
    width: column.width ?? DEFAULT_WIDTH,
    visible: column.visible !== false,
  }));
}

function columnStorageKey(domain: Props['domain'], username: string): string {
  return `summary_grid_cols_${domain}_${username}`;
}

export default function PgdcnDossierSummaryGrid({
  domain,
  columns: defaultColumns,
  rows,
  currentUsername,
  canEdit,
  canEditRow,
  filterRows,
  filterControls,
  onOpenRow,
  onCommitCell,
  searchPlaceholder = 'Tìm mã hồ sơ, khách hàng, sản phẩm...',
  emptyTitle = 'Không có hồ sơ phù hợp',
  emptyDescription = 'Hãy điều chỉnh từ khóa hoặc bộ lọc để xem lại Sổ tổng hợp.',
}: Props) {
  const [columns, setColumns] = useState<StoredColumn[]>(() => normaliseColumns(defaultColumns));
  const [loadedUsername, setLoadedUsername] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(50);
  const [showColumnConfig, setShowColumnConfig] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [cellError, setCellError] = useState<string | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null);
  const committingRef = useRef(false);
  const resizeRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const nextDefaults = normaliseColumns(defaultColumns);
    if (typeof window === 'undefined' || !currentUsername) {
      setColumns(nextDefaults);
      setLoadedUsername(null);
      return;
    }
    const key = columnStorageKey(domain, currentUsername);
    let saved: unknown;
    try {
      saved = JSON.parse(window.localStorage.getItem(key) ?? 'null');
    } catch {
      saved = null;
    }
    setColumns(mergeColumnConfig(nextDefaults, saved));
    setLoadedUsername(currentUsername);
  }, [domain, currentUsername, defaultColumns]);

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldPersistColumnConfig(loadedUsername, currentUsername)) return;
    window.localStorage.setItem(columnStorageKey(domain, loadedUsername), JSON.stringify(
      columns.map(({ id, width, visible }) => ({ id, width, visible })),
    ));
  }, [columns, currentUsername, domain, loadedUsername]);

  const filteredRows = useMemo(() => {
    const source = filterRows ? filterRows(rows) : rows;
    const needle = query.trim().toLocaleLowerCase('vi-VN');
    if (!needle) return source;
    return source.filter((row) => row.searchText.toLocaleLowerCase('vi-VN').includes(needle));
  }, [filterRows, query, rows]);

  const visibleColumns = useMemo(() => columns.filter((column) => column.visible), [columns]);
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    if (pageSize === 'ALL') return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, query, filterRows]);

  useEffect(() => {
    if (!editingCell) return;
    inputRef.current?.focus();
    if (inputRef.current && 'select' in inputRef.current) inputRef.current.select();
  }, [editingCell]);

  useEffect(() => {
    if (!resizingColumnId) return;
    const handleMove = (event: MouseEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      const nextWidth = Math.max(80, Math.round(resize.startWidth + event.clientX - resize.startX));
      setColumns((current) => current.map((column) => column.id === resize.id ? { ...column, width: nextWidth } : column));
    };
    const handleUp = () => {
      resizeRef.current = null;
      setResizingColumnId(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [resizingColumnId]);

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const isRowEditable = (rowId: string) => canEdit && (canEditRow ? canEditRow(rowId) : true);

  const findNextEditableCell = (rowId: string, columnId: string) => {
    const rowIndex = pageRows.findIndex((row) => row.id === rowId);
    const columnIndex = visibleColumns.findIndex((column) => column.id === columnId);
    if (rowIndex < 0 || columnIndex < 0) return null;
    for (let index = columnIndex + 1; index < visibleColumns.length; index += 1) {
      if (visibleColumns[index].editable && isRowEditable(rowId)) return { rowId, columnId: visibleColumns[index].id };
    }
    for (let nextRowIndex = rowIndex + 1; nextRowIndex < pageRows.length; nextRowIndex += 1) {
      const nextColumn = visibleColumns.find((column) => column.editable && isRowEditable(pageRows[nextRowIndex].id));
      if (nextColumn) return { rowId: pageRows[nextRowIndex].id, columnId: nextColumn.id };
    }
    return null;
  };

  const startEdit = (row: SummaryGridRow, column: StoredColumn) => {
    if (!isRowEditable(row.id) || !column.editable || savingRowId) return;
    setCellError(null);
    setEditingCell({ rowId: row.id, columnId: column.id });
    const rawValue = summaryCellText(row.cells[column.id]);
    setEditValue(column.inputType === 'date' ? rawValue.slice(0, 10) : rawValue);
  };

  const commitCell = async (nextCell: { rowId: string; columnId: string } | null = null) => {
    if (!editingCell || committingRef.current) return;
    const current = editingCell;
    committingRef.current = true;
    setCellError(null);
    setSavingRowId(current.rowId);
    try {
      await onCommitCell(current.rowId, current.columnId, editValue);
      setEditingCell(nextCell);
      const nextRow = nextCell ? rowById.get(nextCell.rowId) : undefined;
      const nextColumn = nextCell ? columns.find((column) => column.id === nextCell.columnId) : undefined;
      setEditValue(nextRow && nextColumn ? summaryCellText(nextRow.cells[nextColumn.id]) : '');
    } catch (error) {
      setCellError(error instanceof Error ? error.message : 'Không thể lưu ô dữ liệu.');
    } finally {
      committingRef.current = false;
      setSavingRowId(null);
    }
  };

  const reorderColumns = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setColumns((current) => {
      const fromIndex = current.findIndex((column) => column.id === fromId);
      const toIndex = current.findIndex((column) => column.id === toId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const startResize = (event: React.MouseEvent, column: StoredColumn) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { id: column.id, startX: event.clientX, startWidth: column.width };
    setResizingColumnId(column.id);
  };

  const exportCsv = () => {
    const blob = new Blob([summaryRowsToCsv(filteredRows, visibleColumns)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `so-tong-hop-${domain.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderEditor = (row: SummaryGridRow, column: StoredColumn) => {
    const common = {
      value: editValue,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setEditValue(event.target.value),
      onBlur: () => void commitCell(),
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setEditingCell(null);
          setCellError(null);
        } else if (event.key === 'Enter' && (column.inputType !== 'textarea' || event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void commitCell();
        } else if (event.key === 'Tab') {
          event.preventDefault();
          void commitCell(findNextEditableCell(row.id, column.id));
        }
      },
      className: 'w-full rounded border border-emerald-400 bg-white px-1.5 py-1 text-[11px] text-slate-800 outline-none ring-2 ring-emerald-100',
    };
    if (column.inputType === 'select') {
      return <select {...common} ref={inputRef as React.Ref<HTMLSelectElement>}>{(column.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
    }
    if (column.inputType === 'textarea') return <textarea {...common} ref={inputRef as React.Ref<HTMLTextAreaElement>} rows={2} />;
    return <input {...common} ref={inputRef as React.Ref<HTMLInputElement>} type={column.inputType ?? 'text'} />;
  };

  return (
    <div data-testid="dossier-summary-grid" className="space-y-3">
      <div data-testid="dossier-summary-toolbar" className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:grid-cols-[minmax(0,1fr)_repeat(5,minmax(7rem,auto))] lg:items-center">
        <div className="min-w-0">
          <label htmlFor={`summary-grid-search-${domain}`} className="mb-1 block text-[10px] font-black text-slate-600">Tìm kiếm Sổ tổng hợp {domain}</label>
          <input
            id={`summary-grid-search-${domain}`}
            aria-label={`Tìm Sổ tổng hợp ${domain}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}

            className="min-h-9 w-full min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-[11px] outline-none focus:border-emerald-400"
          />
        </div>
        <div className="contents">{filterControls}</div>
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-500 lg:justify-end">
          <span>{filteredRows.length}/{rows.length} hồ sơ</span>
          <button type="button" onClick={() => setShowColumnConfig((value) => !value)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 hover:border-emerald-300 hover:text-emerald-700"><SlidersHorizontal size={13} /> Cột</button>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 hover:border-emerald-300 hover:text-emerald-700"><Download size={13} /> CSV</button>
        </div>
      </div>

      {showColumnConfig && <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Cấu hình cột · kéo để sắp xếp</div>
        <div className="flex flex-wrap gap-2">
          {columns.map((column) => <label key={column.id} draggable onDragStart={() => setDraggedColumnId(column.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedColumnId) reorderColumns(draggedColumnId, column.id); setDraggedColumnId(null); }} className="inline-flex cursor-move items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-600">
            <GripVertical size={12} className="text-slate-400" />
            <input type="checkbox" checked={column.visible} onChange={() => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, visible: !item.visible } : item))} />
            <span>{column.label}</span>
            <input type="number" min={80} max={640} aria-label={`Độ rộng cột ${column.label}`} value={column.width} onChange={(event) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, width: Math.max(80, Number(event.target.value) || DEFAULT_WIDTH) } : item))} onClick={(event) => event.stopPropagation()} className="w-14 rounded border border-slate-200 px-1 py-0.5 text-[10px] font-normal" />
          </label>)}
        </div>
      </div>}

      {cellError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{cellError}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left text-[11px]">
            <thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                {visibleColumns.map((column, index) => <th key={column.id} style={{ width: column.width, minWidth: column.width }} className={`relative whitespace-nowrap border-b border-slate-200 px-2 py-1.5 ${column.sticky || index === 0 ? 'sticky left-0 z-10 bg-slate-50' : ''}`}>{column.label}<span role="separator" aria-label={`Đổi độ rộng cột ${column.label}`} onMouseDown={(event) => startResize(event, column)} className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize ${resizingColumnId === column.id ? 'bg-emerald-400' : 'hover:bg-emerald-200'}`} /></th>)}
                <th className="sticky right-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-right">Hồ sơ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.map((row) => <tr key={row.id} className="hover:bg-emerald-50/30">
                {visibleColumns.map((column, index) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell.columnId === column.id;
                  return <td key={column.id} onClick={() => !isEditing && startEdit(row, column)} className={`max-w-[280px] border-slate-100 px-2 py-1.5 align-top ${column.sticky || index === 0 ? 'sticky left-0 z-[1] bg-white' : ''} ${column.editable && isRowEditable(row.id) ? 'cursor-text' : ''}`}>
                    {isEditing ? renderEditor(row, column) : <div title={summaryCellText(row.displayCells?.[column.id] ?? row.cells[column.id])} className={`${column.id === 'requestCode' || column.id === 'dossierCode' ? 'font-mono font-black text-slate-800' : 'font-medium text-slate-700'} max-w-[260px] whitespace-pre-wrap break-words`}>{summaryCellText(row.displayCells?.[column.id] ?? row.cells[column.id]) || <span className="text-slate-300">—</span>}</div>}
                  </td>;
                })}
                <td className="sticky right-0 z-[1] bg-white px-2 py-1.5 text-right"><button type="button" onClick={() => onOpenRow(row.id)} className="whitespace-nowrap rounded-md border border-slate-200 px-2 py-1.5 text-[9px] font-black text-emerald-700 hover:border-emerald-300">Mở hồ sơ</button>{savingRowId === row.id && <div className="mt-1 text-[9px] text-amber-600">Đang lưu…</div>}</td>
              </tr>)}
            </tbody>
          </table>
          {pageRows.length === 0 && <div className="p-8 text-center"><div className="text-sm font-black text-slate-700">{emptyTitle}</div><div className="mt-1 text-[11px] text-slate-500">{emptyDescription}</div></div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[10px] font-bold text-slate-500">
          <span>Trang {currentPage}/{totalPages}</span>
          <div className="flex items-center gap-1.5">
            <select aria-label={`Số dòng mỗi trang Sổ tổng hợp ${domain}`} value={pageSize} onChange={(event) => setPageSize(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))} className="rounded border border-slate-200 bg-white px-1.5 py-1">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} dòng</option>)}
              <option value="ALL">Tất cả</option>
            </select>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">‹</button>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40">›</button>
          </div>
        </div>
      </div>
      {canEdit && pageRows.some((row) => isRowEditable(row.id)) && <div className="text-[10px] text-slate-500">Ô dữ liệu cho phép sửa: bấm vào ô, Enter/Tab để lưu, Esc để hủy. Máy chủ sẽ trả lại bản ghi sau khi lưu.</div>}
    </div>
  );
}
