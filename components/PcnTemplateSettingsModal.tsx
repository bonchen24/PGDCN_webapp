'use client';

import { useRef, useState } from 'react';
import { Download, FileUp, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnTemplateDefinition } from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';

export function PcnTemplateSettingsModal({ template, onUploadTemplate, onClose }: {
  template: PcnTemplateDefinition;
  onUploadTemplate: (templateId: string, file: File) => Promise<unknown>;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Chỉ được tải lên file DOCX.');
      return;
    }
    setBusy(true);
    try {
      await onUploadTemplate(template.id, file);
      toast.success(`Đã ghi đè template ${template.displayName}.`);
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải template DOCX mới.');
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pcn-template-file-title">
    <div className="w-full max-w-xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản lý file template DOCX</p><h2 id="pcn-template-file-title" className="mt-1 truncate text-sm font-black text-slate-900">{template.displayName}</h2><p className="mt-1 text-[10px] text-slate-500">{template.fieldCode} · {template.documentKind}</p></div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng quản lý file template" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>
      </header>

      <main className="mobile-scroll-y max-h-[calc(100vh-9rem)] space-y-3 overflow-y-auto p-4">
        <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">File hiện tại</p>
          <p className="mt-1 text-xs font-black text-slate-800">{template.fileAssetId ? 'Đã có file DOCX' : 'Chưa có file DOCX'}</p>
          {template.importedAt && <p className="mt-1 text-[10px] text-slate-500">Cập nhật lần cuối: {new Date(template.importedAt).toLocaleString('vi-VN')}</p>}
          {template.fileAssetId && <a href={getPcnFileUrl(template.fileAssetId, { download: true })} className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 py-2 text-[10px] font-black text-indigo-700 hover:bg-indigo-50"><Download size={14} /> Tải xuống file hiện tại</a>}
        </section>

        <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <h3 className="text-xs font-black text-slate-800">Tải bản DOCX mới</h3>
          <p className="mt-1 text-[10px] leading-4 text-slate-600">File mới sẽ ghi đè file hiện tại của template này. Chỉ chọn file `.docx` đã hoàn thiện.</p>
          <input ref={fileInputRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-700 disabled:bg-slate-300">{busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />} {busy ? 'Đang tải lên…' : 'Tải bản mới'}</button>
        </section>
      </main>

      <footer className="flex justify-end border-t border-slate-200 bg-white px-4 py-3"><button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 disabled:opacity-50">Đóng</button></footer>
    </div>
  </div>;
}

export default PcnTemplateSettingsModal;
