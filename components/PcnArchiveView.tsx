'use client';

import React, { useMemo, useState } from 'react';
import { Archive, FileText, Search, ShieldAlert } from 'lucide-react';

import type { CertificationDossier, CertificationProposal, IssuancePackage, PcnCertificationField } from '../types';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { getPcnRetentionState } from '../utils/pcnRetention';
import { filterPcnArchive } from '../utils/pcnReporting';

function formatDate(value?: string): string {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định' : date.toLocaleDateString('vi-VN');
}

function retentionLabel(dossier: CertificationDossier): string {
  if (!dossier.retention) return 'Chưa có metadata';
  try {
    switch (getPcnRetentionState(dossier.retention)) {
      case 'LEGAL_HOLD': return 'Giữ pháp lý';
      case 'DIGITAL_REVIEW_DUE': return 'Đến hạn rà soát bản mềm';
      case 'PAPER_REVIEW_DUE': return 'Đến hạn rà soát bản cứng';
      default: return 'Đang bảo quản';
    }
  } catch {
    return 'Metadata cần rà soát';
  }
}

export function PcnArchiveView({ fields, dossiers, proposals, issuancePackages, initialDossierId, canEdit, onOpenDossier, onSetLegalHold }: {
  fields: PcnCertificationField[];
  dossiers: CertificationDossier[];
  initialDossierId?: string;
  proposals: CertificationProposal[];
  issuancePackages: IssuancePackage[];
  canEdit: boolean;
  onOpenDossier: (dossier: CertificationDossier) => void;
  onSetLegalHold: (dossierId: string, input: { legalHold: boolean; reason?: string }) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [fieldCode, setFieldCode] = useState('');
  const [year, setYear] = useState('');
  const [holdDraftId, setHoldDraftId] = useState<string>();
  const [holdReason, setHoldReason] = useState('');
  const [savingId, setSavingId] = useState<string>();
  const years = useMemo(() => Array.from(new Set(dossiers.flatMap((dossier) => [
    dossier.updatedAt,
    dossier.createdAt,
    dossier.retention?.retentionStartAt,
  ].filter(Boolean).map((value) => String(value).slice(0, 4))))).sort().reverse(), [dossiers]);
  const visible = filterPcnArchive({ dossiers, proposals, issuancePackages, query, fieldCode: fieldCode || undefined, year: year || undefined }).filter((dossier) => !initialDossierId || dossier.id === initialDossierId);

  const submitHold = async (dossier: CertificationDossier, legalHold: boolean) => {
    if (savingId === dossier.id) return;
    if (!canEdit) return;
    if (legalHold && !holdReason.trim()) return;
    setSavingId(dossier.id);
    try {
      await onSetLegalHold(dossier.id, legalHold ? { legalHold: true, reason: holdReason.trim() } : { legalHold: false });
      setHoldDraftId(undefined);
      setHoldReason('');
    } finally {
      setSavingId(undefined);
    }
  };

  return <div className="h-full overflow-y-auto bg-slate-50/60 p-3 pb-20 md:p-5">
    <div>
      <h1 className="text-xl font-black text-slate-900">Kho hồ sơ</h1>
      <p className="mt-1 text-[11px] text-slate-500">Tra cứu hồ sơ đã lưu theo mã, khách hàng, Lĩnh vực, số phát hành và năm.</p>
      {initialDossierId && <p className="mt-2 text-[10px] font-black text-emerald-700">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</p>}
    </div>
    <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_180px_120px]">
      <label className="relative block"><Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm hồ sơ, khách hàng, số phát hành..." className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2.5 text-[11px] outline-none focus:border-emerald-400" /></label>
      <select value={fieldCode} onChange={(event) => setFieldCode(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="">Tất cả Lĩnh vực</option>{fields.map((field) => <option key={field.code} value={field.code}>{field.name}</option>)}</select>
      <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="">Tất cả năm</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    </div>
    <div className="mt-4 space-y-2">
      {visible.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center"><Archive size={18} className="mx-auto text-slate-400" /><p className="mt-2 text-xs font-black text-slate-600">Không tìm thấy hồ sơ lưu trữ</p></div> : visible.map((dossier) => {
        const proposal = proposals.find((item) => item.id === dossier.proposalId);
        const customerSnapshot = getPcnDossierCustomerSnapshot(dossier, proposal);
        const issuance = issuancePackages.find((item) => item.dossierId === dossier.id);
        const isHeld = dossier.retention?.legalHold === true;
        const retentionState = retentionLabel(dossier);
        return <div key={dossier.id} className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <button onClick={() => onOpenDossier(dossier)} className="min-w-0 flex-1 text-left hover:text-emerald-700">
              <div className="flex flex-wrap items-center gap-2"><FileText size={14} className="text-indigo-600" /><span className="font-mono text-xs font-black text-slate-800">{dossier.dossierCode}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">Đã lưu trữ</span></div>
              <p className="mt-1 text-[11px] font-bold text-slate-700">{customerSnapshot?.name || 'Chưa gắn khách hàng'} <span className="font-normal text-slate-400">• {proposal?.productName || 'Hồ sơ chứng nhận'}</span></p>
              <p className="mt-1 text-[10px] text-slate-500">Lĩnh vực: {dossier.fieldCodes.join(', ')} • Phương thức {dossier.method.replace('METHOD_', '')}</p>
            </button>
            <div className="shrink-0 text-right text-[10px] text-slate-400">Số phát hành<br /><span className="font-bold text-slate-700">{issuance?.issuanceNumber || 'Chưa cấp'}</span></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-[10px]">
            <span className={`rounded-full border px-2 py-0.5 font-bold ${isHeld ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><ShieldAlert size={11} className="mr-1 inline-block" />{retentionState}</span>
            {dossier.retention ? <><span className="text-slate-500">Bản cứng đến {formatDate(dossier.retention.paperRetentionUntil)}</span><span className="text-slate-500">Bản mềm đến {formatDate(dossier.retention.digitalRetentionUntil)}</span></> : <span className="text-amber-600">Chưa ghi mốc bảo quản</span>}
            <span className="text-slate-400">Mốc tham chiếu, không tự xóa</span>
            {canEdit && (isHeld ? <button disabled={savingId === dossier.id} onClick={() => void submitHold(dossier, false)} className="ml-auto rounded-md border border-amber-200 bg-amber-50 px-2 py-1 font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50">Gỡ giữ pháp lý</button> : <button disabled={savingId === dossier.id} onClick={() => { setHoldDraftId(dossier.id); setHoldReason(''); }} className="ml-auto rounded-md border border-slate-200 bg-white px-2 py-1 font-bold text-slate-600 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50">Đặt giữ pháp lý</button>)}
          </div>
          {canEdit && holdDraftId === dossier.id && <div className="mt-2 flex flex-col gap-2 rounded-lg border border-rose-100 bg-rose-50/50 p-2 sm:flex-row sm:items-center"><input autoFocus value={holdReason} onChange={(event) => setHoldReason(event.target.value)} placeholder="Lý do giữ pháp lý bắt buộc..." className="min-w-0 flex-1 rounded-md border border-rose-200 bg-white px-2 py-1.5 text-[10px] outline-none focus:border-rose-400" /><button disabled={!holdReason.trim() || savingId === dossier.id} onClick={() => void submitHold(dossier, true)} className="rounded-md bg-rose-600 px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">Lưu giữ</button><button onClick={() => setHoldDraftId(undefined)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600">Hủy</button></div>}
        </div>;
      })}
    </div>
  </div>;
}

export default PcnArchiveView;
