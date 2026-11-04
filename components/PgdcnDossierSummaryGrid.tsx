'use client';

import { BookmarkPlus, Download, GripVertical, Play, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { mergeColumnConfig, shouldPersistColumnConfig } from '../utils/columnConfigPersistence';
import { sortSummaryRows, summaryCellText, summaryRowsToCsv, toggleSummarySort, type SummaryGridColumn, type SummaryGridRow, type SummaryGridSortState } from '../utils/summaryRegister';
import { readPgdcnSavedFilters, type PgdcnSavedFilter, type PgdcnSavedFilterSnapshot, upsertPgdcnSavedFilter, writePgdcnSavedFilters } from '../utils/pgdcnSavedFilters';

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
  savedFilterState?: { values: Record<string, string>; onApply: (snapshot: PgdcnSavedFilterSnapshot) => void };
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

function getColumnHeaderTone(domain: Props['domain'], columnId: string): string {
  const cid = columnId.toLowerCase();
  if (cid.includes('code') || cid.includes('number') || cid.includes('dossier') || cid.includes('request')) {
    return domain === 'PCN' ? 'bg-emerald-100/70 text-emerald-950 font-black' : 'bg-blue-100/70 text-blue-950 font-black';
  }
  if (cid.includes('customer') || cid.includes('client') || cid.includes('contact')) {
    return 'bg-amber-100/60 text-amber-950 font-black';
  }
  if (cid.includes('product') || cid.includes('model') || cid.includes('brand') || cid.includes('origin')) {
    return 'bg-indigo-100/60 text-indigo-950 font-black';
  }
  if (cid.includes('status') || cid.includes('step') || cid.includes('station') || cid.includes('complete') || cid.includes('missing')) {
    return 'bg-teal-100/60 text-teal-950 font-black';
  }
  if (cid.includes('invoice') || cid.includes('fee') || cid.includes('payment') || cid.includes('receipt')) {
    return 'bg-purple-100/60 text-purple-950 font-black';
  }
  return 'bg-slate-100 text-slate-700 font-black';
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
  savedFilterState,
}: Props) {
  const [columns, setColumns] = useState<StoredColumn[]>(() => normaliseColumns(defaultColumns));
  const [loadedUsername, setLoadedUsername] = useState<string | null>(null);
  const [savedFilters, setSavedFilters] = useState<PgdcnSavedFilter[]>([]);
  const [savedFilterName, setSavedFilterName] = useState('');
  const [loadedFilterUsername, setLoadedFilterUsername] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortState, setSortState] = useState<SummaryGridSortState | null>(null);
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
    if (typeof window === 'undefined' || !currentUsername) {
      setSavedFilters([]);
      setLoadedFilterUsername(null);
      return;
    }
    setSavedFilters(readPgdcnSavedFilters(domain, currentUsername));
    setLoadedFilterUsername(currentUsername);
  }, [domain, currentUsername]);

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldPersistColumnConfig(loadedUsername, currentUsername)) return;
    window.localStorage.setItem(columnStorageKey(domain, loadedUsername), JSON.stringify(
      columns.map(({ id, width, visible }) => ({ id, width, visible })),
    ));
  }, [columns, currentUsername, domain, loadedUsername]);

  const saveCurrentFilter = () => {
    if (!savedFilterState || !loadedFilterUsername) return;
    const next = upsertPgdcnSavedFilter(savedFilters, savedFilterName, { query, values: savedFilterState.values });
    setSavedFilters(next);
    writePgdcnSavedFilters(domain, loadedFilterUsername, next);
    setSavedFilterName('');
  };

  const deleteSavedFilter = (id: string) => {
    if (!loadedFilterUsername) return;
    const next = savedFilters.filter((filter) => filter.id !== id);
    setSavedFilters(next);
    writePgdcnSavedFilters(domain, loadedFilterUsername, next);
  };

  const filteredRows = useMemo(() => {
    const source = filterRows ? filterRows(rows) : rows;
    const needle = query.trim().toLocaleLowerCase('vi-VN');
    if (!needle) return source;
    return source.filter((row) => row.searchText.toLocaleLowerCase('vi-VN').includes(needle));
  }, [filterRows, query, rows]);

  const sortedRows = useMemo(() => {
    if (!sortState) return filteredRows;
    const sortColumn = columns.find((column) => column.id === sortState.columnId);
    return sortColumn ? sortSummaryRows(filteredRows, sortColumn, sortState.direction) : filteredRows;
  }, [columns, filteredRows, sortState]);

  const visibleColumns = useMemo(() => columns.filter((column) => column.visible), [columns]);
  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    if (pageSize === 'ALL') return sortedRows;
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedRows]);

  useEffect(() => {
    setPage(1);
  }, [filterRows, pageSize, query, sortState]);

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
    const blob = new Blob([summaryRowsToCsv(sortedRows, visibleColumns)], { type: 'text/csv;charset=utf-8' });
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
      <div
        data-testid="dossier-summary-toolbar"
        className={`pgdcn-toolbar-nowrap flex items-center gap-2 rounded-xl border bg-white p-2.5 shadow-xs ${
          domain === 'PCN' ? 'border-emerald-200/90' : 'border-blue-200/90'
        }`}
      >
        <div className="pgdcn-toolbar-search relative min-w-[220px] sm:min-w-[260px] max-w-sm flex-1 shrink-0">
          <label htmlFor={`summary-grid-search-${domain}`} className="sr-only">
            Tìm kiếm Sổ tổng hợp {domain}
          </label>
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id={`summary-grid-search-${domain}`}
            aria-label={`Tìm Sổ tổng hợp ${domain}`}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div className="contents">{filterControls}</div>
        <div className="pgdcn-toolbar-actions ml-auto flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="hidden whitespace-nowrap text-[11px] font-bold text-slate-400 lg:inline-block">
            {filteredRows.length}/{rows.length} hồ sơ
          </span>
          <button
            type="button"
            onClick={() => setShowColumnConfig((value) => !value)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer shadow-3xs"
          >
            <SlidersHorizontal size={13} className="text-slate-400" />
            <span>Cột</span>
          </button>
          <button
            type="button"
            onClick={exportCsv}
            aria-label="Xuất CSV"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 transition-colors cursor-pointer shadow-3xs"
          >
            <Download size={13} className="text-slate-400" />
            <span>Xuất CSV</span>
          </button>
        </div>
      </div>

      {savedFilterState && currentUsername && <div data-testid={`saved-filter-toolbar-${domain}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={`saved-filter-name-${domain}`} className="text-[10px] font-black uppercase tracking-wide text-slate-600">Bộ lọc đã lưu</label>
          <span className="text-[10px] font-bold text-slate-400">{savedFilters.length}/8</span>
        </div>
        {savedFilters.length > 0 && <div className="mt-2 flex flex-wrap gap-2">
          {savedFilters.map((filter) => <span key={filter.id} className="inline-flex min-h-11 items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button type="button" onClick={() => { setQuery(filter.snapshot.query); savedFilterState?.onApply(filter.snapshot); }} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 px-3 text-[11px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500">
              <Play size={12} aria-hidden="true" /> {filter.name}
            </button>
            <button type="button" onClick={() => deleteSavedFilter(filter.id)} aria-label={`Xóa bộ lọc đã lưu ${filter.name}`} className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center border-l border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500">
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </span>)}
        </div>}
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input id={`saved-filter-name-${domain}`} aria-label={`Tên bộ lọc đã lưu Sổ tổng hợp ${domain}`} value={savedFilterName} onChange={(event) => setSavedFilterName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveCurrentFilter(); } }} placeholder="Ví dụ: Hồ sơ thiếu tài liệu" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          <button type="button" disabled={!savedFilterName.trim()} onClick={saveCurrentFilter} className="mobile-touch-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[11px] font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <BookmarkPlus size={14} aria-hidden="true" /> Lưu bộ lọc
          </button>
        </div>
      </div>
      }
      {showColumnConfig && <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Cấu hình cột · kéo để sắp xếp</div>
        <div className="flex flex-wrap gap-2">
          {columns.map((column) => <label key={column.id} draggable onDragStart={() => setDraggedColumnId(column.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedColumnId) reorderColumns(draggedColumnId, column.id); setDraggedColumnId(null); }} className="inline-flex cursor-move items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-600">
            <GripVertical size={12} className="text-slate-400" />
            <input type="checkbox" checked={column.visible} onChange={() => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, visible: !item.visible } : item))} />
            <span>{column.label}</span>
            <input type="number" min={80} max={640} aria-label={`Độ rộng cột ${column.label}`} value={column.width} onChange={(event) => setColumns((current) => current.map((item) => item.id === column.id ? { ...item, width: Math.max(80, Number(event.target.value) || DEFAULT_WIDTH) } : item))} onClick={(event) => event.stopPropagation()} className="mobile-touch-target min-h-11 w-14 rounded border border-slate-200 px-1 py-0.5 text-[10px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" />
          </label>)}
        </div>
      </div>}

      {cellError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{cellError}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="mobile-scroll-x overflow-x-auto">
          <table className="w-full min-w-[1400px] border-collapse text-left text-[11px]">
            <thead className="bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-600">
              <tr className="border-b-2 border-slate-300">
{visibleColumns.map((column, index) => { const sortDirection = sortState?.columnId === column.id ? sortState.direction : null; const headerTone = getColumnHeaderTone(domain, column.id); return <th key={column.id} aria-sort={sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none'} style={{ width: column.width, minWidth: column.width }} className={'relative whitespace-nowrap border-b-2 border-r border-slate-300 px-2.5 py-2 ' + headerTone + ' ' + (column.sticky || index === 0 ? 'sticky left-0 z-10 border-r-2 border-slate-300' : '')}><button type='button' aria-label={'Sắp xếp theo ' + column.label + ' (' + (sortDirection === 'asc' ? 'tăng dần' : sortDirection === 'desc' ? 'giảm dần' : 'chưa sắp xếp') + ')'} aria-pressed={Boolean(sortDirection)} onClick={() => setSortState((current) => toggleSummarySort(current, column.id))} className='inline-flex min-h-11 min-w-11 items-center gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500'>{column.label}<span aria-hidden='true' className='text-slate-400'>{sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '↕'}</span></button><span role='separator' aria-label={'Đổi độ rộng cột ' + column.label} onMouseDown={(event) => startResize(event, column)} className={'absolute right-0 top-0 h-full w-1.5 cursor-col-resize ' + (resizingColumnId === column.id ? 'bg-emerald-400' : 'hover:bg-emerald-200')} /></th>; })}
                <th className={`sticky right-0 z-10 border-b-2 border-l-2 border-slate-300 px-2.5 py-1.5 text-right font-black ${domain === 'PCN' ? 'bg-emerald-50 text-emerald-950' : 'bg-blue-50 text-blue-950'}`}>Hồ sơ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pageRows.map((row, rowIndex) => <tr key={row.id} className={"group transition-colors even:bg-slate-50/60 " + (domain === "PCN" ? "hover:bg-emerald-50/40" : "hover:bg-blue-50/40")}>
                {visibleColumns.map((column, index) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell.columnId === column.id;
                  const cellValue = summaryCellText(row.displayCells?.[column.id] ?? row.cells[column.id]);
                  const isPcnDossierCode = domain === 'PCN' && column.id === 'dossierCode' && Boolean(cellValue);
                  return <td
                        key={column.id}
                        onClick={() => !isEditing && startEdit(row, column)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget || isEditing || (event.key !== 'Enter' && event.key !== ' ')) return;
                          event.preventDefault();
                          startEdit(row, column);
                        }}
                        tabIndex={column.editable && isRowEditable(row.id) ? 0 : undefined}
                        aria-label={column.editable && isRowEditable(row.id) ? `${column.label}, dòng ${rowIndex + 1}` : undefined}
                        className={`max-w-[280px] border-r border-slate-200 px-2.5 py-4 md:py-1.5 align-top ${column.sticky || index === 0 ? 'sticky left-0 z-[1] bg-white border-r-2 border-slate-300' : ''} ${column.editable && isRowEditable(row.id) ? 'cursor-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500' : ''}`}>
                    {isEditing ? renderEditor(row, column) : isPcnDossierCode ? <button type="button" onClick={(event) => { event.stopPropagation(); onOpenRow(row.id); }} aria-label={`Mở chi tiết hồ sơ ${cellValue}`} className="max-w-[260px] whitespace-pre-wrap break-words text-left font-mono font-black text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1">{cellValue}</button> : <div title={cellValue} className={`${column.id === 'requestCode' || column.id === 'dossierCode' ? 'font-mono font-black text-slate-800' : 'font-medium text-slate-700'} max-w-[260px] whitespace-pre-wrap break-words`}>{cellValue || <span className="text-slate-300">—</span>}</div>}
                  </td>;
                })}
                <td className={"sticky right-0 z-[1] bg-white border-l-2 border-slate-300 px-2.5 py-1.5 text-right " + (domain === "PCN" ? "group-hover:bg-emerald-50/40" : "group-hover:bg-blue-50/40")}><button type="button" onClick={() => onOpenRow(row.id)} className="mobile-touch-target min-h-11 whitespace-nowrap rounded-md border border-slate-200 px-2 py-1.5 text-[9px] font-black text-emerald-700 hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">Mở hồ sơ</button>{savingRowId === row.id && <div className="mt-1 text-[9px] text-amber-600">Đang lưu…</div>}</td>
              </tr>)}
            </tbody>
          </table>
          {pageRows.length === 0 && <div className="p-8 text-center"><div className="text-sm font-black text-slate-700">{emptyTitle}</div><div className="mt-1 text-[11px] text-slate-500">{emptyDescription}</div></div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[10px] font-bold text-slate-500">
          <span>Trang {currentPage}/{totalPages}</span>
          <div className="flex items-center gap-1.5">
            <select aria-label={`Số dòng mỗi trang Sổ tổng hợp ${domain}`} value={pageSize} onChange={(event) => setPageSize(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))} className="mobile-touch-target min-h-11 rounded border border-slate-200 bg-white px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} dòng</option>)}
              <option value="ALL">Tất cả</option>
            </select>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="mobile-touch-target min-h-11 min-w-11 rounded border border-slate-200 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40">‹</button>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="mobile-touch-target min-h-11 min-w-11 rounded border border-slate-200 px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-40">›</button>
          </div>
        </div>
      </div>
      {canEdit && pageRows.some((row) => isRowEditable(row.id)) && <div className="text-[10px] text-slate-500">Ô dữ liệu cho phép sửa: bấm vào ô, Enter/Tab để lưu, Esc để hủy. Máy chủ sẽ trả lại bản ghi sau khi lưu.</div>}
    </div>
  );
}
