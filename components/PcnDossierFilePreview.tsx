'use client';

import React, { useState } from 'react';
import { ExternalLink, FileText, Maximize2, X } from 'lucide-react';

import type { PcnDossierDocumentVersion } from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnFilePreviewKind } from '../utils/pcnFilePreview';

function PcnDossierFilePreview({ version, onClose }: { version: PcnDossierDocumentVersion; onClose: () => void }) {
  const previewKind = getPcnFilePreviewKind(version.mimeType, version.fileName);
  const fileUrl = getPcnFileUrl(version.assetId);

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Xem nhanh ${version.fileName}`}>
    <div className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-black text-slate-800"><FileText size={15} className="shrink-0 text-indigo-600" /> <span className="truncate">{version.fileName}</span></div>
          <p className="mt-1 text-[10px] text-slate-500">Xem nhanh qua vùng bảo vệ riêng tư • Phiên tải {version.uploadedAt}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100"><ExternalLink size={13} /> Mở tệp riêng tư</a>
          <button type="button" onClick={onClose} aria-label="Đóng xem nhanh" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>
      </header>
      <div className="min-h-[18rem] flex-1 overflow-auto bg-slate-100 p-3 sm:min-h-[32rem]">
        {previewKind === 'PDF' && <iframe title={`Xem nhanh ${version.fileName}`} src={fileUrl} className="h-[72dvh] min-h-[28rem] w-full rounded-lg border border-slate-200 bg-white" />}
        {previewKind === 'IMAGE' && <div className="flex min-h-[28rem] items-center justify-center rounded-lg border border-slate-200 bg-slate-900/5 p-3"><img src={fileUrl} alt={version.fileName} className="max-h-[72dvh] max-w-full rounded-md object-contain shadow-sm" /></div>}
        {previewKind === 'UNSUPPORTED' && <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center"><FileText size={30} className="text-slate-400" /><p className="mt-3 text-xs font-black text-slate-700">Định dạng này chưa hỗ trợ xem nhanh</p><p className="mt-1 max-w-md text-[10px] leading-4 text-slate-500">Tệp vẫn được bảo vệ trong vùng riêng tư. Hãy mở tệp để xem bằng ứng dụng phù hợp.</p><a href={fileUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-700"><ExternalLink size={13} /> Mở tệp riêng tư</a></div>}
      </div>
    </div>
  </div>;
}

export function PcnFilePreviewButton({ version }: { version: PcnDossierDocumentVersion }) {
  const [open, setOpen] = useState(false);
  const previewKind = getPcnFilePreviewKind(version.mimeType, version.fileName);
  if (previewKind === 'UNSUPPORTED') return null;

  return <><button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-1 font-bold text-indigo-700 hover:bg-indigo-100" title="Xem nhanh trong hồ sơ"><Maximize2 size={11} /> Xem nhanh</button>{open && <PcnDossierFilePreview version={version} onClose={() => setOpen(false)} />}</>;
}

// --- End of PcnDossierFilePreview.tsx ---
