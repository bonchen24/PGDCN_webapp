'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, RefreshCw } from 'lucide-react';

import { getCurrentPgdDossierDocuments, type PgdDossierDocument } from '../utils/pgdDossier';
import { getPgdDossierDocumentDownloadUrl } from '../utils/pgdApi';
import { PgdcnDocxPreview } from './PgdcnDocxPreview';

type PgdDossierPreviewKind = 'PDF' | 'IMAGE' | 'DOCX' | 'UNSUPPORTED';

const SAFE_IMAGE_MIME_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);

export function getPgdDossierPreviewKind(mimeType?: string, fileName?: string): PgdDossierPreviewKind {
  const normalizedMimeType = String(mimeType || '').split(';', 1)[0].trim().toLowerCase();
  const extension = String(fileName || '').trim().toLowerCase().split('.').pop();

  if (normalizedMimeType === 'application/pdf' || (!normalizedMimeType && extension === 'pdf')) return 'PDF';
  if (normalizedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || (!normalizedMimeType && extension === 'docx')) return 'DOCX';
  if (SAFE_IMAGE_MIME_TYPES.has(normalizedMimeType)) return 'IMAGE';
  if (!normalizedMimeType && ['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(extension || '')) return 'IMAGE';
  return 'UNSUPPORTED';
}

type PreviewState = { documentId?: string; url?: string; text?: string; error?: string };

export default function PgdDossierDocumentReader({
  documents,
  isLoading = false,
  loadError,
  onRetry,
  selectedDocumentId: externalSelectedDocumentId,
  onSelectDocumentId,
}: {
  documents: readonly PgdDossierDocument[];
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  selectedDocumentId?: string;
  onSelectDocumentId?: (id: string) => void;
}) {
  const currentFiles = getCurrentPgdDossierDocuments(documents).filter((document) => Boolean(document.fileAssetId));
  const [internalSelectedDocumentId, setInternalSelectedDocumentId] = useState('');
  const selectedDocumentId = externalSelectedDocumentId || internalSelectedDocumentId;
  const setSelectedDocumentId = (id: string) => {
    setInternalSelectedDocumentId(id);
    onSelectDocumentId?.(id);
  };
  const [preview, setPreview] = useState<PreviewState>({});
  const selected = currentFiles.find((document) => document.id === selectedDocumentId) || currentFiles[0];
  const previewKind = selected ? getPgdDossierPreviewKind(selected.mimeType, selected.fileName) : undefined;
  const downloadUrl = selected ? getPgdDossierDocumentDownloadUrl(selected.id) : undefined;
  const inlineUrl = selected ? getPgdDossierDocumentDownloadUrl(selected.id, { inline: true }) : undefined;
  const previewUrl = preview.documentId === selected?.id ? preview.url : undefined;
  const previewError = preview.documentId === selected?.id ? preview.error : undefined;

  useEffect(() => {
    if (!selected || previewKind === 'UNSUPPORTED' || previewKind === 'DOCX') {
      setPreview({ documentId: selected?.id });
      return;
    }

    const abortController = new AbortController();
    let objectUrl: string | undefined;
    setPreview({ documentId: selected.id });

    void fetch(getPgdDossierDocumentDownloadUrl(selected.id), {
      method: 'GET',
      credentials: 'same-origin',
      signal: abortController.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(body || `Không thể tải tài liệu (HTTP ${response.status}).`);
      }
      return response.blob();
    }).then((blob) => {
      if (abortController.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setPreview({ documentId: selected.id, url: objectUrl });
    }).catch((error: unknown) => {
      if (abortController.signal.aborted) return;
      setPreview({
        documentId: selected.id,
        error: error instanceof Error ? error.message : 'Không thể tải bản xem trước tài liệu.',
      });
    });

    return () => {
      abortController.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected?.id, previewKind]);

  return (
    <section data-testid="pgd-dossier-document-reader" aria-label="Đọc tài liệu hồ sơ PGD" className="flex min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900">Tài liệu hồ sơ</h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-500" title={selected?.fileName || undefined}>
            {selected?.fileName || `${currentFiles.length} tệp hiện hành`}
          </p>
        </div>
        {selected && downloadUrl ? (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {(previewUrl || previewKind === 'DOCX') ? <a href={previewKind === 'DOCX' ? inlineUrl : previewUrl} target="_blank" rel="noopener noreferrer" className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-8">
              <ExternalLink size={14} aria-hidden="true" /> Mở bản xem
            </a> : null}
            <a href={downloadUrl} download={selected.fileName} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-lg bg-blue-700 px-2.5 text-[11px] font-black text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:min-h-8">
              <Download size={14} aria-hidden="true" /> Tải xuống
            </a>
          </div>
        ) : null}
      </header>

      {loadError ? (
        <div role="alert" className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>{loadError}</span>
          {onRetry ? <button type="button" onClick={onRetry} disabled={isLoading} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 font-bold disabled:opacity-60"><RefreshCw size={13} aria-hidden="true" /> Tải lại</button> : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1">

        <div className="min-h-[18rem] min-w-0 overflow-auto bg-slate-50 p-2.5">
          {!selected ? (
            <div className="flex min-h-[18rem] items-center justify-center text-center text-xs text-slate-500">Chọn tài liệu để xem.</div>
          ) : previewKind === 'UNSUPPORTED' ? (
            <div className="flex min-h-[18rem] flex-col items-center justify-center gap-2 px-4 text-center">
              <FileText size={28} aria-hidden="true" className="text-slate-400" />
              <p className="text-sm font-semibold text-slate-700">Định dạng này chưa hỗ trợ xem trực tiếp trong trình duyệt.</p>
              <p className="text-xs text-slate-500">Tải tệp xuống để mở bằng ứng dụng phù hợp.</p>
            </div>
          ) : previewError ? (
            <div role="alert" className="flex min-h-[18rem] flex-col items-center justify-center gap-2 text-center text-xs text-amber-900">
              <p>{previewError}</p>
              {downloadUrl ? <a href={downloadUrl} download={selected.fileName} className="font-bold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Tải tệp xuống</a> : null}
            </div>
          ) : previewKind === 'DOCX' ? (
            <PgdcnDocxPreview url={downloadUrl!} fileName={selected.fileName} />
          ) : previewUrl ? (
            previewKind === 'PDF'
              ? <iframe title={'Xem trước ' + selected.fileName} src={previewUrl} className="h-[62dvh] min-h-[18rem] w-full rounded-md border border-slate-200 bg-white" />
              : <div className="flex min-h-[18rem] items-center justify-center rounded-md bg-slate-900/5 p-2"><img src={previewUrl} alt={selected.fileName} className="max-h-[62dvh] max-w-full object-contain" /></div>
          ) : (
            <div role="status" className="flex min-h-[18rem] items-center justify-center gap-2 text-xs text-slate-500"><RefreshCw size={14} className="animate-spin" aria-hidden="true" />Đang tải bản xem trước…</div>
          )}
        </div>
      </div>
    </section>
  );
}
