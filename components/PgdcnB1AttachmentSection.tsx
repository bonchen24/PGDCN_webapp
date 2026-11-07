'use client';

import React, { useMemo, useRef, useState } from 'react';
import { FileText, Image as ImageIcon, Upload, X } from 'lucide-react';
import {
  createPgdcnB1SelectedAttachment,
  formatPgdcnFileSize,
  type PgdcnB1SelectedAttachment,
  type ResolvedB1AttachmentRequirement,
} from '@/utils/pgdcnB1Attachments';

type PgdcnB1AttachmentSectionProps = {
  attachments: readonly PgdcnB1SelectedAttachment[];
  onChange: (attachments: PgdcnB1SelectedAttachment[]) => void;
  requirements?: readonly ResolvedB1AttachmentRequirement[];
  disabled?: boolean;
  locked?: boolean;
  idPrefix?: string;
  accent?: 'emerald' | 'blue';
};

const ACCEPTED_FILE_TYPES = '.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp,.avif';
const ACCEPTED_FILE_EXTENSIONS = new Set(['pdf', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']);

function isSupportedFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return ACCEPTED_FILE_EXTENSIONS.has(extension);
}

export function PgdcnB1AttachmentSection({
  attachments,
  onChange,
  requirements = [],
  disabled = false,
  locked = false,
  idPrefix = 'pgdcn-b1',
  accent = 'emerald',
}: PgdcnB1AttachmentSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState('');
  const inputId = `${idPrefix}-attachment-input`;
  const headingId = `${idPrefix}-attachments-heading`;
  const focusClasses = accent === 'blue'
    ? 'focus-within:ring-blue-500 focus:border-blue-500 focus:ring-blue-500'
    : 'focus-within:ring-emerald-500 focus:border-emerald-500 focus:ring-emerald-500';
  const dropColors = accent === 'blue'
    ? 'border-blue-500 bg-blue-50 text-blue-800'
    : 'border-emerald-500 bg-emerald-50 text-emerald-800';
  const unavailable = disabled || locked;

  const requirementOptions = useMemo(() => {
    const templateOptions = (requirements || []).map((req) => ({
      value: req.requirementId,
      label: `${req.displayName} (${req.requirementId})`,
      requirement: req,
    }));
    return [
      ...templateOptions,
      { value: 'PENDING_MAPPING', label: 'Tài liệu bổ sung khác', requirement: undefined },
    ];
  }, [requirements]);

  const addFiles = (files: FileList | File[]) => {
    const selected = Array.from(files);
    const accepted = selected.filter(isSupportedFile);
    const rejectedCount = selected.length - accepted.length;
    setSelectionError(rejectedCount > 0 ? 'Chỉ nhận PDF, DOCX và tệp ảnh JPG, PNG, GIF, WEBP hoặc AVIF.' : '');
    if (accepted.length > 0) {
      const newAttachments = accepted.map((file) =>
        createPgdcnB1SelectedAttachment(file, 'OTHER', {
          requirementId: 'PENDING_MAPPING',
          displayName: 'Tài liệu bổ sung khác',
          documentKind: undefined,
          mappingStatus: 'PENDING_MAPPING',
        })
      );
      onChange([...attachments, ...newAttachments]);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const updateRequirement = (id: string, selectedValue: string) => {
    if (unavailable) return;
    const opt = requirementOptions.find((item) => item.value === selectedValue);
    onChange(
      attachments.map((attachment) => {
        if (attachment.id !== id) return attachment;
        if (selectedValue === 'PENDING_MAPPING') {
          return {
            ...attachment,
            requirementId: 'PENDING_MAPPING',
            requirementCode: undefined,
            displayName: 'Tài liệu bổ sung khác',
            documentKind: undefined,
            mappingStatus: 'PENDING_MAPPING',
            kind: 'OTHER',
          };
        }
        return {
          ...attachment,
          requirementId: opt?.value || selectedValue,
          requirementCode: opt?.requirement?.requirementCode || selectedValue,
          displayName: opt?.requirement?.displayName || opt?.label || selectedValue,
          documentKind: opt?.requirement?.documentKind,
          mappingStatus: 'MAPPED',
          kind: 'OTHER',
        };
      })
    );
  };

  const removeFile = (id: string) => {
    if (unavailable) return;
    onChange(attachments.filter((attachment) => attachment.id !== id));
  };

  return (
    <section aria-labelledby={headingId} className="space-y-2 border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-xs font-black text-slate-800">Tệp đính kèm (tùy chọn)</h2>
          <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Có thể tạo hồ sơ trước rồi bổ sung tệp ở bước sau. Hỗ trợ PDF, DOCX và ảnh.</p>
        </div>
        <label htmlFor={inputId} className={`mobile-touch-target inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-50 focus-within:ring-2 ${focusClasses.split(' ')[0]} ${unavailable ? 'pointer-events-none opacity-50' : ''}`}>
          <Upload size={14} aria-hidden="true" /> Chọn tệp
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          disabled={unavailable}
          className="sr-only"
          aria-label="Chọn nhiều tệp đính kèm B1"
          onChange={(event) => { if (event.currentTarget.files) addFiles(event.currentTarget.files); }}
        />
      </div>

      <div
        onDragOver={(event) => { event.preventDefault(); if (!unavailable) setDragging(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!unavailable) addFiles(event.dataTransfer.files); }}
        className={`rounded-lg border border-dashed px-3 py-3 text-center text-[10px] ${dragging ? dropColors : 'border-slate-300 bg-slate-50/70 text-slate-500'} ${unavailable ? 'opacity-60' : ''}`}
      >
        Kéo nhiều tệp vào đây hoặc dùng nút <span className="font-black">Chọn tệp</span>.
      </div>

      {selectionError && <p role="alert" className="text-[10px] font-bold text-rose-700">{selectionError}</p>}

      {attachments.length > 0 && (
        <ul aria-label="Danh sách tệp B1 đã chọn" className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {attachments.map((attachment) => {
            const isImage = attachment.file.type.startsWith('image/');
            const Icon = isImage ? ImageIcon : FileText;
            const currentReqId = attachment.requirementId || 'PENDING_MAPPING';
            const currentReq = requirementOptions.find((item) => item.value === currentReqId);
            const displayLabel = currentReq?.label || attachment.displayName || (currentReqId === 'PENDING_MAPPING' ? 'Tài liệu bổ sung khác' : currentReqId);

            return (
              <li key={attachment.id} className="grid min-w-0 gap-2 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.85fr)_auto] sm:items-center">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-bold text-slate-800" title={attachment.file.name}>{attachment.file.name}</div>
                    <div className="text-[9px] text-slate-500">{formatPgdcnFileSize(attachment.file.size)} · {attachment.status === 'UPLOADED' ? 'Đã tải lên' : attachment.status === 'UPLOADING' ? 'Đang tải lên…' : attachment.status === 'FAILED' ? 'Tải chưa thành công' : displayLabel}</div>
                    {attachment.error && <p role="alert" className="mt-0.5 break-words text-[9px] font-semibold text-rose-700">{attachment.error}</p>}
                  </div>
                </div>
                <select
                  aria-label={`Loại chứng từ · ${attachment.file.name}`}
                  value={currentReqId}
                  disabled={unavailable || attachment.status === 'UPLOADED'}
                  onChange={(event) => updateRequirement(attachment.id, event.target.value)}
                  className={`mobile-touch-target min-h-10 w-full rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700 focus:outline-none focus:ring-1 ${focusClasses.split(' ').slice(1).join(' ')} disabled:bg-slate-50`}
                >
                  {requirementOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <button
                  type="button"
                  disabled={unavailable || attachment.status === 'UPLOADED'}
                  onClick={() => removeFile(attachment.id)}
                  aria-label={`Xóa tệp ${attachment.file.name}`}
                  className="mobile-touch-target inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-40"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default PgdcnB1AttachmentSection;
