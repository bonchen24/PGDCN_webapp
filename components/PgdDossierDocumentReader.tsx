'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileText, RefreshCw } from 'lucide-react';

import { getCurrentPgdDossierDocuments, type PgdDossierDocument } from '../utils/pgdDossier';
import { getPgdDossierDocumentDownloadUrl } from '../utils/pgdApi';
import { PGD_DOSSIER_FLOW_STEPS } from './PgdDossierFlow';

type PgdDossierPreviewKind = 'PDF' | 'IMAGE' | 'UNSUPPORTED';

const SAFE_IMAGE_MIME_TYPES = new Set(['image/avif', 'image/gif', 'image/jpeg', 'image/png', 'image/webp']);

export function getPgdDossierPreviewKind(mimeType?: string, fileName?: string): PgdDossierPreviewKind {
  const normalizedMimeType = String(mimeType || '').split(';', 1)[0].trim().toLowerCase();
  const extension = String(fileName || '').trim().toLowerCase().split('.').pop();

  if (normalizedMimeType === 'application/pdf' || (!normalizedMimeType && extension === 'pdf')) return 'PDF';
  if (SAFE_IMAGE_MIME_TYPES.has(normalizedMimeType)) return 'IMAGE';
  if (!normalizedMimeType && ['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(extension || '')) return 'IMAGE';
  return 'UNSUPPORTED';
}

type PreviewState = { documentId?: string; url?: string; error?: string };

export default function PgdDossierDocumentReader({
  documents,
  isLoading = false,
  loadError,
  onRetry,
}: {
  documents: readonly PgdDossierDocument[];
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
}) {
  const currentFiles = getCurrentPgdDossierDocuments(documents).filter((document) => Boolean(document.fileAssetId));
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [preview, setPreview] = useState<PreviewState>({});
  const selected = currentFiles.find((document) => document.id === selectedDocumentId) || currentFiles[0];
  const previewKind = selected ? getPgdDossierPreviewKind(selected.mimeType, selected.fileName) : undefined;
  const downloadUrl = selected ? getPgdDossierDocumentDownloadUrl(selected.id) : undefined;
  const previewUrl = preview.documentId === selected?.id ? preview.url : undefined;
  const previewError = preview.documentId === selected?.id ? preview.error : undefined;

  useEffect(() => {
    if (!selected || previewKind === 'UNSUPPORTED') {
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
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-900">Tài liệu hồ sơ</h3>
          <p className="mt-0.5 truncate text-[11px] text-slate-500" title={selected?.fileName || undefined}>
            {selected?.fileName || `${currentFiles.length} tệp hiện hành`}
          </p>
        </div>
        {selected && downloadUrl ? (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {previewUrl ? <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              <ExternalLink size={14} aria-hidden="true" /> Mở bản xem
            </a> : null}
            <a href={downloadUrl} download={selected.fileName} className="mobile-touch-target inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-blue-700 px-2.5 text-[11px] font-black text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(10rem,0.34fr)_minmax(0,0.66fr)]">
        <nav aria-label="Danh sách tài liệu hiện hành" className="min-w-0 border-b border-slate-200 lg:border-b-0 lg:border-r">
          {currentFiles.length > 0 ? (
            <ul className="max-h-44 overflow-y-auto p-1.5 lg:max-h-[68dvh]">
              {currentFiles.map((document) => {
                const isSelected = (selected?.id === document.id);
                const supplementaryStageLabel = document.supplementaryStageId
                  ? PGD_DOSSIER_FLOW_STEPS.find((step) => step.id === document.supplementaryStageId)?.label || document.supplementaryStageId
                  : undefined;
                return (
                  <li key={document.id}>
                    <button type="button" onClick={() => setSelectedDocumentId(document.id)} aria-pressed={isSelected} className={'mobile-touch-target min-h-11 w-full rounded-lg px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ' + (isSelected ? 'bg-blue-50 text-blue-950' : 'text-slate-700 hover:bg-slate-50')}>
                      <span className="block break-words text-[11px] font-bold leading-4">{document.title}</span>
                      <span className="mt-0.5 block break-all text-[10px] text-slate-500">{document.fileName} · v{document.version}</span>
                      {supplementaryStageLabel ? <span className="mt-1 inline-flex rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">Tệp phụ trợ · {supplementaryStageLabel}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-4 text-xs text-slate-500">{isLoading ? 'Đang tải danh sách tài liệu…' : 'Chưa có tệp chứng từ trong hồ sơ.'}</p>
          )}
        </nav>

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
