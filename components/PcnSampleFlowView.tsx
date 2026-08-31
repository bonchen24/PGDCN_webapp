'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, Boxes, ClipboardList, MapPin, Plus, Search, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import type {
  CertificationDossier,
  CertificationProposal,
  PcnCertificationField,
  PcnSampleLabCode,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  PcnSampleRouteStatus,
  UserAccount,
} from '../types';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types';
import { getPcnCodeFamilyLabel, reviewPcnCodes } from '../utils/pcnCodePolicy';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { getNextPcnSampleRouteStatuses, getPcnSampleLabCodesForFields } from '../utils/pcnSampleFlow';
import type { PcnSampleLotDraft, PcnSampleRouteUpdate } from '../utils/pcnSampleFlow';

const ROUTE_STATUS_LABELS: Record<PcnSampleRouteStatus, string> = {
  PENDING: 'Chờ gửi', SENT: 'Đang giao', RECEIVED: 'PTN đã nhận', RESULT_RETURNED: 'Đã trả KQ',
  RETURNED_TO_PCN: 'Đã trả PCN', CLOSED: 'Đã đóng', ISSUE: 'Có vấn đề', CANCELLED: 'Đã hủy',
};
const LOT_STATUS_LABELS: Record<PcnSampleLot['status'], string> = {
  PREPARED: 'Đã chuẩn bị', IN_TRANSIT: 'Đang luân chuyển', AT_LAB: 'Tại phòng thử',
  RESULTS_PENDING: 'Chờ PCN tiếp nhận KQ', RETURNED_TO_PCN: 'Đã về PCN', CLOSED: 'Đã hoàn tất', ISSUE: 'Cần xử lý',
};
const ROUTE_STATUS_CLASSES: Record<PcnSampleRouteStatus, string> = {
  PENDING: 'border-slate-200 bg-slate-50 text-slate-600', SENT: 'border-blue-200 bg-blue-50 text-blue-700',
  RECEIVED: 'border-cyan-200 bg-cyan-50 text-cyan-700', RESULT_RETURNED: 'border-amber-200 bg-amber-50 text-amber-700',
  RETURNED_TO_PCN: 'border-emerald-200 bg-emerald-50 text-emerald-700', CLOSED: 'border-slate-200 bg-slate-100 text-slate-500',
  ISSUE: 'border-rose-200 bg-rose-50 text-rose-700', CANCELLED: 'border-slate-200 bg-slate-100 text-slate-400',
};
const LOT_STATUS_CLASSES: Record<PcnSampleLot['status'], string> = {
  PREPARED: 'border-slate-200 bg-slate-50 text-slate-600', IN_TRANSIT: 'border-blue-200 bg-blue-50 text-blue-700',
  AT_LAB: 'border-cyan-200 bg-cyan-50 text-cyan-700', RESULTS_PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  RETURNED_TO_PCN: 'border-emerald-200 bg-emerald-50 text-emerald-700', CLOSED: 'border-slate-200 bg-slate-100 text-slate-500',
  ISSUE: 'border-rose-200 bg-rose-50 text-rose-700',
};

