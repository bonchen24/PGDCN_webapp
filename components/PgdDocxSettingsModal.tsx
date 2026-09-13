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
    <div data-testid="pgd-docx-settings-modal" className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-2 md:p-6" role="dialog" aria-modal="true" aria-label="Cài đặt DOCX PGD">
      <section className="relative my-2 flex max-h-[calc(100dvh-1rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl md:my-4 md:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Soạn thảo tài liệu</div>
            <h2 className="mt-0.5 text-sm font-black text-slate-900">Cài đặt DOCX</h2>
            <p className="mt-1 text-[10px] text-slate-500">Quản lý tệp mẫu; ánh xạ dữ liệu được lấy từ mã trường và tệp DOCX.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng cài đặt DOCX PGD" className="mobile-touch-target inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><X size={18} /></button>
        </header>
        <main data-testid="pgd-docx-settings-body" className="mobile-scroll-y min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
          <PgdTemplateSettingsWorkspace templates={templates} canMutate={canMutate} />
          <section className="border-t border-slate-200 bg-white p-3 md:p-5" aria-label="Thông tin mapping DOCX PGD">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3"><div className="text-[9px] font-black uppercase tracking-wide text-blue-700">Mẫu hiện hành</div><div className="mt-1 text-xs font-black text-slate-800">{templates.length}</div><div className="mt-1 text-[10px] text-slate-500">Các tệp được quản lý theo danh mục PGD.</div></div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Nguồn mapping</div><div className="mt-1 text-xs font-black text-slate-800">Code + DOCX</div><div className="mt-1 text-[10px] text-slate-500">Không cần gắn hoặc sửa từng khóa trên màn hình.</div></div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="text-[9px] font-black uppercase tracking-wide text-slate-500">Form nhập liệu</div><div className="mt-1 text-xs font-black text-slate-800">Theo nhãn nghiệp vụ</div><div className="mt-1 text-[10px] text-slate-500">Người dùng chỉ nhập giá trị theo field đã định nghĩa.</div></div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"><div className="text-[9px] font-black uppercase tracking-wide text-emerald-700">Kiểm tra</div><div className="mt-1 text-xs font-black text-slate-800">Trước khi sinh tài liệu</div><div className="mt-1 text-[10px] text-slate-500">Hệ thống kiểm tra ánh xạ và dữ liệu trước khi sinh tệp.</div></div>
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}
