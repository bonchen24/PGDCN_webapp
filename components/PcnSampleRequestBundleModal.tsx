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
import type { PcnSampleRequestBundleMappingPreview, PcnSampleRequestBundleValidationIssue } from '../utils/pcnSampleRequestBundle';
import { PgdcnDateInput } from './PgdcnDateInput';

type CustomerSnapshot = PcnSampleRequestBundleDraft['customerSnapshot'];
type DraftLine = PcnSampleRequestBundleDraft['lines'][number];

type Props = {
  open: boolean;
  initialSampleItemIds?: string[];
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
  initialSampleItemIds = [],
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

  const sourceOptions = useMemo(() => {
    const itemOptions = sampleItems.flatMap((item) => {
      const lot = sampleLots.find((candidate) => candidate.id === item.sampleLotId);
      const dossier = dossiers.find((candidate) => candidate.id === lot?.dossierId);
      if (!lot || !dossier) return [];
      return [{
        key: `sample:${item.id}`,
        label: `Biên bản / giao nhận / mẫu ${item.sampleCode} · Lô ${lot.lotCode} · ${dossier.customerSnapshot?.name || 'Chưa có khách hàng'}`,
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

  useEffect(() => {
    if (!open) return;
    setParentPycNumber(`PYC-TONG-${new Date().getFullYear()}-`);
    setCustomerSnapshot(blankCustomer);
    setTargetDate('');
    setCriteria('');
    setSourceKey('');
    setError('');
    setCompletedBundle(undefined);
    const initialLines = initialSampleItemIds.flatMap((sampleItemId) => {
      const item = sampleItems.find((candidate) => candidate.id === sampleItemId);
      const lot = sampleLots.find((candidate) => candidate.id === item?.sampleLotId);
      const dossier = dossiers.find((candidate) => candidate.id === lot?.dossierId);
      const proposal = proposals.find((candidate) => candidate.id === dossier?.proposalId);
      if (!item || !lot || !dossier) return [];
      const routeIdsByLab = routeIdsForItem(item, sampleRoutes);
      const assignedLabCodes = Object.keys(routeIdsByLab) as PcnSampleLabCode[];
      return [{
        sampleItemId: item.id,
        sampleLotId: lot.id,
        dossierId: dossier.id,
        dossierCode: dossier.dossierCode,
        proposalCode: proposal?.proposalCode || dossier.proposalId,
        fieldCode: dossier.fieldCodes?.[0],
        lotCode: lot.lotCode,
        sampleCode: item.sampleCode,
        sampleType: item.sampleType,
        model: item.model,
        ...(item.brand || lot.brand ? { brand: item.brand || lot.brand } : {}),
        quantity: item.quantity,
        ...(item.unit || lot.unit ? { unit: item.unit || lot.unit } : {}),
        labCodes: assignedLabCodes,
        ...(assignedLabCodes.length ? { routeIdsByLab } : {}),
        customerSnapshot: snapshotOf(dossier.customerSnapshot),
        notes: item.notes,
      } satisfies DraftLine];
    });
    const initialCustomer = initialLines[0]?.customerSnapshot;
    if (initialCustomer) setCustomerSnapshot(initialCustomer);
    setLines(initialLines);
  }, [dossiers, initialSampleItemIds, open, proposals, sampleItems, sampleLots, sampleRoutes]);

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
  const lineDataIssues = useMemo(() => lines.map((line, lineIndex) => {
    const issues: PcnSampleRequestBundleValidationIssue[] = [];
    const normalizedLotCode = line.lotCode.trim().toLocaleUpperCase('vi-VN');
    const normalizedSampleCode = line.sampleCode.trim().toLocaleUpperCase('vi-VN');
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      issues.push({ code: 'INVALID_CODE', path: `lines.${lineIndex}.quantity`, message: 'Số lượng phải lớn hơn 0.' });
    }
    if (normalizedLotCode && lines.some((candidate, candidateIndex) => candidateIndex !== lineIndex && candidate.lotCode.trim().toLocaleUpperCase('vi-VN') === normalizedLotCode)) {
      issues.push({ code: 'DUPLICATE_LOT_CODE', path: `lines.${lineIndex}.lotCode`, message: `Mã lô ${line.lotCode} bị trùng trong PYC tổng.` });
    }
    if (normalizedSampleCode && lines.some((candidate, candidateIndex) => candidateIndex !== lineIndex && candidate.sampleCode.trim().toLocaleUpperCase('vi-VN') === normalizedSampleCode)) {
      issues.push({ code: 'DUPLICATE_SAMPLE_CODE', path: `lines.${lineIndex}.sampleCode`, message: `Mã mẫu ${line.sampleCode} bị trùng trong PYC tổng.` });
    }
    if (line.customerSnapshot && customerKey(line.customerSnapshot) !== customerKey(customerSnapshot)) {
      issues.push({ code: 'CUSTOMER_MISMATCH', path: `lines.${lineIndex}.customerSnapshot`, message: 'Các mẫu trong PYC tổng phải thuộc cùng một khách hàng.' });
    }
    return issues;
  }), [customerSnapshot, lines]);
  const lineIssues = useMemo(() => lines.map((line, lineIndex) => {
    const issues: PcnSampleRequestBundleValidationIssue[] = [
      ...mappingPreview.issues.filter((issue) => issue.path.startsWith(`lines.${lineIndex}.`)),
      ...(lineDataIssues[lineIndex] || []),
    ];
    if (!line.lotCode.trim()) issues.push({ code: 'INVALID_CODE', path: `lines.${lineIndex}.lotCode`, message: 'Thiếu mã lô.' });
    if (!line.sampleCode.trim()) issues.push({ code: 'INVALID_CODE', path: `lines.${lineIndex}.sampleCode`, message: 'Thiếu mã mẫu.' });
    if (!line.sampleType.trim()) issues.push({ code: 'INVALID_CODE', path: `lines.${lineIndex}.sampleType`, message: 'Thiếu loại mẫu.' });
    if (!line.model.trim()) issues.push({ code: 'INVALID_CODE', path: `lines.${lineIndex}.model`, message: 'Thiếu model.' });
    if (line.labCodes.length === 0) issues.push({ code: 'MISSING_LAB', path: `lines.${lineIndex}.labCodes`, message: 'Chưa chọn PTN.' });
    return issues;
  }), [lineDataIssues, lines, mappingPreview.issues]);
  const selectedLabCodes = useMemo(() => Array.from(new Set(lines.flatMap((line) => line.labCodes))), [lines]);
  const totalQuantity = useMemo(() => lines.reduce((total, line) => total + (Number.isFinite(line.quantity) ? line.quantity : 0), 0), [lines]);
  const linesWithoutLab = useMemo(() => lines.filter((line) => line.labCodes.length === 0).length, [lines]);
  const issuesForPtn = (lineIndex: number, labCode: PcnSampleLabCode) => mappingPreview.issues.filter((issue) => issue.path.startsWith(`lines.${lineIndex}.`) && issue.path.includes(`.${labCode}`));

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
      labCodes: assignedLabCodes,
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
      labCodes: [],
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
    if (lineDataIssues.some((issues) => issues.length > 0)) {
      setError('Hãy xử lý các lỗi trùng mã, số lượng hoặc khách hàng ngay trên từng dòng trước khi lưu.');
      return;
    }
    if (send && mappingPreview.issues.length > 0) {
      setError('Chưa thể gửi PYC: hãy xử lý hết cảnh báo trong mục Kiểm tra đối chiếu trường.');
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

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-indigo-600" role="dialog" aria-modal="true" aria-busy={isSubmitting} aria-labelledby="pyc-modal-title">
    <div className="flex min-h-0 max-h-[94dvh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600">Sổ quản lý mẫu · PYC tổng / PYC con</p>
          <h2 id="pyc-modal-title" className="text-base font-black text-slate-900">Tạo Phiếu yêu cầu thử nghiệm</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">Gom mẫu cùng khách hàng, kiểm tra ánh xạ rồi gửi qua hệ thống tới phòng thử nghiệm.</p>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-lg p-2 text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="Đóng modal"><X size={17} /></button>
      </div>

      <div className="mobile-scroll-y min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" aria-label="Tiến trình tạo PYC">
          {[['1', 'Nguồn mẫu'], ['2', 'Thông tin & tuyến gửi'], ['3', 'Kiểm tra đối chiếu trường']].map(([step, label], index) => <div key={step} className={`flex items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px] font-black ${index === 2 ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}><span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[11px]">{step}</span>{label}{index < 2 && <ChevronRight size={12} className="ml-auto text-slate-300" />}</div>)}
        </div>

        <section data-testid="pyc-step-source" className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3" aria-labelledby="pyc-step-source-title">
          <div className="mb-2 flex items-start gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white">1</span><div><h3 id="pyc-step-source-title" className="text-[11px] font-black text-indigo-900">Nguồn mẫu</h3><p className="mt-0.5 text-[11px] text-indigo-700">Chọn Đề nghị, biên bản/giao nhận hoặc mẫu đã mã hóa; danh sách sẽ khóa theo cùng khách hàng.</p></div></div>
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <label className="min-w-0 flex-1"><span className="mb-1 block text-[11px] font-black text-indigo-800">Gọi mẫu từ Đề nghị / biên bản / giao nhận</span><select value={sourceKey} onChange={(event) => setSourceKey(event.target.value)} className="min-h-11 w-full rounded-md border border-indigo-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-100"><option value="">Chọn mẫu nguồn...</option>{sourceOptions.map((source) => <option key={source.key} value={source.key}>{source.label}</option>)}</select></label>
            <button type="button" onClick={addSource} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-[11px] font-black text-white outline-none hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-300"><Plus size={13} /> Thêm vào danh sách</button>
            <button type="button" onClick={addBlankLine} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-md border border-indigo-200 bg-white px-3 py-2 text-[11px] font-black text-indigo-700 outline-none hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-300"><Plus size={13} /> Tạo lô mới</button>
          </div>
        </section>

        <section data-testid="pyc-step-routing" className="mt-3" aria-labelledby="pyc-step-routing-title">
          <div className="mb-2 flex items-start gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">2</span><div><h3 id="pyc-step-routing-title" className="text-[11px] font-black text-slate-900">Thông tin &amp; tuyến gửi</h3><p className="mt-0.5 text-[11px] text-slate-500">Xác nhận bản chụp khách hàng, thông tin PYC và tuyến PTN trên từng dòng.</p></div></div>
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[1fr_1fr_1.2fr]">
            <label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Số PYC tổng<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><input required aria-required="true" value={parentPycNumber} onChange={(event) => setParentPycNumber(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Khách hàng · Cùng khách hàng<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><input required aria-required="true" value={customerSnapshot.name} onChange={(event) => setCustomerSnapshot((current) => ({ ...current, name: event.target.value }))} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Địa chỉ khách hàng<span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><input required aria-required="true" value={customerSnapshot.address} onChange={(event) => setCustomerSnapshot((current) => ({ ...current, address: event.target.value }))} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label>
            <label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Hạn trả KQTN</span><PgdcnDateInput aria-label="Hạn trả KQTN" value={targetDate} onChange={setTargetDate} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label>
            <label className="block md:col-span-2"><span className="mb-1 block text-[11px] font-black text-slate-500">Chỉ tiêu/tiêu chuẩn</span><input aria-label="Chỉ tiêu/tiêu chuẩn" value={criteria} onChange={(event) => setCriteria(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100" /></label>
          </div>
        </section>

        {error && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-800">{error}</div>}

        <div data-testid="pyc-draft-summary" className="mt-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-600">
          <span>{lines.length} dòng · {totalQuantity} mẫu</span>
          <span className="text-slate-300">·</span>
          <span>Khách hàng: {customerSnapshot.name || 'Chưa khóa'}</span>
          <span className="text-slate-300">·</span>
          <span>{selectedLabCodes.length} PTN/app được chọn</span>
          {linesWithoutLab > 0 && <span role="alert" className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">{linesWithoutLab} dòng chưa có PTN</span>}
        </div>

        <div data-testid="sample-request-bundle-lines" className="mobile-scroll-x mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1380px] w-full border-collapse text-left text-[11px]">
            <thead className="bg-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-2 py-2">#</th><th scope="col" className="px-2 py-2">Mã lô / Mã mẫu <span aria-hidden="true" className="text-rose-600">*</span></th><th scope="col" className="px-2 py-2">Loại mẫu / kiểu loại <span aria-hidden="true" className="text-rose-600">*</span></th><th scope="col" className="px-2 py-2">Nhãn hiệu / Đơn vị</th><th scope="col" className="px-2 py-2">SL <span aria-hidden="true" className="text-rose-600">*</span></th><th scope="col" className="px-2 py-2">Ghi chú mẫu</th><th scope="col" className="px-2 py-2">Tuyến / ứng dụng đích <span aria-hidden="true" className="text-rose-600">*</span></th><th scope="col" className="px-2 py-2">Hồ sơ</th><th scope="col" className="px-2 py-2">Kiểm tra</th><th scope="col" className="px-2 py-2" /></tr></thead>
            <tbody>
              {lines.map((line, index) => {
                const itemRoutes = line.sampleItemId ? sampleRoutes.filter((route) => route.sampleLotId === line.sampleLotId && route.sampleItemIds?.includes(line.sampleItemId as string)) : [];
                const issues = lineIssues[index] || [];
                return <tr key={`${line.sampleItemId || 'new'}-${index}`} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2 font-black text-slate-400">{index + 1}</td>
                  <td className="space-y-1 px-2 py-2"><input required aria-label={`Mã lô mẫu ${index + 1}`} aria-describedby={issues.length ? `mapping-line-issue-${index}` : undefined} value={line.lotCode} onChange={(event) => updateLine(index, { lotCode: event.target.value })} className="min-h-11 w-40 rounded border border-slate-200 px-2 py-1.5 font-mono text-[11px] outline-none focus:border-emerald-400" /><input required aria-label={`Mã mẫu ${index + 1}`} aria-describedby={issues.length ? `mapping-line-issue-${index}` : undefined} value={line.sampleCode} onChange={(event) => updateLine(index, { sampleCode: event.target.value })} className="min-h-11 w-40 rounded border border-slate-200 px-2 py-1.5 font-mono text-[11px] outline-none focus:border-emerald-400" /></td>
                  <td className="space-y-1 px-2 py-2"><input required aria-label={`Loại mẫu ${index + 1}`} aria-describedby={issues.length ? `mapping-line-issue-${index}` : undefined} value={line.sampleType} onChange={(event) => updateLine(index, { sampleType: event.target.value })} className="min-h-11 w-44 rounded border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-emerald-400" /><input required aria-label={`Kiểu loại ${index + 1}`} aria-describedby={issues.length ? `mapping-line-issue-${index}` : undefined} value={line.model} onChange={(event) => updateLine(index, { model: event.target.value })} className="min-h-11 w-44 rounded border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-emerald-400" /></td>
                  <td className="space-y-1 px-2 py-2"><input aria-label={`Nhãn hiệu ${index + 1}`} value={line.brand || ''} onChange={(event) => updateLine(index, { brand: event.target.value })} className="min-h-11 w-36 rounded border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-emerald-400" /><input aria-label={`Đơn vị ${index + 1}`} value={line.unit || ''} onChange={(event) => updateLine(index, { unit: event.target.value })} className="min-h-11 w-24 rounded border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-emerald-400" /></td>
                  <td className="px-2 py-2"><input required type="number" min={1} aria-label={`Số lượng ${index + 1}`} aria-describedby={issues.length ? `mapping-line-issue-${index}` : undefined} value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="min-h-11 w-16 rounded border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-emerald-400" /></td>
                  <td className="px-2 py-2"><input aria-label={`Ghi chú mẫu ${index + 1}`} value={line.notes || ''} onChange={(event) => updateLine(index, { notes: event.target.value })} className="min-h-11 w-44 rounded border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-emerald-400" /></td>
                  <td className="px-2 py-2">
                    {line.sampleItemId ? <div className="space-y-1.5">{itemRoutes.length ? itemRoutes.map((route) => { const ptnIssues = issuesForPtn(index, route.labCode); return <div key={route.id} className={`rounded border px-2 py-1.5 ${ptnIssues.length ? 'border-rose-200 bg-rose-50' : 'border-emerald-100 bg-emerald-50'}`}><div className="flex items-center justify-between gap-2"><span className={`font-bold ${ptnIssues.length ? 'text-rose-800' : 'text-emerald-800'}`}>{route.labName}</span><span className="font-mono text-[11px] text-slate-600">{route.id}</span></div>{ptnIssues.length > 0 && <ul data-testid="mapping-ptn-issue" role="alert" className="mt-1 space-y-0.5 text-[11px] font-bold text-rose-700">{ptnIssues.map((issue) => <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>)}</ul>}</div>; }) : <div className="rounded border border-rose-200 bg-rose-50 px-2 py-1.5 font-bold text-rose-700">Chưa có tuyến được gán<ul data-testid="mapping-ptn-issue" role="alert" className="mt-1 space-y-0.5 text-[11px] font-normal">{line.labCodes.map((labCode) => issuesForPtn(index, labCode).map((issue) => <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>))}</ul></div>}</div> : <div className="grid grid-cols-2 gap-1.5">{PCN_SAMPLE_LAB_OPTIONS.map((lab) => { const ptnIssues = issuesForPtn(index, lab.code); return <label key={lab.code} className={`flex min-h-11 items-center gap-1 rounded border px-1.5 py-1.5 text-[11px] font-bold ${ptnIssues.length ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-700'}`}><input type="checkbox" checked={line.labCodes.includes(lab.code)} aria-describedby={ptnIssues.length ? `mapping-ptn-issue-${index}-${lab.code}` : undefined} onChange={() => toggleLab(index, lab.code)} />{lab.name.replace('Phòng thử nghiệm ', 'PTN ')}{ptnIssues.length > 0 && <span id={`mapping-ptn-issue-${index}-${lab.code}`} className="sr-only">{ptnIssues.map((issue) => issue.message).join(' ')}</span>}</label>; })}</div>}
                    <p className="mt-1 text-[11px] text-slate-500">PERFORMANCE → LABFTEE · EMC/An toàn điện → DDT</p>
                  </td>
                  <td className="px-2 py-2"><span className="rounded bg-slate-100 px-1.5 py-1 font-mono text-[11px] text-slate-600">{line.dossierCode || line.dossierId}</span><p className="mt-1 max-w-32 text-[11px] text-slate-500">{line.customerSnapshot?.name}</p></td>
                  <td className="px-2 py-2">{issues.length > 0 ? <ul id={`mapping-line-issue-${index}`} data-testid="mapping-line-issue" role="alert" className="min-w-36 space-y-0.5 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-bold text-rose-700">{issues.map((issue) => <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>)}</ul> : <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">Sẵn sàng</span>}</td>
                  <td className="px-2 py-2"><button type="button" aria-label={`Xóa mẫu ${index + 1}`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))} className="min-h-11 min-w-11 rounded p-1.5 text-slate-400 outline-none hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-300"><X size={13} /></button></td>
                </tr>;
              })}
              {lines.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-[11px] text-slate-400">Chưa có mẫu. Gọi từ nguồn hoặc tạo lô mới.</td></tr>}
            </tbody>
          </table>
        </div>

        <div data-testid="pyc-step-mapping" className="mt-3">
        <section data-testid="pyc-mapping-preview" className="rounded-xl border border-slate-200 bg-white" aria-labelledby="pyc-mapping-title">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
            <div><h3 id="pyc-mapping-title" className="text-[11px] font-black text-slate-900">Kiểm tra đối chiếu trường</h3><p className="mt-0.5 text-[11px] text-slate-500">Đối chiếu trường PCN trước khi tạo PYC con · phiên bản đối chiếu: <span className="font-mono">pcn-lab-map-v1</span></p></div>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-black text-indigo-700">{mappingPreview.dispatches.length} ứng dụng đích</span>
          </div>
          <div className="divide-y divide-slate-100">
            {mappingPreview.dispatches.map((dispatch) => <div key={dispatch.labCode} className="p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2"><span className="text-[11px] font-black text-slate-800">{dispatch.labName}</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700">{dispatch.targetSystemCode || 'Chưa cấu hình app đích'}</span><span className="text-[11px] text-slate-500">{dispatch.rows.length} dòng dữ liệu</span></div>
              <div className="grid gap-2 lg:grid-cols-2">{dispatch.rows.map((row) => { const rowIssues = issuesForPtn(row.lineIndex, row.labCode); return <div key={`${row.lineIndex}-${row.labCode}`} className={`rounded-lg border p-2.5 ${rowIssues.length ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200'}`}><div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] font-black text-slate-800">{row.sampleCode}</p><p className="text-[11px] text-slate-500">{row.model || 'Chưa có model'}</p></div><span className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${routeTone(row.routeStatus)}`}>{row.routeStatus}</span></div><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">{row.values.map((field) => <div key={field.key} className="min-w-0"><dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">{field.label}</dt><dd className="truncate text-[11px] font-bold text-slate-700" title={field.value}>{field.value}</dd></div>)}</dl>{rowIssues.length > 0 && <ul data-testid="mapping-ptn-issue" role="alert" className="mt-2 space-y-0.5 border-t border-rose-200 pt-1.5 text-[11px] font-bold text-rose-700">{rowIssues.map((issue) => <li key={`${issue.path}-${issue.code}`}>{issue.message}</li>)}</ul>}</div>; })}</div>
            </div>)}
            {mappingPreview.dispatches.length === 0 && <p className="px-3 py-5 text-center text-[11px] text-slate-400">Thêm mẫu để xem đối chiếu trường sang từng phòng thử nghiệm.</p>}
          </div>
          {mappingPreview.issues.length > 0 && <div role="alert" className="border-t border-rose-200 bg-rose-50 px-3 py-2"><p className="flex items-center gap-1 text-[11px] font-black text-rose-800"><AlertTriangle size={13} /> Cần xử lý trước khi gửi</p><ul className="mt-1 space-y-0.5 text-[11px] font-bold text-rose-700">{mappingPreview.issues.map((issue) => <li key={`${issue.path}-${issue.code}`}>• {issue.message}</li>)}</ul></div>}
        </section></div>

        {completedBundle && <section className="mt-3 rounded-xl border border-slate-200 bg-white" aria-labelledby="pyc-send-result-title">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5"><h3 id="pyc-send-result-title" className="text-[11px] font-black text-slate-900">Kết quả gửi PYC</h3><p className="mt-0.5 text-[11px] text-slate-500">Kết quả phản hồi được giữ lại trong modal để đối soát theo từng ứng dụng đích.</p></div>
          <div className="grid gap-2 p-3 lg:grid-cols-2">{completedBundle.dispatches.map((dispatch) => <div key={dispatch.id} className={`rounded-lg border p-2.5 ${statusTone(dispatch.status)}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-black">{dispatch.targetSystemCode || dispatch.labCode}</span><span className="inline-flex items-center gap-1 text-[11px] font-black">{dispatch.status === 'ACKNOWLEDGED' ? <CheckCircle2 size={12} /> : dispatch.status === 'ERROR' || dispatch.status === 'RECONCILE_REQUIRED' ? <XCircle size={12} /> : null}{statusLabel(dispatch.status)}</span></div>{dispatch.externalRequestCodes?.length ? <p className="mt-1 text-[11px] font-bold">Mã PYC PTN: <span className="font-mono">{dispatch.externalRequestCodes.join(', ')}</span></p> : null}{dispatch.lastErrorMessage ? <p className="mt-1 text-[11px] font-bold">{dispatch.lastErrorMessage}</p> : null}{dispatch.status === 'ERROR' || dispatch.status === 'RECONCILE_REQUIRED' ? <button type="button" disabled={isSubmitting} onClick={() => void retryDispatch(dispatch.id)} className="mt-2 mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-current bg-white px-2 py-1 text-[11px] font-black disabled:opacity-50"><RefreshCw size={11} /> Gửi lại PYC con</button> : null}</div>)}</div>
        </section>}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-bold text-slate-500">{lines.length} mẫu · {Array.from(new Set(lines.flatMap((line) => line.labCodes))).length} tuyến/app · Lưu không gọi trực tiếp sang PTN.</p>
        <div className="flex w-full gap-2 sm:w-auto"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 sm:flex-none">{completedBundle ? 'Đóng' : 'Hủy'}</button>{!completedBundle && <><button type="button" disabled={isSubmitting} aria-busy={isSubmitting} onClick={() => void submit(false)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-md border border-emerald-200 bg-white px-3 py-2 text-[11px] font-black text-emerald-700 outline-none hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50 sm:flex-none"><Save size={13} /> {isSubmitting ? 'Đang lưu...' : 'Lưu nháp'}</button><button type="button" disabled={isSubmitting} aria-busy={isSubmitting} onClick={() => void submit(true)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm outline-none hover:bg-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50 sm:flex-none"><Send size={13} /> {isSubmitting ? 'Đang gửi...' : 'Gửi PYC'}</button></>}</div>
      </div>
    </div>
  </div>;
}