function makeId(): string {
  return `sample-lot-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}
function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN');
}
function canEditSamples(user: UserAccount | null): boolean {
  return user?.systemRole === 'admin' || user?.systemRole === 'staff' || user?.role === 'admin' || user?.role === 'staff';
}
function labName(code: PcnSampleLabCode): string {
  return PCN_SAMPLE_LAB_OPTIONS.find((item) => item.code === code)?.name || code;
}
function nextActionLabel(status: PcnSampleRouteStatus): string {
  return status === 'SENT' ? 'Gửi mẫu' : status === 'RECEIVED' ? 'Xác nhận nhận' : status === 'RESULT_RETURNED' ? 'Ghi nhận KQ' : status === 'RETURNED_TO_PCN' ? 'Nhận mẫu về PCN' : status === 'CLOSED' ? 'Đóng tuyến' : 'Cập nhật';
}

type PcnSampleForm = {
  dossierId: string; lotCode: string; sampleName: string; model: string; brand: string; quantity: string; unit: string;
  sampleItems: Array<{ sampleCode: string; sampleType: string; model: string; brand: string; quantity: string; unit: string }>;
  fieldCodes: string[]; labCodes: PcnSampleLabCode[];
  qc20Snapshot: { grade: string; nominalDimensions: string; manufacturerLotCode: string; lotDefinition: NonNullable<PcnSampleLotDraft['qc20Snapshot']>['lotDefinition'] | '' };
  notes: string;
};
function emptyPcnSampleForm(): PcnSampleForm {
  return { dossierId: '', lotCode: '', sampleName: '', model: '', brand: '', quantity: '1', unit: 'mẫu', sampleItems: [], fieldCodes: [], labCodes: [], qc20Snapshot: { grade: '', nominalDimensions: '', manufacturerLotCode: '', lotDefinition: '' }, notes: '' };
}

function RouteCell({ route, editable, busyRouteId, onAdvance, onOpenHandover }: { route?: PcnSampleRoute; editable: boolean; busyRouteId?: string; onAdvance: (route: PcnSampleRoute, status: PcnSampleRouteStatus, update?: PcnSampleRouteUpdate) => void; onOpenHandover?: (routeId: string) => void }) {
  if (!route) return <div className="min-w-[150px] rounded-lg border border-dashed border-slate-200 p-2 text-[10px] text-slate-400">Chưa đăng ký tuyến</div>;
  const nextStatus = getNextPcnSampleRouteStatuses(route.status).find((status) => status !== 'CANCELLED');
  const timestamp = route.status === 'SENT' ? route.sentAt : route.status === 'RECEIVED' ? route.receivedAt : route.status === 'RESULT_RETURNED' ? route.resultReturnedAt : route.returnedAt;
  const isBusy = busyRouteId === route.id;
  return <div className="min-w-[150px] rounded-lg border border-slate-200 bg-white p-2"><span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black ${ROUTE_STATUS_CLASSES[route.status]}`}>{ROUTE_STATUS_LABELS[route.status]}</span><div className="mt-1 text-[9px] text-slate-400">{formatDate(timestamp)}</div>{route.labRequestId && <div className="mt-1 truncate font-mono text-[9px] text-slate-500">PYC: {route.labRequestId}</div>}<div className="mt-2 flex flex-wrap gap-1">{onOpenHandover && <button type="button" onClick={() => onOpenHandover(route.id)} className="rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-1 text-[9px] font-bold text-indigo-700 hover:bg-indigo-100">Chi tiết / biên bản</button>}{editable && nextStatus && <button type="button" onClick={() => onAdvance(route, nextStatus)} disabled={isBusy} aria-busy={isBusy} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[9px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-50"><ArrowRight size={10} />{isBusy ? 'Đang lưu...' : nextActionLabel(nextStatus)}</button>}</div></div>;
}

export function PcnSampleFlowView({ sampleLots, sampleItems = [], sampleRoutes, dossiers, proposals, fields, currentUser, initialDossierId, canEdit = true, onCreate, onRouteStatusChange, onOpenHandover }: { sampleLots: PcnSampleLot[]; sampleItems?: PcnSampleItem[]; sampleRoutes: PcnSampleRoute[]; dossiers: CertificationDossier[]; proposals: CertificationProposal[]; fields: PcnCertificationField[]; currentUser: UserAccount | null; initialDossierId?: string; canEdit?: boolean; onCreate: (draft: PcnSampleLotDraft) => Promise<void>; onRouteStatusChange: (routeId: string, status: PcnSampleRouteStatus, update?: PcnSampleRouteUpdate) => Promise<void>; onOpenHandover?: (routeId: string) => void }) {
  const [query, setQuery] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRouteId, setBusyRouteId] = useState<string>();
  const [form, setForm] = useState<PcnSampleForm>(emptyPcnSampleForm());
  const editable = canEdit && canEditSamples(currentUser);
  const selectedDossier = dossiers.find((item) => item.id === form.dossierId);
  const availableFields = selectedDossier ? fields.filter((field) => selectedDossier.fieldCodes.includes(field.code)) : [];
  const availableLabOptions = PCN_SAMPLE_LAB_OPTIONS.filter((lab) => getPcnSampleLabCodesForFields(form.fieldCodes).includes(lab.code));
  const codeReview = useMemo(() => reviewPcnCodes(selectedDossier?.fieldCodes || form.fieldCodes, form.lotCode), [form.fieldCodes, form.lotCode, selectedDossier?.fieldCodes]);
  const routesByLot = useMemo(() => {
    const result = new Map<string, PcnSampleRoute[]>();
    for (const route of sampleRoutes) result.set(route.sampleLotId, [...(result.get(route.sampleLotId) || []), route]);
    return result;
  }, [sampleRoutes]);
  const visibleLots = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('vi-VN');
    return sampleLots.filter((lot) => {
      if (initialDossierId && lot.dossierId !== initialDossierId) return false;
      if (!term) return true;
      const dossier = dossiers.find((item) => item.id === lot.dossierId);
      const proposal = proposals.find((item) => item.id === dossier?.proposalId);
      const customerSnapshot = dossier ? getPcnDossierCustomerSnapshot(dossier, proposal) : undefined;
      const itemSearch = sampleItems.filter((item) => item.sampleLotId === lot.id).map((item) => `${item.sampleCode} ${item.sampleType} ${item.model}`).join(' ');
      return `${lot.lotCode} ${lot.sampleName} ${lot.model || ''} ${itemSearch} ${proposal?.proposalCode || ''} ${customerSnapshot?.name || ''}`.toLocaleLowerCase('vi-VN').includes(term);
    });
  }, [dossiers, initialDossierId, proposals, query, sampleItems, sampleLots]);

  const resetForm = () => { setForm(emptyPcnSampleForm()); setOpenForm(false); };
  const selectDossier = (dossierId: string) => {
    const dossier = dossiers.find((item) => item.id === dossierId);
    const proposal = proposals.find((item) => item.id === dossier?.proposalId);
    const scope = proposal?.qc20Scope;
    setForm((previous) => {
      const fieldCodes = dossier?.fieldCodes || previous.fieldCodes;
      return { ...previous, dossierId, fieldCodes: dossier?.fieldCodes || previous.fieldCodes, labCodes: getPcnSampleLabCodesForFields(fieldCodes), qc20Snapshot: { grade: scope?.grade || '', nominalDimensions: scope?.nominalDimensions || '', manufacturerLotCode: scope?.manufacturerLotCode || '', lotDefinition: scope?.lotDefinition || '' } };
    });
  };
  const toggleField = (code: string, checked: boolean) => {
    setForm((previous) => {
      const fieldCodes = checked ? [...new Set([...previous.fieldCodes, code])] : previous.fieldCodes.filter((item) => item !== code);
      const allowed = getPcnSampleLabCodesForFields(fieldCodes);
      return { ...previous, fieldCodes, labCodes: previous.labCodes.filter((item) => allowed.includes(item)) };
    });
  };
  const addSampleItem = () => setForm((previous) => ({
    ...previous,
    sampleItems: [...previous.sampleItems, { sampleCode: `${previous.lotCode || 'Mẫu'}-M${previous.sampleItems.length + 2}`, sampleType: '', model: '', brand: previous.brand, quantity: '1', unit: previous.unit }],
  }));
  const updateSampleItem = (index: number, updates: Partial<PcnSampleForm['sampleItems'][number]>) => setForm((previous) => ({
    ...previous,
    sampleItems: previous.sampleItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item),
  }));
  const removeSampleItem = (index: number) => setForm((previous) => ({ ...previous, sampleItems: previous.sampleItems.filter((_, itemIndex) => itemIndex !== index) }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.dossierId || !form.lotCode.trim() || !form.sampleName.trim() || form.fieldCodes.length === 0 || form.labCodes.length === 0 || form.sampleItems.some((item) => !item.sampleType.trim() || !item.model.trim() || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) {
      toast.error('Vui lòng chọn hồ sơ, nhập đủ mẫu/model, số lượng hợp lệ và chọn phòng thử.');
      return;
    }
    setSaving(true);
    try {
      await onCreate({ id: makeId(), dossierId: form.dossierId, lotCode: form.lotCode, sampleName: form.sampleName, model: form.model, brand: form.brand, quantity: Number(form.quantity), unit: form.unit, sampleItems: [{ sampleCode: form.lotCode, sampleType: form.sampleName, model: form.model, brand: form.brand, quantity: Number(form.quantity), unit: form.unit }, ...form.sampleItems.map((item) => ({ ...item, quantity: Number(item.quantity) }))], fieldCodes: form.fieldCodes, labCodes: form.labCodes, notes: form.notes, ...(form.fieldCodes.includes('QC20') ? { qc20Snapshot: { ...form.qc20Snapshot, lotDefinition: form.qc20Snapshot.lotDefinition || undefined } } : {}) });
      toast.success(`Đã tạo lô mẫu ${form.lotCode}.`);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tạo lô mẫu.');
    } finally { setSaving(false); }
  };
  const advanceRoute = async (route: PcnSampleRoute, status: PcnSampleRouteStatus) => {
    if (busyRouteId === route.id) return;
    setBusyRouteId(route.id);
    try { await onRouteStatusChange(route.id, status); toast.success(`Đã cập nhật tuyến ${labName(route.labCode)}.`); }
    catch (error: any) { toast.error(error?.message || 'Không thể cập nhật luân chuyển mẫu.'); }
    finally { setBusyRouteId(undefined); }
  };
  const stats = {
    lots: initialDossierId ? sampleLots.filter((lot) => lot.dossierId === initialDossierId).length : sampleLots.length,
    moving: sampleLots.filter((lot) => (!initialDossierId || lot.dossierId === initialDossierId) && (lot.status === 'IN_TRANSIT' || lot.status === 'AT_LAB')).length,
    waitingResults: sampleLots.filter((lot) => (!initialDossierId || lot.dossierId === initialDossierId) && lot.status === 'RESULTS_PENDING').length,
    issues: sampleLots.filter((lot) => (!initialDossierId || lot.dossierId === initialDossierId) && lot.status === 'ISSUE').length,
  };

  return <div className="pcn-page-surface min-w-0 bg-slate-50/60 p-3 pb-20 md:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Bảng cell tổng hợp</p><h1 className="mt-1 text-xl font-black text-slate-900">Mẫu theo lô & luân chuyển</h1><p className="mt-1 text-[11px] text-slate-500">Mã hóa mẫu theo lô là định danh PCN; mỗi cell là một tuyến luân chuyển. QC4/QC9 đi qua các phòng thử điện; QC20 mặc định đi phân tích thành phần hóa học.</p>{initialDossierId && <p className="mt-1 text-[10px] font-bold text-indigo-700">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</p>}</div>{editable && !openForm && <button type="button" onClick={() => { if (initialDossierId) selectDossier(initialDossierId); setOpenForm(true); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500"><Plus size={14} /> Tạo lô mẫu</button>}</div>
    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"><div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[9px] font-black uppercase text-slate-400">Tổng lô mẫu</div><div className="mt-1 text-lg font-black text-slate-800">{stats.lots}</div></div><div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[9px] font-black uppercase text-slate-400">Đang luân chuyển</div><div className="mt-1 text-lg font-black text-blue-700">{stats.moving}</div></div><div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[9px] font-black uppercase text-slate-400">Chờ KQTN</div><div className="mt-1 text-lg font-black text-amber-700">{stats.waitingResults}</div></div><div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[9px] font-black uppercase text-slate-400">Có vấn đề</div><div className="mt-1 text-lg font-black text-rose-700">{stats.issues}</div></div></div>
    {editable && openForm && <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm md:p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-800">Tạo lô mẫu PCN</h2><p className="mt-0.5 text-[10px] text-slate-400">Một lô có thể đi nhiều phòng thử; mỗi tuyến hiển thị thành một cell riêng.</p></div><button type="button" onClick={resetForm} disabled={saving} aria-label="Đóng biểu mẫu tạo lô mẫu" className="text-slate-400 disabled:opacity-40"><X size={16} /></button></div>
      <div className="grid gap-2 md:grid-cols-3"><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Hồ sơ chứng nhận *</span><select required className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]" value={form.dossierId} onChange={(event) => selectDossier(event.target.value)}><option value="">Chọn hồ sơ</option>{dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.dossierCode} — {getPcnDossierCustomerSnapshot(dossier, proposals.find((item) => item.id === dossier.proposalId))?.name || 'Chưa có khách hàng'}</option>)}</select></label><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Mã hóa mẫu theo lô *</span><input className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.lotCode} onChange={(event) => setForm({ ...form, lotCode: event.target.value })} placeholder="Ví dụ: 0109-01 hoặc IEMM 0105-01" />{form.lotCode.trim() && <p className={`mt-1 text-[9px] font-bold leading-4 ${codeReview.needsReview ? 'text-amber-700' : 'text-emerald-700'}`}>{codeReview.needsReview ? 'Cần đối chiếu mã nguồn PCN' : `${getPcnCodeFamilyLabel(codeReview.family)} · Đã nhận diện`}{codeReview.normalized && codeReview.normalized !== codeReview.source ? ` · Mã chuẩn hóa: ${codeReview.normalized}` : ''}</p>}</label><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Số lượng mẫu *</span><input type="number" min="1" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label></div>
      <div className="grid gap-2 md:grid-cols-3"><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Loại mẫu/model đầu tiên *</span><input className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.sampleName} onChange={(event) => setForm({ ...form, sampleName: event.target.value })} /></label><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Model đầu tiên *</span><input className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Nhãn hiệu</span><input className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label></div>
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3"><div className="flex items-center justify-between gap-2"><div><div className="text-[10px] font-black text-indigo-900">Mẫu/model bổ sung trong cùng lô</div><p className="mt-0.5 text-[9px] text-indigo-700">Mỗi dòng là một mẫu riêng; PYC vẫn được tạo theo toàn bộ lô.</p></div><button type="button" onClick={addSampleItem} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[9px] font-black text-indigo-700"><Plus size={11} /> Thêm mẫu/model</button></div>{form.sampleItems.length > 0 && <div className="mt-2 space-y-2">{form.sampleItems.map((item, index) => <div key={`${index}-${item.sampleCode}`} className="grid gap-2 rounded-md border border-indigo-100 bg-white p-2 md:grid-cols-[1fr_1fr_1fr_100px_100px_auto]"><input aria-label={`Mã mẫu bổ sung ${index + 1}`} value={item.sampleCode} onChange={(event) => updateSampleItem(index, { sampleCode: event.target.value })} placeholder="Mã mẫu" className="rounded border border-slate-200 px-2 py-1 text-[10px]" /><input aria-label={`Loại mẫu bổ sung ${index + 1}`} value={item.sampleType} onChange={(event) => updateSampleItem(index, { sampleType: event.target.value })} placeholder="Loại mẫu *" className="rounded border border-slate-200 px-2 py-1 text-[10px]" /><input aria-label={`Model bổ sung ${index + 1}`} value={item.model} onChange={(event) => updateSampleItem(index, { model: event.target.value })} placeholder="Model *" className="rounded border border-slate-200 px-2 py-1 text-[10px]" /><input aria-label={`Số lượng bổ sung ${index + 1}`} type="number" min="1" value={item.quantity} onChange={(event) => updateSampleItem(index, { quantity: event.target.value })} placeholder="SL" className="rounded border border-slate-200 px-2 py-1 text-[10px]" /><input aria-label={`Đơn vị bổ sung ${index + 1}`} value={item.unit} onChange={(event) => updateSampleItem(index, { unit: event.target.value })} placeholder="Đơn vị" className="rounded border border-slate-200 px-2 py-1 text-[10px]" /><button type="button" onClick={() => removeSampleItem(index)} aria-label={`Xóa mẫu bổ sung ${index + 1}`} className="rounded border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700">Xóa</button></div>)}</div>}</div>
      {form.fieldCodes.includes('QC20') && <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3"><div className="text-[10px] font-black text-amber-900">Nhận diện lô QC20</div><div className="mt-2 grid gap-2 md:grid-cols-4"><label className="block"><span className="mb-1 block text-[10px] font-black text-amber-900">Mác thép *</span><input className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[11px]" value={form.qc20Snapshot.grade} onChange={(event) => setForm({ ...form, qc20Snapshot: { ...form.qc20Snapshot, grade: event.target.value } })} /></label><label className="block"><span className="mb-1 block text-[10px] font-black text-amber-900">Kích thước danh nghĩa *</span><input className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[11px]" value={form.qc20Snapshot.nominalDimensions} onChange={(event) => setForm({ ...form, qc20Snapshot: { ...form.qc20Snapshot, nominalDimensions: event.target.value } })} /></label><label className="block"><span className="mb-1 block text-[10px] font-black text-amber-900">Số lô nhà sản xuất / lô hàng *</span><input className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[11px]" value={form.qc20Snapshot.manufacturerLotCode} onChange={(event) => setForm({ ...form, qc20Snapshot: { ...form.qc20Snapshot, manufacturerLotCode: event.target.value } })} /></label><label className="block"><span className="mb-1 block text-[10px] font-black text-amber-900">Cách xác định lô *</span><select className="w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[11px]" value={form.qc20Snapshot.lotDefinition} onChange={(event) => setForm({ ...form, qc20Snapshot: { ...form.qc20Snapshot, lotDefinition: event.target.value as PcnSampleForm['qc20Snapshot']['lotDefinition'] } })}><option value="">Chọn cách xác định lô</option><option value="PRODUCT_LOT">Lô sản phẩm</option><option value="SHIPMENT_LOT">Lô hàng hóa</option></select></label></div></div>}
      <div><div className="mb-1.5 text-[10px] font-black text-slate-500">Phòng thử nhận mẫu *</div><p className="mb-1.5 text-[9px] text-slate-400">Tuyến được gợi ý theo Lĩnh vực đã chọn; QC20 chỉ mặc định tuyến phân tích hóa học.</p>{availableLabOptions.length === 0 ? <p className="text-[10px] text-slate-400">Chọn Lĩnh vực để hiển thị tuyến mẫu.</p> : <div className="flex flex-wrap gap-2">{availableLabOptions.map((lab) => <label key={lab.code} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${form.labCodes.includes(lab.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={form.labCodes.includes(lab.code)} onChange={(event) => setForm({ ...form, labCodes: event.target.checked ? [...form.labCodes, lab.code] : form.labCodes.filter((code) => code !== lab.code) })} />{lab.name}</label>)}</div>}</div>
      <div><div className="mb-1.5 text-[10px] font-black text-slate-500">Lĩnh vực liên quan *</div>{!selectedDossier ? <p className="text-[10px] text-slate-400">Chọn hồ sơ trước để hiển thị các Lĩnh vực được phép.</p> : availableFields.length === 0 ? <p className="text-[10px] text-amber-700">Hồ sơ chưa có Lĩnh vực để gắn lô mẫu.</p> : <div className="flex flex-wrap gap-2">{availableFields.map((field) => <label key={field.code} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${form.fieldCodes.includes(field.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={form.fieldCodes.includes(field.code)} onChange={(event) => toggleField(field.code, event.target.checked)} />{field.name}</label>)}</div>}</div>
      <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Ghi chú</span><textarea rows={2} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="flex justify-end gap-2"><button type="button" onClick={resetForm} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Tạo lô và tuyến'}</button></div>
    </form>}
    <div className="mt-4 flex items-center gap-2"><Search size={14} className="text-slate-400" /><input className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã lô, mẫu, model, Đề nghị hoặc khách hàng..." /></div>
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[1180px] w-full border-collapse text-left"><thead className="bg-slate-50"><tr className="border-b border-slate-200"><th className="w-[220px] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Lô mẫu / hồ sơ</th><th className="w-[150px] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Mẫu</th><th className="w-[70px] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">SL</th>{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <th key={lab.code} className="px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">{lab.code}</th>)}<th className="w-[150px] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Vị trí hiện tại</th><th className="w-[150px] px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500">Trạng thái lô</th></tr></thead><tbody>{visibleLots.length === 0 ? <tr><td colSpan={PCN_SAMPLE_LAB_OPTIONS.length + 5} className="p-10 text-center text-[11px] text-slate-400">Chưa có lô mẫu phù hợp.</td></tr> : visibleLots.map((lot) => { const dossier = dossiers.find((item) => item.id === lot.dossierId); const proposal = proposals.find((item) => item.id === dossier?.proposalId); const customerSnapshot = dossier ? getPcnDossierCustomerSnapshot(dossier, proposal) : undefined; const routes = routesByLot.get(lot.id) || []; const items = sampleItems.filter((item) => item.sampleLotId === lot.id); const routeFor = (code: PcnSampleLabCode) => routes.find((route) => route.labCode === code); return <tr key={lot.id} className="border-b border-slate-100 align-top last:border-0"><td className="px-3 py-3"><div className="flex items-center gap-1.5"><Boxes size={14} className="text-emerald-600" /><span className="font-mono text-xs font-black text-slate-800">{lot.lotCode}</span></div><div className="mt-1 text-[10px] font-bold text-slate-600">{dossier?.dossierCode || lot.dossierId}</div><div className="text-[9px] text-slate-400">{proposal?.proposalCode || 'Đề nghị'} • {customerSnapshot?.name || 'Chưa có khách hàng'}</div></td><td className="px-3 py-3"><div className="text-[11px] font-bold text-slate-700">{items.length > 0 ? items.map((item) => <span key={item.id} className="mr-1 inline-flex rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-indigo-700">{item.sampleCode} · {item.sampleType} · {item.model} · SL {item.quantity}</span>) : lot.sampleName}</div><div className="text-[10px] text-slate-400">{lot.brand || '—'}{lot.model ? ` • ${lot.model}` : ''}</div>{lot.qc20Snapshot && <div className="mt-1 text-[9px] text-amber-700">{lot.qc20Snapshot.grade} · {lot.qc20Snapshot.nominalDimensions} · {lot.qc20Snapshot.manufacturerLotCode}</div>}<div className="mt-1 flex flex-wrap gap-1">{lot.fieldCodes.map((code) => <span key={code} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">{code}</span>)}</div></td><td className="px-3 py-3 text-center"><span className="text-sm font-black text-slate-700">{lot.quantity}</span><span className="block text-[9px] text-slate-400">{lot.unit || 'mẫu'}</span></td>{PCN_SAMPLE_LAB_OPTIONS.map((lab) => <td key={lab.code} className="px-3 py-3"><RouteCell route={routeFor(lab.code)} editable={editable} busyRouteId={busyRouteId} onAdvance={(route, status) => void advanceRoute(route, status)} onOpenHandover={onOpenHandover} /></td>)}<td className="px-3 py-3"><div className="flex items-start gap-1.5 text-[10px] font-bold text-slate-600"><MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />{lot.currentLocation}</div><div className="mt-1 text-[9px] text-slate-400">Cập nhật: {formatDate(lot.updatedAt)}</div></td><td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${LOT_STATUS_CLASSES[lot.status]}`}>{LOT_STATUS_LABELS[lot.status]}</span><div className="mt-2 text-[9px] text-slate-400">{routes.length}/{PCN_SAMPLE_LAB_OPTIONS.length} tuyến</div></td></tr>; })}</tbody></table></div>
    {onOpenHandover && <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-2"><div className="text-[10px] font-black text-indigo-800">Mở nhanh biên bản theo tuyến</div><div className="mt-1.5 flex flex-wrap gap-1.5">{visibleLots.flatMap((lot) => (routesByLot.get(lot.id) || []).map((route) => <button key={route.id} type="button" onClick={() => onOpenHandover(route.id)} className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[9px] font-bold text-indigo-700 hover:bg-indigo-100">{lot.lotCode} · {route.labName}</button>))}</div></div>}
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-500"><ClipboardList size={13} className="text-emerald-600" />Mỗi dòng là một lô; mỗi cell là trạng thái hiện tại của một tuyến phòng thử.<span className="mx-1 text-slate-300">•</span><Send size={13} className="text-blue-600" />Không có lịch thử; chỉ có luân chuyển và nhận trả mẫu.</div>
  </div>;
}

export default PcnSampleFlowView;
