'use client';

import { X } from 'lucide-react';

import type { PcnTemplateDefinition, PcnTemplateReviewAction } from '../types';
import { PcnTemplateAdminPanel } from './PcnSettingsView';

type PcnDocxSettingsModalProps = {
  templates: PcnTemplateDefinition[];
  onUploadTemplate: (templateId: string, file: File) => Promise<unknown>;
  onReviewTemplate: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<unknown>;
  onClose: () => void;
};

export default function PcnDocxSettingsModal({ templates, onUploadTemplate, onReviewTemplate, onClose }: PcnDocxSettingsModalProps) {
  return (
    <div data-testid="pcn-docx-settings-modal" className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 md:p-6" role="dialog" aria-modal="true" aria-label="Cài đặt DOCX PCN">
      <section className="relative my-2 flex max-h-[calc(100dvh-1rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:my-4 md:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600">PCN · Soạn thảo tài liệu</div>
            <h2 className="mt-0.5 text-sm font-black text-slate-900">Cài đặt DOCX</h2>
            <p className="mt-1 text-[10px] text-slate-500">Quản lý template chính thức ngay trong workspace soạn thảo.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng cài đặt DOCX PCN" className="mobile-touch-target inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"><X size={18} /></button>
        </header>
        <main className="mobile-scroll-y min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
          <PcnTemplateAdminPanel templates={templates} onUploadTemplate={onUploadTemplate} onReviewTemplate={onReviewTemplate} />
        </main>
      </section>
    </div>
  );
}
