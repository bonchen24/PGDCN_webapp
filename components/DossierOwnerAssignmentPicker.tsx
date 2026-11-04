'use client';

import React, { useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import PcnCatalogCombobox from './PcnCatalogCombobox';

export type DossierOwnerAssignmentOption = {
  username: string;
  displayName: string;
  searchText?: string;
  description?: string;
};

export type DossierOwnerAssignmentPickerProps = {
  options: readonly DossierOwnerAssignmentOption[];
  ownerUsername?: string;
  ownerDisplayName?: string;
  canAssign: boolean;
  disabled?: boolean;
  compact?: boolean;
  onAssign: (username: string) => Promise<void>;
};

const normalizeUsername = (value: string) => value.trim().toLowerCase();
const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';

export function DossierOwnerAssignmentPicker({
  options, ownerUsername = '', ownerDisplayName = '', canAssign,
  disabled = false, compact = false, onAssign,
}: DossierOwnerAssignmentPickerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const savingRef = useRef(false);
  const owner = ownerUsername.trim();
  const selected = options.find((option) => option.username === selectedUsername);
  const changed = Boolean(selected && normalizeUsername(selected.username) !== normalizeUsername(owner));
  const blocked = saving || disabled || !canAssign;

  const changeOpen = (nextOpen: boolean) => {
    if (savingRef.current || (nextOpen && (disabled || !canAssign))) return;
    if (nextOpen) {
      setSelectedUsername(owner);
      setError('');
      setSuccess('');
    }
    setOpen(nextOpen);
  };

  const confirmAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current || blocked || !changed || !selected) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await onAssign(selected.username);
      setSuccess(`Đã phân công cho ${selected.displayName}.`);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu phân công. Vui lòng thử lại.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className={`min-w-0 ${compact ? 'text-[11px]' : 'text-sm'}`}>
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className={owner ? 'break-words font-semibold text-slate-700' : 'text-slate-500'}>
            {owner ? (ownerDisplayName || owner) : 'Chưa gán người thực hiện'}
          </span>
          {canAssign && <Dialog.Trigger asChild>
            <button type="button" disabled={disabled || saving} className={`min-h-9 rounded-md px-2 py-1 text-[11px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${focusClass} ${owner ? 'text-emerald-700 hover:bg-emerald-50' : 'border border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800'}`}>
              {owner ? 'Chuyển người thực hiện' : 'Phân công người thực hiện'}
            </button>
          </Dialog.Trigger>}
        </div>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-900/20" />
          <Dialog.Content
            className="fixed left-1/2 top-[min(8vh,4rem)] z-[101] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-4 shadow-lg focus:outline-none"
            onEscapeKeyDown={(event) => { if (savingRef.current) event.preventDefault(); }}
            onPointerDownOutside={(event) => { if (savingRef.current) event.preventDefault(); }}
          >
            <Dialog.Title className="text-sm font-bold text-slate-900">{owner ? 'Chuyển người thực hiện' : 'Phân công người thực hiện'}</Dialog.Title>
            <Dialog.Description className="mb-3 mt-1 text-xs text-slate-500">
              {owner ? `Hiện tại: ${ownerDisplayName || owner}. ` : ''}Chọn nhân viên rồi xác nhận để lưu phân công.
            </Dialog.Description>
            <form onSubmit={(event) => { void confirmAssignment(event); }} aria-busy={saving}>
              <div className="min-h-[min(20rem,48dvh)] [&_[role=listbox]]:max-h-[min(16rem,32dvh)]">
                <PcnCatalogCombobox
                  id={`${id}-employee`}
                  label="Tìm nhân viên"
                  value={selectedUsername}
                  options={options.map((option) => ({
                    value: option.username,
                    label: option.displayName,
                    searchText: option.searchText,
                    description: option.description || option.username,
                  }))}
                  onChange={(username) => { setSelectedUsername(username); setError(''); }}
                  disabled={blocked}
                />
              </div>
              {options.length === 0 && <p className="mt-2 text-xs text-slate-500">Chưa có nhân viên phù hợp để phân công.</p>}
              {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" disabled={saving} className={`min-h-9 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 disabled:opacity-50 ${focusClass}`}>Hủy</button>
                </Dialog.Close>
                <button type="submit" disabled={blocked || !changed} className={`min-h-9 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}>
                  {saving ? 'Đang lưu…' : 'Xác nhận phân công'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {success && <p role="status" className="mt-1 text-xs text-emerald-700">{success}</p>}
    </div>
  );
}

export default DossierOwnerAssignmentPicker;
