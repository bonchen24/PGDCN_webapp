// Author: Codex
// OS support: Browser/React
// Description: Searchable KQTN bulk target selector with warning states.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { KqtnBulkCandidate } from '../utils/kqtnBulkMatching';
import { filterKqtnBulkCandidates, getKqtnCandidateLabel } from '../utils/kqtnCandidateFilter';

interface KqtnCandidateComboboxProps {
  value?: string;
  candidates: readonly KqtnBulkCandidate[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

function candidateIsPending(candidate: KqtnBulkCandidate): boolean {
  return Boolean(candidate.isPending);
}

function candidateDetail(candidate: KqtnBulkCandidate): string {
  return [
    candidate.reportNo,
    candidate.brand,
    candidate.sampleName,
    candidate.sealStamp,
  ].filter(Boolean).join(' · ');
}

export default function KqtnCandidateCombobox({
  value,
  candidates,
  onChange,
  disabled = false,
}: KqtnCandidateComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => candidates.find((candidate) => candidate.id === value), [candidates, value]);
  const filteredCandidates = useMemo(() => filterKqtnBulkCandidates(candidates, query), [candidates, query]);

  useEffect(() => {
    const handleOutsidePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsidePointer);
    return () => document.removeEventListener('mousedown', handleOutsidePointer);
  }, []);

  const openSearch = () => {
    if (disabled) return;
    setIsOpen(true);
    setQuery('');
  };

  const selectCandidate = (candidate: KqtnBulkCandidate) => {
    onChange(candidate.id);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setQuery('');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIsOpen(true);
      return;
    }
    if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      const firstCandidate = filteredCandidates[0];
      if (firstCandidate) selectCandidate(firstCandidate);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="flex items-center rounded-sm border border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-200">
        <Search size={14} className="ml-2 shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Tìm và chọn đầu mẫu đích"
          aria-expanded={isOpen}
          aria-controls="kqtn-bulk-candidate-listbox"
          aria-autocomplete="list"
          value={isOpen ? query : selected ? getKqtnCandidateLabel(selected) : ''}
          placeholder="Tìm mã mẫu, số phiếu, model, hãng..."
          disabled={disabled}
          onFocus={openSearch}
          onClick={openSearch}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs font-semibold text-slate-700 outline-none placeholder:font-normal placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label="Xóa mẫu đích"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('');
              setQuery('');
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className="rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={13} />
          </button>
        )}
        <button
          type="button"
          aria-label={isOpen ? 'Đóng danh sách mẫu đích' : 'Mở danh sách mẫu đích'}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (isOpen) {
              setIsOpen(false);
              setQuery('');
            } else {
              openSearch();
              inputRef.current?.focus();
            }
          }}
          className="p-2 text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed"
        >
          <ChevronDown size={14} className={isOpen ? 'rotate-180' : ''} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div
          id="kqtn-bulk-candidate-listbox"
          role="listbox"
          aria-label="Danh sách đầu mẫu đích"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border border-slate-200 bg-white p-1 shadow-xl"
        >
          {filteredCandidates.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-slate-500">Không tìm thấy đầu mẫu phù hợp.</div>
          ) : filteredCandidates.map((candidate) => {
            const pending = candidateIsPending(candidate);
            const optionClassName = 'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-xs ' + (pending
              ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              : 'text-slate-700 hover:bg-emerald-50');
            return (
              <button
                type="button"
                key={candidate.id}
                role="option"
                aria-selected={candidate.id === value}
                onClick={() => selectCandidate(candidate)}
                className={optionClassName}
              >
                {candidate.id === value ? <Check size={14} className="mt-0.5 shrink-0 text-emerald-600" /> : <span className="w-[14px] shrink-0" />}
                <span className="min-w-0">
                  <span className="block truncate font-bold">
                  {getKqtnCandidateLabel(candidate)}
                    {candidate.hasPdf ? ' · đã có PDF' : ''}
                    {pending ? ' · Chưa có KQTN' : ''}
                  </span>
                  {candidateDetail(candidate) && <span className="mt-0.5 block truncate text-[10px] text-slate-400">{candidateDetail(candidate)}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {selected && (
        <div className="mt-1 space-y-0.5 text-[10px] leading-4">
          {candidateIsPending(selected) && <div className="text-amber-700">Cảnh báo: mẫu chưa có KQTN; khi upload sẽ tạo bản ghi KQTN.</div>}
          {selected.hasPdf
            ? <div className="text-amber-700">Cảnh báo: mẫu đã có file PDF; hệ thống sẽ hỏi xác nhận ghi đè.</div>
            : <div className="text-slate-500">Mẫu chưa có file PDF trước đó.</div>}
        </div>
      )}
    </div>
  );
}

// --- End of KqtnCandidateCombobox.tsx ---
