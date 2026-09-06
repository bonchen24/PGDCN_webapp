'use client';

import { Plus, Save, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type {
  CertificationDossier,
  CertificationProposal,
  PcnSampleItem,
  PcnSampleLabCode,
  PcnSampleLot,
  PcnSampleRequestBundle,
  PcnSampleRequestBundleDraft,
} from '../types';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types';

type CustomerSnapshot = PcnSampleRequestBundleDraft['customerSnapshot'];
type DraftLine = PcnSampleRequestBundleDraft['lines'][number];

type Props = {
  open: boolean;
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  sampleLots: PcnSampleLot[];
  sampleItems: PcnSampleItem[];
  onClose: () => void;
  onSave: (draft: PcnSampleRequestBundleDraft) => Promise<PcnSampleRequestBundle>;
  onSend: (bundleId: string) => Promise<PcnSampleRequestBundle>;
};

const blankCustomer: CustomerSnapshot = { name: '', address: '' };

function makeId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function customerKey(customer: CustomerSnapshot | undefined): string {
  if (!customer) return '';
  return [customer.name, customer.address, customer.taxId, customer.phone, customer.email]
    .map((value) => String(value || '').trim().toLocaleLowerCase('vi-VN'))
    .join('|');
}

function snapshotOf(value: CustomerSnapshot | undefined): CustomerSnapshot {
  return {
    name: String(value?.name || '').trim(),
    address: String(value?.address || '').trim(),
    ...(value?.taxId ? { taxId: value.taxId } : {}),
    ...(value?.phone ? { phone: value.phone } : {}),
    ...(value?.email ? { email: value.email } : {}),
    ...(value?.contactPerson ? { contactPerson: value.contactPerson } : {}),
  };
}

function defaultLabCodes(item?: PcnSampleItem): PcnSampleLabCode[] {
  const codes = item?.testLabCodes?.length ? item.testLabCodes : ['PERFORMANCE' as PcnSampleLabCode];
  return Array.from(new Set(codes));
}

export default function PcnSampleRequestBundleModal({ open, dossiers, proposals, sampleLots, sampleItems, onClose, onSave, onSend }: Props) {
  const [parentPycNumber, setParentPycNumber] = useState('PYC-TONG-');
  const [customerSnapshot, setCustomerSnapshot] = useState<CustomerSnapshot>(blankCustomer);
  const [sourceKey, setSourceKey] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setParentPycNumber(`PYC-TONG-${new Date().getFullYear()}-`);
    setCustomerSnapshot(blankCustomer);
    setSourceKey('');
    setLines([]);
    setError('');
  }, [open]);

  const sourceOptions = useMemo(() => {
    const itemOptions = sampleItems.flatMap((item) => {
      const lot = sampleLots.find((candidate) => candidate.id === item.sampleLotId);
      const dossier = dossiers.find((candidate) => candidate.id === lot?.dossierId);
      if (!lot || !dossier) return [];
      return [{
        key: `sample:${item.id}`,
        label: `Biên bản / mẫu ${item.sampleCode} · Lô ${lot.lotCode} · ${dossier.customerSnapshot?.name || 'Chưa có khách hàng'}`,
        dossier,
        item,
        lot,
        customer: snapshotOf(dossier.customerSnapshot),
        fieldCodes: dossier.fieldCodes,
      }];
    });
    const proposalOptions = proposals.flatMap((proposal) => {
      const dossier = dossiers.find((candidate) => candidate.id === proposal.dossierId || candidate.proposalId === proposal.id);
      if (!dossier) return [];
      return [{
        key: `proposal:${proposal.id}`,
        label: `Đề nghị ${proposal.proposalCode} · ${proposal.customerSnapshot.name}`,
        dossier,
        proposal,
        customer: snapshotOf(proposal.customerSnapshot),
        fieldCodes: proposal.fieldCodes,
      }];
    });
    const lockedKey = customerKey(customerSnapshot);
    return [...proposalOptions, ...itemOptions].filter((option) => !lockedKey || customerKey(option.customer) === lockedKey);
  }, [customerSnapshot, dossiers, proposals, sampleItems, sampleLots]);

  const selectedDossierIds = useMemo(() => Array.from(new Set(lines.map((line) => line.dossierId).filter(Boolean))), [lines]);

  if (!open) return null;

  const addSource = () => {
    const source = sourceOptions.find((option) => option.key === sourceKey);
    if (!source) {
      setError('Chọn Đề nghị hoặc mẫu nguồn trước khi thêm.');
      return;
    }
    const nextCustomer = snapshotOf(source.customer);
    if (customerSnapshot.name && customerKey(nextCustomer) !== customerKey(customerSnapshot)) {
      setError('Chỉ được thêm mẫu của cùng một khách hàng vào PYC tổng.');
      return;
    }
    setCustomerSnapshot(nextCustomer);
    const item = 'item' in source ? source.item : undefined;
    const lot = 'lot' in source ? source.lot : undefined;
    const proposal = 'proposal' in source ? source.proposal : undefined;
    const duplicate = item ? lines.some((line) => line.sampleItemId === item.id) : false;
    if (duplicate) {
      setError('Mẫu này đã có trong danh sách PYC tổng.');
      return;
    }
    const labCodes = defaultLabCodes(item);
    setLines((current) => [...current, {
      sampleItemId: item?.id,
      sampleLotId: lot?.id,
      dossierId: source.dossier.id,
      lotCode: lot?.lotCode || `${proposal?.proposalCode || 'LO'}-LOT-01`,
      sampleCode: item?.sampleCode || `${proposal?.proposalCode || 'M'}-M01`,
      sampleType: item?.sampleType || proposal?.productName || '',
      model: item?.model || proposal?.model || '',
      ...(item?.brand || proposal?.brand ? { brand: item?.brand || proposal?.brand } : {}),
      quantity: item?.quantity || proposal?.quantity || 1,
      ...(item?.unit ? { unit: item.unit } : {}),
      labCodes,
      customerSnapshot: nextCustomer,
      notes: item?.notes,
    }]);
    setSourceKey('');
    setError('');
  };

  const addBlankLine = () => {
    const dossier = dossiers.find((candidate) => candidate.id === selectedDossierIds[0]) || dossiers[0];
    if (!dossier) {
      setError('Chưa có hồ sơ PCN để tạo lô mới.');
      return;
    }
    if (!customerSnapshot.name) {
      setError('Chọn nguồn để khóa khách hàng trước khi tạo mẫu mới.');
      return;
    }
    setLines((current) => [...current, {
      dossierId: dossier.id,
      lotCode: `${parentPycNumber || 'LO'}-LOT-${current.length + 1}`,
      sampleCode: `${parentPycNumber || 'M'}-M${String(current.length + 1).padStart(2, '0')}`,
      sampleType: '',
      model: '',
      quantity: 1,
      labCodes: ['PERFORMANCE'],
      customerSnapshot,
    }]);
  };

  const updateLine = (index: number, patch: Partial<DraftLine>) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  const toggleLab = (index: number, labCode: PcnSampleLabCode) => setLines((current) => current.map((line, lineIndex) => {
    if (lineIndex !== index) return line;
    const labCodes = line.labCodes.includes(labCode) ? line.labCodes.filter((code) => code !== labCode) : [...line.labCodes, labCode];
    return { ...line, labCodes };
  }));

  const toDraft = (): PcnSampleRequestBundleDraft => ({
    id: makeId('sample-bundle'),
    parentPycNumber: parentPycNumber.trim(),
    customerSnapshot,
    sourceRefs: lines.map((line) => ({ kind: line.sampleItemId ? 'HANDOVER' : 'PROPOSAL', id: line.sampleItemId || line.dossierId, label: line.sampleCode })),
    fieldCodes: Array.from(new Set(lines.flatMap((line) => dossiers.find((dossier) => dossier.id === line.dossierId)?.fieldCodes || []))),
    lines,
  });

  const submit = async (send: boolean) => {
    setError('');
    if (!parentPycNumber.trim() || !customerSnapshot.name || !customerSnapshot.address || lines.length === 0) {
      setError('Nhập số PYC, khách hàng, địa chỉ và ít nhất một mẫu.');
      return;
    }
    if (lines.some((line) => !line.lotCode.trim() || !line.sampleCode.trim() || !line.sampleType.trim() || !line.model.trim() || line.labCodes.length === 0)) {
      setError('Mỗi mẫu phải có mã lô, mã mẫu, loại mẫu, model và ít nhất một PTN.');
      return;
    }
    setIsSubmitting(true);
    try {
      const saved = await onSave(toDraft());
      if (send) await onSend(saved.id);
      onClose();
    } catch (submitError: any) {
      setError(submitError?.message || 'Không thể lưu PYC tổng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" aria-label="Tạo Phiếu yêu cầu thử nghiệm">
    <div className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Sổ quản lý mẫu</p>
          <h2 className="text-base font-black text-slate-900">Tạo Phiếu yêu cầu thử nghiệm</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">Tạo một PYC tổng, sau đó fan-out thành các PYC con theo từng PTN.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng modal"><X size={17} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[1fr_1fr_1.2fr]">
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Số PYC tổng</span><input value={parentPycNumber} onChange={(event) => setParentPycNumber(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono outline-none focus:border-emerald-400" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Khách hàng · Cùng khách hàng</span><input value={customerSnapshot.name} onChange={(event) => setCustomerSnapshot((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400" placeholder="Chọn nguồn để tự điền" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Địa chỉ khách hàng</span><input value={customerSnapshot.address} onChange={(event) => setCustomerSnapshot((current) => ({ ...current, address: event.target.value }))} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400" /></label>
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 md:flex-row md:items-end">
          <label className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-black text-indigo-800">Gọi mẫu từ Đề nghị / biên bản</span><select value={sourceKey} onChange={(event) => setSourceKey(event.target.value)} className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-2 text-xs outline-none"><option value="">Chọn mẫu nguồn...</option>{sourceOptions.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}</select></label>
          <button type="button" onClick={addSource} className="inline-flex items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-500"><Plus size={13} /> Thêm vào danh sách</button>
          <button type="button" onClick={addBlankLine} className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-white px-3 py-2 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><Plus size={13} /> Tạo lô mới</button>
        </div>

        {error && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-800">{error}</div>}

        <div data-testid="sample-request-bundle-lines" className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1040px] w-full border-collapse text-left text-[10px]">
            <thead className="bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2">#</th><th className="px-2 py-2">Mã lô / Mã mẫu</th><th className="px-2 py-2">Loại mẫu / Model</th><th className="px-2 py-2">SL</th><th className="px-2 py-2">PTN được chọn</th><th className="px-2 py-2">Hồ sơ</th><th className="px-2 py-2" /></tr></thead>
            <tbody>
              {lines.map((line, index) => <tr key={`${line.sampleItemId || 'new'}-${index}`} className="border-t border-slate-100 align-top">
                <td className="px-2 py-2 font-black text-slate-400">{index + 1}</td>
                <td className="space-y-1 px-2 py-2"><input aria-label={`Mã lô mẫu ${index + 1}`} value={line.lotCode} onChange={(event) => updateLine(index, { lotCode: event.target.value })} className="w-40 rounded border border-slate-200 px-2 py-1.5 font-mono text-[10px] outline-none focus:border-emerald-400" /><input aria-label={`Mã mẫu ${index + 1}`} value={line.sampleCode} onChange={(event) => updateLine(index, { sampleCode: event.target.value })} className="w-40 rounded border border-slate-200 px-2 py-1.5 font-mono text-[10px] outline-none focus:border-emerald-400" /></td>
                <td className="space-y-1 px-2 py-2"><input aria-label={`Loại mẫu ${index + 1}`} value={line.sampleType} onChange={(event) => updateLine(index, { sampleType: event.target.value })} className="w-44 rounded border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-emerald-400" /><input aria-label={`Model ${index + 1}`} value={line.model} onChange={(event) => updateLine(index, { model: event.target.value })} className="w-44 rounded border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-emerald-400" /></td>
                <td className="px-2 py-2"><input type="number" min={1} aria-label={`Số lượng ${index + 1}`} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="w-16 rounded border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-emerald-400" /></td>
                <td className="px-2 py-2"><div className="grid grid-cols-2 gap-1.5">{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <label key={lab.code} className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1.5 text-[9px] font-bold text-slate-700"><input type="checkbox" checked={line.labCodes.includes(lab.code)} onChange={() => toggleLab(index, lab.code)} />{lab.name.replace('Phòng thử nghiệm ', 'PTN ')}</label>)}</div></td>
                <td className="px-2 py-2"><span className="rounded bg-slate-100 px-1.5 py-1 font-mono text-[9px] text-slate-600">{line.dossierId}</span><p className="mt-1 max-w-32 text-[9px] text-slate-500">{line.customerSnapshot?.name}</p></td>
                <td className="px-2 py-2"><button type="button" aria-label={`Xóa mẫu ${index + 1}`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X size={13} /></button></td>
              </tr>)}
              {lines.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[10px] text-slate-400">Chưa có mẫu. Gọi từ nguồn hoặc tạo lô mới.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-bold text-slate-500">{lines.length} mẫu · {Array.from(new Set(lines.flatMap((line) => line.labCodes))).length} PTN được chọn · Lưu không gửi dữ liệu sang PTN.</p>
        <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-100">Hủy</button><button type="button" disabled={isSubmitting} onClick={() => void submit(false)} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black text-emerald-700 disabled:opacity-50"><Save size={13} /> Lưu</button><button type="button" disabled={isSubmitting} onClick={() => void submit(true)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"><Send size={13} /> Gửi</button></div>
      </div>
    </div>
  </div>;
}
