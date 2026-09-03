'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Save, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnQc20ScopeConfiguration, PcnSettings } from '../types';
import { confirmPcnQc20Scope, fetchPcnQc20Readiness } from '../utils/pcnQc20ScopeApi';
import { normalizePcnQc20ScopeConfiguration } from '../utils/pcnQc20ScopeGovernance';
import type { PcnQc20Readiness } from '../utils/pcnQc20ScopeGovernance';

type CompositionDraft = {
  element: string;
  minPercent: string;
  maxPercent: string;
  source: string;
};

type ScopeDraft = {
  scopeVersion: string;
  sourceReferences: string;
  productForms: string;
  grades: string;
  hsCodes: string;
  appliedStandards: string;
  confirmationNote: string;
  chemicalCompositionRequirements: CompositionDraft[];
};

function splitList(value: string): string[] {
  return Array.from(new Set(value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean)));
}

function toDraft(scope: PcnQc20ScopeConfiguration): ScopeDraft {
  const normalized = normalizePcnQc20ScopeConfiguration(scope);
  return {
    scopeVersion: normalized.scopeVersion,
    sourceReferences: normalized.sourceReferences.join('\n'),
    productForms: normalized.productForms.join('\n'),
    grades: normalized.grades.join('\n'),
    hsCodes: normalized.hsCodes.join('\n'),
    appliedStandards: normalized.appliedStandards.join('\n'),
    confirmationNote: normalized.confirmationNote || '',
    chemicalCompositionRequirements: normalized.chemicalCompositionRequirements.length > 0
      ? normalized.chemicalCompositionRequirements.map((item) => ({
        element: item.element,
        minPercent: item.minPercent === undefined ? '' : String(item.minPercent),
        maxPercent: item.maxPercent === undefined ? '' : String(item.maxPercent),
        source: item.source || '',
      }))
      : [{ element: '', minPercent: '', maxPercent: '', source: '' }],
  };
}

function emptyComposition(): CompositionDraft {
  return { element: '', minPercent: '', maxPercent: '', source: '' };
}

