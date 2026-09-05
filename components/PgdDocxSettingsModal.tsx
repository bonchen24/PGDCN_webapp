'use client';

import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { normalizePgdTemplateCells, type PgdDocumentTemplate } from '../utils/pgdDocumentTemplates';
import { usePgdStore } from '../store-pgd';
import PgdCellManager from './PgdCellManager';
import { PgdTemplateSettingsWorkspace } from './PgdDocumentGenerationPanel';

type PgdDocxSettingsModalProps = {
  templates: PgdDocumentTemplate[];
  canMutate: boolean;
  onClose: () => void;
};

export default function PgdDocxSettingsModal({ templates, canMutate, onClose }: PgdDocxSettingsModalProps) {
  const saveDocumentTemplate = usePgdStore((state) => state.saveDocumentTemplate);
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
  const selected = useMemo(() => templates.find((template) => template.id === selectedId) || templates[0], [selectedId, templates]);
  const [draft, setDraft] = useState<PgdDocumentTemplate | undefined>(selected);
  const [savingCells, setSavingCells] = useState(false);

  useEffect(() => setDraft(selected), [selected]);

  const updateCells = (cells: PgdDocumentTemplate['cells']) => {
    const normalizedCells = normalizePgdTemplateCells(cells);
    setDraft((current) => current
      ? {
        ...current,
        cells: normalizedCells,
        placeholderKeys: normalizedCells.map((cell) => cell.key),
        requiredPlaceholderKeys: normalizedCells.filter((cell) => cell.required && cell.active !== false).map((cell) => cell.key),
      }
      : current);
  };

  const saveCells = async () => {
    if (!draft || !canMutate || draft.status === 'PUBLISHED' || draft.status === 'RETIRED') return;
    setSavingCells(true);
    try {
      await saveDocumentTemplate({ ...draft, status: 'DRAFT' });
      toast.success('Đã lưu cấu hình cell DOCX PGD.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu cấu hình cell DOCX PGD.');
    } finally {
      setSavingCells(false);
    }
  };

  const cellsReadOnly = !canMutate || !draft || draft.status === 'PUBLISHED' || draft.status === 'RETIRED';

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
          <section className="space-y-3 border-t border-slate-200 bg-slate-50 p-3 md:p-5" aria-label="Cấu hình cell DOCX PGD">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <label className="min-w-64 flex-1"><span className="mb-1 block text-[9px] font-black text-slate-500">Template để quản lý cell</span><select value={draft?.id || ''} onChange={(event) => setSelectedId(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400"><option value="">Chưa có template PGD</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.code} · {template.name} · v{template.version}</option>)}</select></label>
              <button type="button" disabled={cellsReadOnly || savingCells} onClick={() => void saveCells()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white disabled:opacity-50">{savingCells ? 'Đang lưu...' : 'Lưu cấu hình cell'}</button>
            </div>
            {draft ? <PgdCellManager cells={draft.cells} onChange={updateCells} readOnly={cellsReadOnly} title="Quản lý cell và placeholder PGD" /> : <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-[10px] text-slate-400">Chưa có template PGD để cấu hình cell.</p>}
          </section>
        </div>
      </section>
    </div>
  );
}
