'use client';

import { X } from 'lucide-react';

import type { PgdDocumentTemplate } from '../utils/pgdDocumentTemplates';
import { PgdTemplateSettingsWorkspace } from './PgdDocumentGenerationPanel';

type PgdDocxSettingsModalProps = {
  templates: PgdDocumentTemplate[];
  canMutate: boolean;
  onClose: () => void;
};

export default function PgdDocxSettingsModal({ templates, canMutate, onClose }: PgdDocxSettingsModalProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 md:p-6" role="dialog" aria-modal="true" aria-label="Cài đặt DOCX PGD">
      <section className="relative my-2 w-full max-w-6xl overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:my-4">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Soạn thảo tài liệu</div>
            <h2 className="mt-0.5 text-sm font-black text-slate-900">Cài đặt DOCX</h2>
            <p className="mt-1 text-[10px] text-slate-500">Chỉ quản lý file template DOCX và placeholder của PGD.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng cài đặt DOCX PGD" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </header>
        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto">
          <PgdTemplateSettingsWorkspace templates={templates} canMutate={canMutate} />
        </div>
      </section>
    </div>
  );
}