export default function PcnQc20ScopePanel({ scope, onConfirmed }: { scope: PcnQc20ScopeConfiguration; onConfirmed: (settings: PcnSettings) => void }) {
  const [draft, setDraft] = useState<ScopeDraft>(() => toDraft(scope));
  const [saving, setSaving] = useState(false);
  const [readiness, setReadiness] = useState<PcnQc20Readiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);

  useEffect(() => setDraft(toDraft(scope)), [scope]);

  useEffect(() => {
    let active = true;
    setReadinessLoading(true);
    void fetchPcnQc20Readiness().then((next) => { if (active) setReadiness(next); }).catch(() => { if (active) setReadiness(null); }).finally(() => { if (active) setReadinessLoading(false); });
    return () => { active = false; };
  }, [scope.status, scope.scopeVersion, scope.confirmedAt]);

  const updateDraft = (patch: Partial<ScopeDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateComposition = (index: number, patch: Partial<CompositionDraft>) => setDraft((current) => ({
    ...current,
    chemicalCompositionRequirements: current.chemicalCompositionRequirements.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));

  const save = async () => {
    setSaving(true);
    try {
      const settings = await confirmPcnQc20Scope({
        ...scope,
        status: 'NEEDS_PCN_CONFIRMATION',
        scopeVersion: draft.scopeVersion,
        sourceReferences: splitList(draft.sourceReferences),
        productForms: splitList(draft.productForms),
        grades: splitList(draft.grades),
        hsCodes: splitList(draft.hsCodes),
        appliedStandards: splitList(draft.appliedStandards),
        confirmationNote: draft.confirmationNote,
        chemicalCompositionRequirements: draft.chemicalCompositionRequirements.map((item) => ({
          element: item.element,
          ...(item.minPercent.trim() ? { minPercent: Number(item.minPercent) } : {}),
          ...(item.maxPercent.trim() ? { maxPercent: Number(item.maxPercent) } : {}),
          source: item.source,
        })),
      });
      onConfirmed(settings);
      const nextReadiness = await fetchPcnQc20Readiness().catch(() => null);
      if (nextReadiness) setReadiness(nextReadiness);
      toast.success('Đã xác nhận phạm vi và profile thử QC20.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xác nhận phạm vi QC20.');
    } finally {
      setSaving(false);
    }
  };

  const confirmed = scope.status === 'CONFIRMED';
  return <section className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm md:p-4">
    <div className="flex items-start gap-2">
      <div className="rounded-lg bg-amber-50 p-2 text-amber-700"><ShieldCheck size={16} /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-black text-slate-800">Xác nhận phạm vi QC20</h2><span className={`rounded-full border px-2 py-0.5 text-[8px] font-black ${confirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{confirmed ? 'ĐÃ XÁC NHẬN' : 'CHỜ XÁC NHẬN'}</span></div>
        <p className="mt-0.5 text-[10px] leading-4 text-slate-500">Admin PCN nhập danh mục pháp lý/kỹ thuật đã đối chiếu. Thay đổi tạo phiên mới và không sửa snapshot QC20 trong hồ sơ đã lập.</p>
      </div>
    </div>
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-[10px] text-slate-600">
      <div className="grid gap-2 sm:grid-cols-3"><div><b>Quy chuẩn:</b> QCVN 20:2019/BKHCN + Sửa đổi 1:2021</div><div><b>Phương thức:</b> Phương thức 7</div><div><b>Phiên bản:</b> <input value={draft.scopeVersion} onChange={(event) => updateDraft({ scopeVersion: event.target.value })} placeholder="VD: 2026.09" className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold outline-none focus:border-amber-400" /></div></div>
      <div className="mt-2 grid gap-2 md:grid-cols-2"><label className="font-black text-slate-600">Nguồn đối chiếu *<textarea value={draft.sourceReferences} onChange={(event) => updateDraft({ sourceReferences: event.target.value })} rows={2} placeholder="Mỗi dòng một nguồn" className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-normal outline-none focus:border-amber-400" /></label><label className="font-black text-slate-600">Ghi chú căn cứ xác nhận *<textarea value={draft.confirmationNote} onChange={(event) => updateDraft({ confirmationNote: event.target.value })} rows={2} placeholder="Nêu căn cứ/rà soát của Admin PCN" className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-normal outline-none focus:border-amber-400" /></label></div>
      <div className="mt-2 grid gap-2 md:grid-cols-2"><label className="font-black text-slate-600">Dạng sản phẩm *<textarea value={draft.productForms} onChange={(event) => updateDraft({ productForms: event.target.value })} rows={2} placeholder="Tấm/cuộn..." className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-normal outline-none focus:border-amber-400" /></label><label className="font-black text-slate-600">Mác thép *<textarea value={draft.grades} onChange={(event) => updateDraft({ grades: event.target.value })} rows={2} placeholder="SUS304..." className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-normal outline-none focus:border-amber-400" /></label><label className="font-black text-slate-600">Mã HS *<textarea value={draft.hsCodes} onChange={(event) => updateDraft({ hsCodes: event.target.value })} rows={2} placeholder="Mỗi dòng một mã" className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-normal outline-none focus:border-amber-400" /></label><label className="font-black text-slate-600">Tiêu chuẩn áp dụng *<textarea value={draft.appliedStandards} onChange={(event) => updateDraft({ appliedStandards: event.target.value })} rows={2} placeholder="JIS/ASTM/TCVN..." className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 font-normal outline-none focus:border-amber-400" /></label></div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2"><div className="flex items-center justify-between gap-2"><div><div className="font-black text-slate-700">Profile thành phần hóa học *</div><div className="text-[9px] font-normal text-slate-500">Mỗi chỉ tiêu phải có giới hạn và nguồn đối chiếu; không tự điền ngưỡng pháp lý.</div></div><button type="button" onClick={() => updateDraft({ chemicalCompositionRequirements: [...draft.chemicalCompositionRequirements, emptyComposition()] })} className="inline-flex items-center gap-1 rounded-md border border-amber-200 px-2 py-1 text-[9px] font-black text-amber-700"><Plus size={12} /> Thêm chỉ tiêu</button></div><div className="mt-2 space-y-2">{draft.chemicalCompositionRequirements.map((item, index) => <div key={`qc20-composition-${index}`} className="grid gap-1.5 rounded-md border border-slate-100 bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_1fr_2fr_auto]"><input value={item.element} onChange={(event) => updateComposition(index, { element: event.target.value })} placeholder="Nguyên tố" className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-amber-400" /><input value={item.minPercent} onChange={(event) => updateComposition(index, { minPercent: event.target.value })} placeholder="Min %" inputMode="decimal" className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-amber-400" /><input value={item.maxPercent} onChange={(event) => updateComposition(index, { maxPercent: event.target.value })} placeholder="Max %" inputMode="decimal" className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-amber-400" /><input value={item.source} onChange={(event) => updateComposition(index, { source: event.target.value })} placeholder="Nguồn đối chiếu" className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-amber-400" /><button type="button" onClick={() => updateDraft({ chemicalCompositionRequirements: draft.chemicalCompositionRequirements.filter((_, itemIndex) => itemIndex !== index) })} disabled={draft.chemicalCompositionRequirements.length <= 1} aria-label="Xóa chỉ tiêu thành phần" className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"><Trash2 size={13} /></button></div>)}</div></div>
    </div>
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-wide text-slate-600">Preflight phát hành QC20</div><div className="mt-0.5 text-[9px] text-slate-500">Chỉ là projection read-only; phát hành vẫn thực hiện trong hồ sơ.</div></div>{readinessLoading ? <Loader2 size={14} className="animate-spin text-slate-400" /> : readiness?.ready ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700"><CheckCircle2 size={12} /> Đủ điều kiện kỹ thuật</span> : <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-700"><XCircle size={12} /> Chưa sẵn sàng</span>}</div>
      {!readinessLoading && readiness && <div className="mt-2 grid gap-2 sm:grid-cols-2"><div className="rounded-md border border-slate-200 bg-white p-2 text-[9px] font-bold text-slate-600"><div>Giấy chứng nhận</div><div className={`mt-1 flex items-center gap-1 ${readiness.templates[0]?.ready ? 'text-emerald-700' : 'text-rose-600'}`}>{readiness.templates[0]?.ready ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {readiness.templates[0]?.ready ? 'Template đã duyệt/private' : 'Thiếu template đã duyệt/private'}</div></div><div className="rounded-md border border-slate-200 bg-white p-2 text-[9px] font-bold text-slate-600"><div>Quyết định</div><div className={`mt-1 flex items-center gap-1 ${readiness.templates[1]?.ready ? 'text-emerald-700' : 'text-rose-600'}`}>{readiness.templates[1]?.ready ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {readiness.templates[1]?.ready ? 'Template đã duyệt/private' : 'Thiếu template đã duyệt/private'}</div></div></div>}
      {!readinessLoading && readiness && readiness.reasons.length > 0 && <p className="mt-2 text-[9px] font-bold text-amber-700">Lý do chờ: {readiness.reasons.join(' · ')}</p>}
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[9px] text-slate-400">{confirmed && scope.confirmedByUsername ? `Đã xác nhận bởi ${scope.confirmedByUsername} lúc ${scope.confirmedAt ? new Date(scope.confirmedAt).toLocaleString('vi-VN') : '—'}.` : 'Chỉ xác nhận sau khi đã đối chiếu nguồn và profile thử.'}</p><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-amber-700 disabled:bg-slate-300">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {confirmed ? 'Tạo phiên xác nhận mới' : 'Xác nhận QC20'}</button></div>
  </section>;
}

// --- End of components/PcnQc20ScopePanel.tsx ---
