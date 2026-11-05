'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, Maximize2, X } from 'lucide-react';

import type { PcnDossierDocumentVersion } from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnFilePreviewKind } from '../utils/pcnFilePreview';
import { PgdcnDocxPreview } from './PgdcnDocxPreview';

function PcnDossierFilePreview({
  version,
  onClose,
  triggerRef,
}: {
  version: PcnDossierDocumentVersion;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const previewKind = getPcnFilePreviewKind(version.mimeType, version.fileName);
  const fileUrl = getPcnFileUrl(version.assetId);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusReturnTarget = triggerRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    titleRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;

      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])',
      ));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusIsOutsideDialog = !(activeElement instanceof Node) || !dialog.contains(activeElement);

      if (event.shiftKey && (focusIsOutsideDialog || activeElement === firstElement || activeElement === titleRef.current)) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (focusIsOutsideDialog || activeElement === lastElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;

      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      else focusReturnTarget?.focus();
    };
  }, [onClose, triggerRef]);

  return <div
    ref={dialogRef}
    className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/70 px-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pcn-file-preview-title"
  >
    <div className="flex h-full max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
      <header className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="min-w-0">
          <h2 id="pcn-file-preview-title" ref={titleRef} tabIndex={-1} className="flex items-start gap-2 text-sm font-bold leading-5 text-slate-900 focus:outline-none">
            <FileText size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-indigo-600" />
            <span className="min-w-0 whitespace-normal break-words [overflow-wrap:anywhere]">{version.fileName}</span>
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">Xem nhanh trong khu vực bảo vệ riêng tư · Tải lên {version.uploadedAt}</p>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <ExternalLink size={16} aria-hidden="true" /> Mở tệp riêng tư
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng xem nhanh"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain bg-slate-100 p-3 sm:p-4">
        {previewKind === 'PDF' && <iframe title={`Xem nhanh ${version.fileName}`} src={fileUrl} className="h-[68dvh] min-h-[12rem] w-full rounded-lg border border-slate-200 bg-white sm:h-[72dvh] sm:min-h-[24rem]" />}
        {previewKind === 'IMAGE' && <div className="flex min-h-[12rem] items-center justify-center rounded-lg border border-slate-200 bg-slate-900/5 p-3 sm:min-h-[24rem]"><img src={fileUrl} alt={version.fileName} className="max-h-[68dvh] max-w-full rounded-md object-contain shadow-sm sm:max-h-[72dvh]" /></div>}
        {previewKind === 'DOCX' && <PgdcnDocxPreview url={fileUrl} fileName={version.fileName} />}
      </div>
    </div>
  </div>;
}

export function PcnFilePreviewButton({ version }: { version: PcnDossierDocumentVersion }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previewKind = getPcnFilePreviewKind(version.mimeType, version.fileName);

  if (previewKind === 'UNSUPPORTED') {
    const downloadUrl = getPcnFileUrl(version.assetId, { download: true });

    return <a
      href={downloadUrl}
      aria-label={`Tải xuống ${version.fileName}`}
      title={`Tải xuống ${version.fileName}`}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
    >
      <ExternalLink size={16} aria-hidden="true" /> Tải xuống
    </a>;
  }

  return <><button
    ref={triggerRef}
    type="button"
    onClick={() => setOpen(true)}
    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
    title="Xem nhanh trong hồ sơ"
  ><Maximize2 size={16} aria-hidden="true" /> Xem nhanh</button>{open && <PcnDossierFilePreview version={version} onClose={() => setOpen(false)} triggerRef={triggerRef} />}</>;
}

// --- End of PcnDossierFilePreview.tsx ---
