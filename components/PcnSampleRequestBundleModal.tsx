'use client';

import { AlertTriangle, CheckCircle2, ChevronRight, Plus, RefreshCw, Save, Send, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type {
  CertificationDossier,
  CertificationProposal,
  PcnSampleItem,
  PcnSampleLabCode,
  PcnSampleLot,
  PcnSampleRequestBundle,
  PcnSampleRequestBundleDraft,
  PcnSampleRoute,
} from '../types';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types';
import { buildSampleRequestBundleMappingPreview } from '../utils/pcnSampleRequestBundle';
import type { PcnSampleRequestBundleMappingPreview } from '../utils/pcnSampleRequestBundle';

type CustomerSnapshot = PcnSampleRequestBundleDraft['customerSnapshot'];
type DraftLine = PcnSampleRequestBundleDraft['lines'][number];

type Props = {
  open: boolean;
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  sampleLots: PcnSampleLot[];
  sampleItems: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  onClose: () => void;
  onSave: (draft: PcnSampleRequestBundleDraft) => Promise<PcnSampleRequestBundle>;
  onSend: (bundleId: string) => Promise<PcnSampleRequestBundle>;
  onRetryBundleDispatch: (bundleId: string, dispatchId: string) => Promise<PcnSampleRequestBundle>;
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

function routeIdsForItem(item: PcnSampleItem | undefined, routes: PcnSampleRoute[]): Partial<Record<PcnSampleLabCode, string[]>> {
  if (!item) return {};
  return routes
    .filter((route) => route.sampleLotId === item.sampleLotId && route.sampleItemIds?.includes(item.id))
    .reduce<Partial<Record<PcnSampleLabCode, string[]>>>((result, route) => {
      result[route.labCode] = [...(result[route.labCode] || []), route.id];
      return result;
    }, {});
}

function statusLabel(status: PcnSampleRequestBundle['dispatches'][number]['status']): string {
  if (status === 'ACKNOWLEDGED') return 'Đã nhận';
  if (status === 'ERROR' || status === 'RECONCILE_REQUIRED') return 'Lỗi cần xử lý';
  if (status === 'SENDING') return 'Đang gửi';
  if (status === 'SENT') return 'Đã gửi';
  return 'Chưa gửi';
}

function statusTone(status: PcnSampleRequestBundle['dispatches'][number]['status']): string {
  if (status === 'ACKNOWLEDGED' || status === 'SENT') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'ERROR' || status === 'RECONCILE_REQUIRED') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'SENDING') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function routeTone(status: PcnSampleRequestBundleMappingPreview['dispatches'][number]['rows'][number]['routeStatus']): string {
  if (status === 'Đã gán tuyến') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Thiếu tuyến') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function PcnSampleRequestBundleModal({
  open,
  dossiers,
  proposals,
  sampleLots,
  sampleItems,
  sampleRoutes,
  onClose,
  onSave,
  onSend,
  onRetryBundleDispatch,
}: Props) {
  const [parentPycNumber, setParentPycNumber] = useState('PYC-TONG-');
  const [customerSnapshot, setCustomerSnapshot] = useState<CustomerSnapshot>(blankCustomer);
  const [targetDate, setTargetDate] = useState('');
  const [criteria, setCriteria] = useState('');
  const [sourceKey, setSourceKey] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedBundle, setCompletedBundle] = useState<PcnSampleRequestBundle>();

  useEffect(() => {
    if (!open) return;
    setParentPycNumber(`PYC-TONG-${new Date().getFullYear()}-`);
    setCustomerSnapshot(blankCustomer);
    setTargetDate('');
    setCriteria('');
    setSourceKey('');
    setLines([]);
    setError('');
    setCompletedBundle(undefined);
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
  const previewDraft = useMemo<PcnSampleRequestBundleDraft>(() => ({
    id: 'preview-bundle',
    parentPycNumber: parentPycNumber.trim(),
    customerSnapshot,
    sourceRefs: [],
    fieldCodes: Array.from(new Set(lines.flatMap((line) => dossiers.find((dossier) => dossier.id === line.dossierId)?.fieldCodes || []))),
    lines,
    ...(targetDate.trim() ? { targetDate: targetDate.trim() } : {}),
    ...(criteria.trim() ? { criteria: criteria.trim() } : {}),
  }), [criteria, customerSnapshot, dossiers, lines, parentPycNumber, targetDate]);
  const mappingPreview = useMemo(() => buildSampleRequestBundleMappingPreview(previewDraft, sampleRoutes), [previewDraft, sampleRoutes]);

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
    const routeIdsByLab = routeIdsForItem(item, sampleRoutes);
    const assignedLabCodes = Object.keys(routeIdsByLab) as PcnSampleLabCode[];
    const labCodes = assignedLabCodes.length ? assignedLabCodes : defaultLabCodes(item);
    setLines((current) => [...current, {
      sampleItemId: item?.id,
      sampleLotId: lot?.id,
      dossierId: source.dossier.id,
      dossierCode: source.dossier.dossierCode,
      proposalCode: proposal?.proposalCode || source.dossier.proposalId,
      fieldCode: source.fieldCodes?.[0],
      lotCode: lot?.lotCode || `${proposal?.proposalCode || 'LO'}-LOT-01`,
      sampleCode: item?.sampleCode || `${proposal?.proposalCode || 'M'}-M01`,
      sampleType: item?.sampleType || proposal?.productName || '',
      model: item?.model || proposal?.model || '',
      ...(item?.brand || proposal?.brand ? { brand: item?.brand || proposal?.brand } : {}),
      quantity: item?.quantity || proposal?.quantity || 1,
      ...(item?.unit ? { unit: item.unit } : {}),
      labCodes,
      ...(assignedLabCodes.length ? { routeIdsByLab } : {}),
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
      dossierCode: dossier.dossierCode,
      proposalCode: dossier.proposalId,
      fieldCode: dossier.fieldCodes?.[0],
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
    if (lineIndex !== index || line.sampleItemId) return line;
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
    ...(targetDate.trim() ? { targetDate: targetDate.trim() } : {}),
    ...(criteria.trim() ? { criteria: criteria.trim() } : {}),
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
    if (send && mappingPreview.issues.length > 0) {
      setError('Chưa thể gửi PYC: hãy xử lý hết cảnh báo trong mục Kiểm tra mapping.');
      return;
    }
    setIsSubmitting(true);
    try {
      const saved = await onSave(toDraft());
      if (send) {
        const sent = await onSend(saved.id);
        setCompletedBundle(sent);
      } else {
        onClose();
      }
    } catch (submitError: any) {
      setError(submitError?.message || 'Không thể lưu PYC tổng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryDispatch = async (dispatchId: string) => {
    if (!completedBundle) return;
    setError('');
    setIsSubmitting(true);
    try {
      setCompletedBundle(await onRetryBundleDispatch(completedBundle.id, dispatchId));
    } catch (retryError: any) {
      setError(retryError?.message || 'Không thể gửi lại PYC con.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3" role="dialog" aria-modal="true" aria-labelledby="pyc-modal-title">
    <div className="flex max-h-[94dvh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Sổ quản lý mẫu · PYC tổng / PYC con</p>
          <h2 id="pyc-modal-title" className="text-base font-black text-slate-900">Tạo Phiếu yêu cầu thử nghiệm</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">Gom mẫu cùng khách hàng, kiểm tra mapping rồi gửi server-to-server tới phòng thử nghiệm.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="Đóng modal"><X size={17} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Tiến trình tạo PYC">
          {[['1', 'Nguồn mẫu'], ['2', 'Thông tin & tuyến gửi'], ['3', 'Kiểm tra mapping']].map(([step, label], index) => <div key={step} className={`flex items-center justify-center gap-1 rounded-md px-2 py-2 text-[10px] font-black ${index === 2 ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[9px]">{step}</span>{label}{index < 2 && <ChevronRight size={12} className="ml-auto text-slate-300" />}</div>)}
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[1fr_1fr_1.2fr]">
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Số PYC tổng</span><input value={parentPycNumber} onChange={(event) => setParentPycNumber(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Khách hàng · Cùng khách hàng</span><input value={customerSnapshot.name} onChange={(event) => setCustomerSnapshot((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" placeholder="Chọn nguồn để tự điền" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Địa chỉ khách hàng</span><input value={customerSnapshot.address} onChange={(event) => setCustomerSnapshot((current) => ({ ...current, address: event.target.value }))} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Hạn trả KQTN</span><input type="date" aria-label="Hạn trả KQTN" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label>
          <label className="block md:col-span-2"><span className="mb-1 block text-[10px] font-black text-slate-500">Chỉ tiêu/tiêu chuẩn</span><input aria-label="Chỉ tiêu/tiêu chuẩn" value={criteria} onChange={(event) => setCriteria(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" placeholder="Ví dụ: QCVN / IEC / tiêu chuẩn nội bộ" /></label>
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 md:flex-row md:items-end">
          <label className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-black text-indigo-800">Gọi mẫu từ Đề nghị / biên bản</span><select value={sourceKey} onChange={(event) => setSourceKey(event.target.value)} className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-100"><option value="">Chọn mẫu nguồn...</option>{sourceOptions.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}</select></label>
          <button type="button" onClick={addSource} className="inline-flex items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-[10px] font-black text-white outline-none hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-300"><Plus size={13} /> Thêm vào danh sách</button>
          <button type="button" onClick={addBlankLine} className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-200 bg-white px-3 py-2 text-[10px] font-black text-indigo-700 outline-none hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-300"><Plus size={13} /> Tạo lô mới</button>
        </div>

        {error && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] font-bold text-rose-800">{error}</div>}

        <div data-testid="sample-request-bundle-lines" className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1120px] w-full border-collapse text-left text-[10px]">
            <thead className="bg-slate-100 text-[9px] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-2 py-2">#</th><th className="px-2 py-2">Mã lô / Mã mẫu</th><th className="px-2 py-2">Loại mẫu / Model</th><th className="px-2 py-2">SL</th><th className="px-2 py-2">Tuyến / ứng dụng đích</th><th className="px-2 py-2">Hồ sơ</th><th className="px-2 py-2" /></tr></thead>
            <tbody>
              {lines.map((line, index) => {
                const itemRoutes = line.sampleItemId ? sampleRoutes.filter((route) => route.sampleLotId === line.sampleLotId && route.sampleItemIds?.includes(line.sampleItemId as string)) : [];
                return <tr key={`${line.sampleItemId || 'new'}-${index}`} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2 font-black text-slate-400">{index + 1}</td>
                  <td className="space-y-1 px-2 py-2"><input aria-label={`Mã lô mẫu ${index + 1}`} value={line.lotCode} onChange={(event) => updateLine(index, { lotCode: event.target.value })} className="w-40 rounded border border-slate-200 px-2 py-1.5 font-mono text-[10px] outline-none focus:border-emerald-400" /><input aria-label={`Mã mẫu ${index + 1}`} value={line.sampleCode} onChange={(event) => updateLine(index, { sampleCode: event.target.value })} className="w-40 rounded border border-slate-200 px-2 py-1.5 font-mono text-[10px] outline-none focus:border-emerald-400" /></td>
                  <td className="space-y-1 px-2 py-2"><input aria-label={`Loại mẫu ${index + 1}`} value={line.sampleType} onChange={(event) => updateLine(index, { sampleType: event.target.value })} className="w-44 rounded border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-emerald-400" /><input aria-label={`Model ${index + 1}`} value={line.model} onChange={(event) => updateLine(index, { model: event.target.value })} className="w-44 rounded border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-emerald-400" /></td>
                  <td className="px-2 py-2"><input type="number" min={1} aria-label={`Số lượng ${index + 1}`} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="w-16 rounded border border-slate-200 px-2 py-1.5 text-[10px] outline-none focus:border-emerald-400" /></td>
                  <td className="px-2 py-2">
                    {line.sampleItemId ? <div className="space-y-1.5">{itemRoutes.length ? itemRoutes.map((route) => <div key={route.id} className="flex items-center justify-between gap-2 rounded border border-emerald-100 bg-emerald-50 px-2 py-1.5"><span className="font-bold text-emerald-800">{route.labName}</span><span className="font-mono text-[9px] text-emerald-700">{route.id}</span></div>) : <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 font-bold text-rose-700">Chưa có tuyến được gán</div>}</div> : <div className="grid grid-cols-2 gap-1.5">{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <label key={lab.code} className="flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1.5 text-[9px] font-bold text-slate-700"><input type="checkbox" checked={line.labCodes.includes(lab.code)} onChange={() => toggleLab(index, lab.code)} />{lab.name.replace('Phòng thử nghiệm ', 'PTN ')}</label>)}</div>}
                    <p className="mt-1 text-[9px] text-slate-500">PERFORMANCE → LABFTEE · EMC/An toàn điện → DDT</p>
                  </td>
                  <td className="px-2 py-2"><span className="rounded bg-slate-100 px-1.5 py-1 font-mono text-[9px] text-slate-600">{line.dossierCode || line.dossierId}</span><p className="mt-1 max-w-32 text-[9px] text-slate-500">{line.customerSnapshot?.name}</p></td>
                  <td className="px-2 py-2"><button type="button" aria-label={`Xóa mẫu ${index + 1}`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="rounded p-1.5 text-slate-400 outline-none hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-300"><X size={13} /></button></td>
                </tr>;
              })}
              {lines.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[10px] text-slate-400">Chưa có mẫu. Gọi từ nguồn hoặc tạo lô mới.</td></tr>}
            </tbody>
          </table>
        </div>

        <section data-testid="pyc-mapping-preview" className="mt-3 rounded-xl border border-slate-200 bg-white" aria-labelledby="pyc-mapping-title">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <div><h3 id="pyc-mapping-title" className="text-[11px] font-black text-slate-900">Kiểm tra mapping</h3><p className="mt-0.5 text-[9px] text-slate-500">Đối chiếu trường PCN trước khi tạo PYC con · mappingVersion: <span className="font-mono">pcn-lab-map-v1</span></p></div>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[9px] font-black text-indigo-700">{mappingPreview.dispatches.length} ứng dụng đích</span>
          </div>
          <div className="divide-y divide-slate-100">
            {mappingPreview.dispatches.map((dispatch) => <div key={dispatch.labCode} className="p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[10px] font-black text-slate-800">{dispatch.labName}</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-700">{dispatch.targetSystemCode || 'Chưa cấu hình app đích'}</span><span className="text-[9px] text-slate-500">{dispatch.rows.length} dòng dữ liệu</span></div>
              <div className="grid gap-2 lg:grid-cols-2">{dispatch.rows.map((row) => <div key={`${row.lineIndex}-${row.labCode}`} className="rounded-lg border border-slate-200 p-2.5"><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[10px] font-black text-slate-800">{row.sampleCode}</p><p className="text-[9px] text-slate-500">{row.model || 'Chưa có model'}</p></div><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${routeTone(row.routeStatus)}`}>{row.routeStatus}</span></div><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">{row.values.map((field) => <div key={field.key} className="min-w-0"><dt className="text-[8px] font-black uppercase tracking-wide text-slate-400">{field.label}</dt><dd className="truncate text-[9px] font-bold text-slate-700" title={field.value}>{field.value}</dd></div>)}</dl></div>)}</div>
            </div>)}
            {mappingPreview.dispatches.length === 0 && <p className="px-3 py-5 text-center text-[10px] text-slate-400">Thêm mẫu để xem mapping sang từng phòng thử nghiệm.</p>}
          </div>
          {mappingPreview.issues.length > 0 && <div role="alert" className="border-t border-rose-200 bg-rose-50 px-3 py-2"><p className="flex items-center gap-1 text-[10px] font-black text-rose-800"><AlertTriangle size={13} /> Cần xử lý trước khi gửi</p><ul className="mt-1 space-y-0.5 text-[9px] font-bold text-rose-700">{mappingPreview.issues.map((issue) => <li key={`${issue.path}-${issue.code}`}>• {issue.message}</li>)}</ul></div>}
        </section>

        {completedBundle && <section className="mt-3 rounded-xl border border-slate-200 bg-white" aria-labelledby="pyc-send-result-title">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5"><h3 id="pyc-send-result-title" className="text-[11px] font-black text-slate-900">Kết quả gửi PYC</h3><p className="mt-0.5 text-[9px] text-slate-500">Kết quả phản hồi được giữ lại trong modal để đối soát theo từng ứng dụng đích.</p></div>
          <div className="grid gap-2 p-3 lg:grid-cols-2">{completedBundle.dispatches.map((dispatch) => <div key={dispatch.id} className={`rounded-lg border p-2.5 ${statusTone(dispatch.status)}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black">{dispatch.targetSystemCode || dispatch.labCode}</span><span className="inline-flex items-center gap-1 text-[9px] font-black">{dispatch.status === 'ACKNOWLEDGED' ? <CheckCircle2 size={12} /> : dispatch.status === 'ERROR' || dispatch.status === 'RECONCILE_REQUIRED' ? <XCircle size={12} /> : null}{statusLabel(dispatch.status)}</span></div>{dispatch.externalRequestCodes?.length ? <p className="mt-1 text-[9px] font-bold">Mã PYC PTN: <span className="font-mono">{dispatch.externalRequestCodes.join(', ')}</span></p> : null}{dispatch.lastErrorMessage ? <p className="mt-1 text-[9px] font-bold">{dispatch.lastErrorMessage}</p> : null}{dispatch.status === 'ERROR' || dispatch.status === 'RECONCILE_REQUIRED' ? <button type="button" disabled={isSubmitting} onClick={() => void retryDispatch(dispatch.id)} className="mt-2 inline-flex items-center gap-1 rounded-md border border-current bg-white px-2 py-1 text-[9px] font-black disabled:opacity-50"><RefreshCw size={11} /> Gửi lại PYC con</button> : null}</div>)}</div>
        </section>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-bold text-slate-500">{lines.length} mẫu · {Array.from(new Set(lines.flatMap((line) => line.labCodes))).length} tuyến/app · Lưu không gọi trực tiếp sang PTN.</p>
        <div className="flex w-full gap-2 sm:w-auto"><button type="button" onClick={onClose} className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 sm:flex-none">{completedBundle ? 'Đóng' : 'Hủy'}</button>{!completedBundle && <><button type="button" disabled={isSubmitting} onClick={() => void submit(false)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-emerald-200 bg-white px-3 py-2 text-[10px] font-black text-emerald-700 outline-none hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50 sm:flex-none"><Save size={13} /> Lưu nháp</button><button type="button" disabled={isSubmitting} onClick={() => void submit(true)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm outline-none hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50 sm:flex-none"><Send size={13} /> Gửi PYC</button></>}</div>
      </div>
    </div>
  </div>;
}
