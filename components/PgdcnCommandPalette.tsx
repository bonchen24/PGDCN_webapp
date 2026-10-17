'use client';

import { ArrowRight, Command, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { DepartmentScope } from '../types';
import type { PgdcnNavigationTarget } from './PgdcnSidebar';

export type PgdcnCommandRecord = {
  domain: 'PCN' | 'PGD';
  id: string;
  label: string;
  description: string;
};

type PaletteItem = {
  id: string;
  kind: 'command' | 'record';
  label: string;
  description: string;
  keywords: string;
  action: () => void;
};

type Props = {
  open: boolean;
  scopes: readonly DepartmentScope[];
  records: readonly PgdcnCommandRecord[];
  onClose: () => void;
  onNavigate: (target: PgdcnNavigationTarget) => void;
  onOpenPcn: (dossierId: string) => void;
  onOpenPgd: (requestId: string) => void;
  onOpenPcnWorkspace: () => void;
  onOpenPgdWorkspace: () => void;
};

export default function PgdcnCommandPalette({
  open,
  scopes,
  records,
  onClose,
  onNavigate,
  onOpenPcn,
  onOpenPgd,
  onOpenPcnWorkspace,
  onOpenPgdWorkspace,
}: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setSelectedIndex(0);
    const focusFrame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(focusFrame);
      if (previouslyFocusedElement?.isConnected) previouslyFocusedElement.focus();
    };
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const commands: PaletteItem[] = [
      {
        id: 'dashboard',
        kind: 'command',
        label: 'Mở Tổng quan',
        description: 'Xem việc của tôi, hàng đợi và các mốc sắp tới.',
        keywords: 'tong quan dashboard viec cua toi my work cong viec',
        action: () => { onNavigate({ domain: 'department', section: 'department-dashboard' }); onClose(); },
      },
      {
        id: 'assistant',
        kind: 'command',
        label: 'Mở Trợ lý AI',
        description: 'Soát xét hồ sơ bằng dữ liệu hiện có.',
        keywords: 'tro ly ai assistant review',
        action: () => { onNavigate({ domain: 'department', section: 'assistant' }); onClose(); },
      },
    ];
    if (scopes.includes('PCN')) {
      commands.push(
        {
          id: 'pcn-workspace',
          kind: 'command',
          label: 'Mở workspace PCN',
          description: 'Đi tới khu vực Đề nghị và hồ sơ chứng nhận.',
          keywords: 'pcn chung nhan de nghi',
          action: () => { onOpenPcnWorkspace(); onClose(); },
        },
        {
          id: 'pcn-data',
          kind: 'command',
          label: 'Mở Sổ dữ liệu PCN',
          description: 'Rà soát dữ liệu nâng cao và bộ lọc.',
          keywords: 'pcn so du lieu data filter',
          action: () => { onNavigate({ domain: 'PCN', section: 'operations' }); onClose(); },
        },
      );
    }
    if (scopes.includes('PGD')) {
      commands.push(
        {
          id: 'pgd-workspace',
          kind: 'command',
          label: 'Mở workspace PGD',
          description: 'Đi tới khu vực PYC và hồ sơ giám định.',
          keywords: 'pgd giam dinh pyc',
          action: () => { onOpenPgdWorkspace(); onClose(); },
        },
        {
          id: 'pgd-data',
          kind: 'command',
          label: 'Mở Sổ dữ liệu PGD',
          description: 'Rà soát dữ liệu nâng cao và bộ lọc.',
          keywords: 'pgd so du lieu data filter',
          action: () => { onNavigate({ domain: 'PGD', section: 'operations' }); onClose(); },
        },
      );
    }
    const recordItems = records.map((record) => ({
      id: `record-${record.domain}-${record.id}`,
      kind: 'record' as const,
      label: `Mở ${record.domain} · ${record.label}`,
      description: record.description,
      keywords: `${record.domain} ${record.label} ${record.description}`,
      action: () => { if (record.domain === 'PCN') onOpenPcn(record.id); else onOpenPgd(record.id); onClose(); },
    }));
    return [...commands, ...recordItems];
  }, [onClose, onNavigate, onOpenPcn, onOpenPcnWorkspace, onOpenPgd, onOpenPgdWorkspace, records, scopes]);

  const filteredItems = useMemo(() => {
    const tokens = query.trim().toLocaleLowerCase('vi-VN').split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return items.slice(0, 12);
    return items.filter((item) => tokens.every((token) => `${item.label} ${item.description} ${item.keywords}`.toLocaleLowerCase('vi-VN').includes(token))).slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex((value) => Math.min(value, Math.max(0, filteredItems.length - 1)));
  }, [filteredItems.length]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [filteredItems, open, selectedIndex]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const focusIsOutsideDialog = !dialog.contains(document.activeElement);

        if (!firstElement) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && (document.activeElement === firstElement || focusIsOutsideDialog)) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && (document.activeElement === lastElement || focusIsOutsideDialog)) {
          event.preventDefault();
          firstElement.focus();
        }
      } else if (event.target === inputRef.current && event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((value) => Math.min(value + 1, Math.max(0, filteredItems.length - 1)));
      } else if (event.target === inputRef.current && event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((value) => Math.max(0, value - 1));
      } else if (event.target === inputRef.current && event.key === 'Enter') {
        event.preventDefault();
        filteredItems[selectedIndex]?.action();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredItems, onClose, open, selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/45 px-3 py-4 pt-[max(1rem,8dvh)] backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="pgdcn-command-palette-title" tabIndex={-1} className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3">
          <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
          <label htmlFor="pgdcn-command-palette-input" className="sr-only">Tìm nhanh</label>
          <input
            ref={inputRef}
            id="pgdcn-command-palette-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-haspopup="listbox"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelectedIndex(0); }}
            placeholder="Tìm hồ sơ, workspace hoặc hành động…"
            className="min-h-14 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
            aria-controls="pgdcn-command-palette-list"
            aria-activedescendant={filteredItems[selectedIndex] ? `pgdcn-command-option-${filteredItems[selectedIndex].id}` : undefined}
          />
          <kbd className="hidden rounded border border-slate-200 px-1.5 py-1 text-[10px] font-bold text-slate-500 sm:inline">Esc</kbd>
          <button type="button" onClick={onClose} aria-label="Đóng tìm nhanh" className="mobile-touch-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2 text-[11px] text-slate-500">
          <h2 id="pgdcn-command-palette-title" className="font-bold">Tìm nhanh trong PGDCN</h2>
          <span>↑↓ chọn · Enter mở</span>
        </div>
        <div ref={listRef} id="pgdcn-command-palette-list" role="listbox" aria-label="Kết quả tìm nhanh" className="min-h-0 max-h-[55dvh] flex-1 overflow-y-auto overscroll-contain border-t border-slate-100 p-2">
          {filteredItems.map((item, index) => (
            <button
              key={item.id}
              id={`pgdcn-command-option-${item.id}`}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={item.action}
              className={`mobile-touch-target flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${index === selectedIndex ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.kind === 'record' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {item.kind === 'record' ? <Search size={15} aria-hidden="true" /> : <Command size={15} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-bold">{item.label}</span>
                <span className="mt-0.5 block break-words text-xs text-slate-500">{item.description}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
            </button>
          ))}
          {filteredItems.length === 0 && <div className="p-8 text-center"><Search size={22} className="mx-auto text-slate-300" aria-hidden="true" /><p className="mt-2 text-sm font-bold text-slate-700">Không tìm thấy kết quả phù hợp.</p><p className="mt-1 text-xs text-slate-500">Thử mã hồ sơ, tên khách hàng hoặc “Trợ lý AI”.</p></div>}
        </div>
      </section>
    </div>
  );
}
