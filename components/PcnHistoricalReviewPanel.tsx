'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';

import type { CertificationDossier, CertificationProposal, PcnCertificationMethod } from '../types';
import type { PcnHistoricalReviewInput } from '../utils/pcnHistoricalReview';
import { getPcnHistoricalScopeNotice } from '../utils/pcnHistoricalScope';

interface PcnHistoricalReviewPanelProps {
  dossier: CertificationDossier;
  proposal: CertificationProposal;
  onSave: (input: PcnHistoricalReviewInput) => Promise<void>;
}

function buildInitialInput(proposal: CertificationProposal, dossier: CertificationDossier): PcnHistoricalReviewInput {
  const customer = dossier.customerSnapshot || proposal.customerSnapshot || { name: '', address: '' };
  return {
    customerName: customer.name || '',
    customerAddress: customer.address || '',
    customerTaxId: customer.taxId || '',
    customerPhone: customer.phone || '',
    customerEmail: customer.email || '',
    customerContactPerson: customer.contactPerson || '',
    productName: proposal.productName || '',
    model: proposal.model || '',
    brand: proposal.brand || '',
    manufacturer: proposal.manufacturer || '',
    manufacturerAddress: proposal.manufacturerAddress || '',
    method: dossier.method,
  };
}

const inputClass = 'w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-emerald-400';

export function PcnHistoricalReviewPanel({ dossier, proposal, onSave }: PcnHistoricalReviewPanelProps) {
  const [form, setForm] = useState<PcnHistoricalReviewInput>(() => buildInitialInput(proposal, dossier));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(buildInitialInput(proposal, dossier));
    setError('');
  }, [dossier.id, proposal.id]);

  const historicalImport = dossier.historicalImport || proposal.historicalImport;
  if (!historicalImport) return null;
  const scopeNotice = getPcnHistoricalScopeNotice(historicalImport);

  const update = <K extends keyof PcnHistoricalReviewInput>(key: K, value: PcnHistoricalReviewInput[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      await onSave(form);
    } catch (saveError: any) {
      setError(saveError?.message || 'Không thể lưu kết quả rà soát.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-3">
      <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3 text-[10px] text-indigo-900">
        <div className="flex flex-wrap items-center gap-2 font-black">
          {historicalImport.reviewStatus === 'REVIEWED' ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-amber-600" />}
          {historicalImport.reviewStatus === 'REVIEWED' ? 'Đã rà soát dữ liệu nhập lịch sử' : 'Cần rà soát dữ liệu nhập lịch sử'}
          {historicalImport.unresolvedFields.length > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">Còn {historicalImport.unresolvedFields.length} trường cần kiểm tra</span>}
        </div>
        <p className="mt-1 text-slate-600">Nguồn: <b>{historicalImport.sourceFolderName}</b></p>
        <p className="mt-1 break-all text-slate-500">Đường dẫn đối chiếu: {historicalImport.sourceRelativePath}</p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-800"><b>{scopeNotice.label}</b> · {scopeNotice.message}</p>
        {historicalImport.unresolvedFields.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{historicalImport.unresolvedFields.map((field) => <span key={field} className="rounded border border-amber-200 bg-white px-1.5 py-0.5 font-mono text-[9px] text-amber-700">{field}</span>)}</div>}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-[10px] font-bold text-slate-600">Tên khách hàng<input required value={form.customerName} onChange={(event) => update('customerName', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Địa chỉ<input required value={form.customerAddress} onChange={(event) => update('customerAddress', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Mã số thuế<input value={form.customerTaxId || ''} onChange={(event) => update('customerTaxId', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Người liên hệ<input value={form.customerContactPerson || ''} onChange={(event) => update('customerContactPerson', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Điện thoại<input value={form.customerPhone || ''} onChange={(event) => update('customerPhone', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Email<input type="email" value={form.customerEmail || ''} onChange={(event) => update('customerEmail', event.target.value)} className={inputClass} /></label>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-[10px] font-bold text-slate-600">Tên sản phẩm<input required value={form.productName} onChange={(event) => update('productName', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Model<input value={form.model || ''} onChange={(event) => update('model', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Nhãn hiệu<input value={form.brand || ''} onChange={(event) => update('brand', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Nhà sản xuất<input value={form.manufacturer || ''} onChange={(event) => update('manufacturer', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Địa chỉ nhà sản xuất<input value={form.manufacturerAddress || ''} onChange={(event) => update('manufacturerAddress', event.target.value)} className={inputClass} /></label>
        <label className="text-[10px] font-bold text-slate-600">Phương thức chứng nhận<select value={form.method} onChange={(event) => update('method', event.target.value as PcnCertificationMethod)} className={inputClass}><option value="METHOD_1">Phương thức 1</option><option value="METHOD_5">Phương thức 5</option><option value="METHOD_7">Phương thức 7</option></select></label>
      </div>

      {error && <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-[10px] font-bold text-rose-700">{error}</p>}
      <div className="flex justify-end border-t border-slate-100 pt-3"><button type="submit" disabled={isSaving} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-700 disabled:opacity-50"><Save size={13} />{isSaving ? 'Đang lưu...' : 'Lưu kết quả rà soát'}</button></div>
    </form>
  );
}

export default PcnHistoricalReviewPanel;

// --- End of PcnHistoricalReviewPanel.tsx ---
