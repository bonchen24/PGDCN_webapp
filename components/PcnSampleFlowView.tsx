'use client';

import { formatDateDdMmYyyy } from '../utils/formatter';

import React, { useMemo, useState } from 'react';
import { ArrowRight, Boxes, ChevronDown, ChevronsDownUp, ChevronsUpDown, ClipboardList, MapPin, Plus, Search, Send, X } from 'lucide-react';
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
  PcnSampleExecutionStatus,
  UserAccount,
} from '../types';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { derivePcnSampleLotStatus, getNextPcnSampleRouteStatuses, getPcnSampleLabCodesForFields, getPcnSampleRouteSnapshotForItem, getPcnSampleRouteStartDenial, isPcnSampleRouteAssignedToItem } from '../utils/pcnSampleFlow';
import type { PcnSampleLotDraft, PcnSampleRouteUpdate } from '../utils/pcnSampleFlow';
import PcnCatalogCombobox from './PcnCatalogCombobox';

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
  return formatDateDdMmYyyy(value) || '—';
}
function canEditSamples(user: UserAccount | null): boolean {
  return user?.systemRole === 'admin' || user?.systemRole === 'staff' || user?.role === 'admin' || user?.role === 'staff';
}
function labName(code: PcnSampleLabCode): string {
  return PCN_SAMPLE_LAB_OPTIONS.find((item) => item.code === code)?.name || code;
}
function RequiredMarker() {
  return <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>;
}
function TestAssignment({ label, options, selected, onToggle }: { label: string; options: Array<{ code: PcnSampleLabCode; name: string }>; selected: PcnSampleLabCode[]; onToggle: (code: PcnSampleLabCode, checked: boolean) => void }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[11px] font-black text-slate-700">{label}</div><div className="mt-1.5 flex flex-wrap gap-1.5">{options.map((lab) => <label key={lab.code} className={`mobile-touch-target min-h-11 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${selected.includes(lab.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={selected.includes(lab.code)} onChange={(event) => onToggle(lab.code, event.target.checked)} />{lab.name}</label>)}</div>{selected.length === 0 && <p className="mt-1 text-[11px] font-bold text-rose-700">Chưa gán phép thử</p>}</div>;
}
function nextActionLabel(status: PcnSampleRouteStatus): string {
  return status === 'SENT' ? 'Gửi mẫu' : status === 'RECEIVED' ? 'Xác nhận nhận' : status === 'RESULT_RETURNED' ? 'Ghi nhận KQ' : status === 'RETURNED_TO_PCN' ? 'Nhận mẫu về PCN' : status === 'CLOSED' ? 'Đóng tuyến' : 'Cập nhật';
}

function executionLabel(status?: PcnSampleExecutionStatus): string {
  return status === 'SCHEDULED' ? 'Đã lên lịch' : status === 'IN_PROGRESS' ? 'Đang thử' : status === 'COMPLETED' ? 'Đã hoàn tất' : status === 'BLOCKED' ? 'Bị chặn' : status === 'CANCELLED' ? 'Đã hủy' : 'Chưa lên lịch';
}

function canStartRouteForLot(route: PcnSampleRoute, lotRoutes: PcnSampleRoute[], sampleItems: PcnSampleItem[]): boolean {
  return !getPcnSampleRouteStartDenial(route, lotRoutes, sampleItems);
}

type PcnSampleForm = {
  dossierId: string; sampleName: string; model: string; brand: string; quantity: string; unit: string;
  sampleItems: Array<{ sampleCode: string; sampleType: string; model: string; brand: string; quantity: string; unit: string; testLabCodes: PcnSampleLabCode[] }>;
  testLabCodes: PcnSampleLabCode[];
  fieldCodes: string[]; labCodes: PcnSampleLabCode[];
  notes: string;
};
function emptyPcnSampleForm(): PcnSampleForm {
  return { dossierId: '', sampleName: '', model: '', brand: '', quantity: '1', unit: 'mẫu', sampleItems: [], testLabCodes: [], fieldCodes: [], labCodes: [], notes: '' };
}

function RouteCell({ route, editable, busyRouteId, canStart = true, onAdvance, onOpenHandover }: { route?: PcnSampleRoute; editable: boolean; busyRouteId?: string; canStart?: boolean; onAdvance: (route: PcnSampleRoute, status: PcnSampleRouteStatus, update?: PcnSampleRouteUpdate) => void; onOpenHandover?: (routeId: string) => void }) {
  if (!route) return <div className="min-w-[150px] rounded-lg border border-dashed border-slate-200 p-2 text-[11px] text-slate-500">Chưa đăng ký tuyến</div>;
  const nextStatus = getNextPcnSampleRouteStatuses(route.status).find((status) => status !== 'CANCELLED');
  const timestamp = route.status === 'SENT' ? route.sentAt : route.status === 'RECEIVED' ? route.receivedAt : route.status === 'RESULT_RETURNED' ? route.resultReturnedAt : route.returnedAt;
  const isBusy = busyRouteId === route.id;
  const blockedBySequence = route.status === 'PENDING' && !canStart;
  return <div className="min-w-[150px] rounded-lg border border-slate-200 bg-white p-2"><span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black ${ROUTE_STATUS_CLASSES[route.status]}`}>{ROUTE_STATUS_LABELS[route.status]}</span><div className="mt-1 text-[9px] text-slate-400">{formatDate(timestamp)}</div>{route.labRequestId && <div className="mt-1 truncate font-mono text-[9px] text-slate-500">PYC: {route.labRequestId}</div>}{route.execution && <div className="mt-1 text-[9px] font-bold text-indigo-700">{executionLabel(route.execution.status)}{route.execution.scheduledDate ? ` · Lịch ${formatDate(route.execution.scheduledDate)}` : ''}{route.execution.outcome && route.execution.outcome !== 'PENDING' ? ` · ${route.execution.outcome}` : ''}</div>}{blockedBySequence && <div className="mt-1 text-[11px] font-bold text-amber-700">Chờ chặng trước kết thúc</div>}<div className="mt-2 flex flex-wrap gap-1">{onOpenHandover && <button type="button" onClick={() => onOpenHandover(route.id)} className="mobile-touch-target min-h-11 rounded-md border border-indigo-200 bg-indigo-50 px-2 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100">Chi tiết / biên bản</button>}{editable && nextStatus && <button type="button" onClick={() => onAdvance(route, nextStatus)} disabled={isBusy || blockedBySequence} aria-busy={isBusy} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"><ArrowRight size={10} />{isBusy ? 'Đang lưu...' : blockedBySequence ? 'Chờ chặng trước' : nextActionLabel(nextStatus)}</button>}</div></div>;
}

export function PcnSampleFlowView({ sampleLots, sampleItems = [], sampleRoutes, dossiers, proposals, fields, currentUser, initialDossierId, canEdit = true, onCreate, onRouteStatusChange, onOpenHandover }: { sampleLots: PcnSampleLot[]; sampleItems?: PcnSampleItem[]; sampleRoutes: PcnSampleRoute[]; dossiers: CertificationDossier[]; proposals: CertificationProposal[]; fields: PcnCertificationField[]; currentUser: UserAccount | null; initialDossierId?: string; canEdit?: boolean; onCreate: (draft: PcnSampleLotDraft) => Promise<void>; onRouteStatusChange: (routeId: string, status: PcnSampleRouteStatus, update?: PcnSampleRouteUpdate) => Promise<void>; onOpenHandover?: (routeId: string) => void }) {
  const [query, setQuery] = useState('');
  const [expandedLotIds, setExpandedLotIds] = useState<Set<string>>(new Set());
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRouteId, setBusyRouteId] = useState<string>();
  const [form, setForm] = useState<PcnSampleForm>(emptyPcnSampleForm());
  const editable = canEdit && canEditSamples(currentUser);
  const selectedDossier = dossiers.find((item) => item.id === form.dossierId);
  const availableFields = selectedDossier ? fields.filter((field) => selectedDossier.fieldCodes.includes(field.code)) : [];
  const availableLabOptions = PCN_SAMPLE_LAB_OPTIONS.filter((lab) => getPcnSampleLabCodesForFields(form.fieldCodes).includes(lab.code));
  const dossierOptions = dossiers.map((dossier) => {
    const customerName = getPcnDossierCustomerSnapshot(dossier, proposals.find((proposal) => proposal.id === dossier.proposalId))?.name;
    return {
      value: dossier.id,
      label: `${dossier.dossierCode} — ${customerName || 'Chưa có khách hàng'}`,
      searchText: [dossier.id, dossier.dossierCode, customerName, dossier.proposalId].filter(Boolean).join(' '),
    };
  });
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

  const toggleLot = (lotId: string) => setExpandedLotIds((previous) => {
    const next = new Set(previous);
    if (next.has(lotId)) next.delete(lotId); else next.add(lotId);
    return next;
  });
  const expandVisibleLots = () => setExpandedLotIds((previous) => new Set([...previous, ...visibleLots.map((lot) => lot.id)]));
  const collapseVisibleLots = () => setExpandedLotIds((previous) => {
    const next = new Set(previous);
    for (const lot of visibleLots) next.delete(lot.id);
    return next;
  });

  const resetForm = () => { setForm(emptyPcnSampleForm()); setOpenForm(false); };
  const selectDossier = (dossierId: string) => {
    const dossier = dossiers.find((item) => item.id === dossierId);
    setForm((previous) => {
      const fieldCodes = dossier?.fieldCodes || previous.fieldCodes;
      const availableCodes = getPcnSampleLabCodesForFields(fieldCodes);
      return { ...previous, dossierId, fieldCodes: dossier?.fieldCodes || previous.fieldCodes, labCodes: [], testLabCodes: previous.testLabCodes.filter((code) => availableCodes.includes(code)), sampleItems: previous.sampleItems.map((item) => ({ ...item, testLabCodes: item.testLabCodes.filter((code) => availableCodes.includes(code)) })) };
    });
  };
  const toggleField = (code: string, checked: boolean) => {
    setForm((previous) => {
      const fieldCodes = checked ? [...new Set([...previous.fieldCodes, code])] : previous.fieldCodes.filter((item) => item !== code);
      const allowed = getPcnSampleLabCodesForFields(fieldCodes);
      return { ...previous, fieldCodes, labCodes: previous.labCodes.filter((item) => allowed.includes(item)), testLabCodes: previous.testLabCodes.filter((item) => allowed.includes(item)), sampleItems: previous.sampleItems.map((item) => ({ ...item, testLabCodes: item.testLabCodes.filter((itemCode) => allowed.includes(itemCode)) })) };
    });
  };
  const addSampleItem = () => setForm((previous) => ({
    ...previous,
    sampleItems: [...previous.sampleItems, { sampleCode: '', sampleType: '', model: '', brand: previous.brand, quantity: '1', unit: previous.unit, testLabCodes: [] }],
  }));
  const updateSampleItem = (index: number, updates: Partial<PcnSampleForm['sampleItems'][number]>) => setForm((previous) => ({
    ...previous,
    sampleItems: previous.sampleItems.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item),
  }));
  const removeSampleItem = (index: number) => setForm((previous) => ({ ...previous, sampleItems: previous.sampleItems.filter((_, itemIndex) => itemIndex !== index) }));
  const togglePrimaryTest = (code: PcnSampleLabCode, checked: boolean) => setForm((previous) => ({ ...previous, testLabCodes: checked ? [...new Set([...previous.testLabCodes, code])] : previous.testLabCodes.filter((item) => item !== code) }));
  const toggleSampleItemTest = (index: number, code: PcnSampleLabCode, checked: boolean) => setForm((previous) => ({ ...previous, sampleItems: previous.sampleItems.map((item, itemIndex) => itemIndex === index ? { ...item, testLabCodes: checked ? [...new Set([...item.testLabCodes, code])] : item.testLabCodes.filter((itemCode) => itemCode !== code) } : item) }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.dossierId || !form.sampleName.trim() || form.fieldCodes.length === 0 || form.testLabCodes.length === 0 || form.sampleItems.some((item) => !item.sampleType.trim() || !item.model.trim() || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 || item.testLabCodes.length === 0)) {
      toast.error('Vui lòng chọn hồ sơ, nhập đủ mẫu/model, số lượng hợp lệ và gán phép thử cho từng mẫu.');
      return;
    }
    setSaving(true);
    try {
      const labCodes = [...new Set([ ...form.testLabCodes, ...form.sampleItems.flatMap((item) => item.testLabCodes) ])];
      await onCreate({ id: makeId(), dossierId: form.dossierId, sampleName: form.sampleName, model: form.model, brand: form.brand, quantity: Number(form.quantity), unit: form.unit, sampleItems: [{ sampleCode: '', sampleType: form.sampleName, model: form.model, brand: form.brand, quantity: Number(form.quantity), unit: form.unit, testLabCodes: form.testLabCodes }, ...form.sampleItems.map((item) => ({ ...item, quantity: Number(item.quantity) }))], fieldCodes: form.fieldCodes, labCodes, notes: form.notes });
      toast.success('Đã tạo lô mẫu; mã hóa lô được cấp tự động.');
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

  return <div data-testid="pcn-sample-flow-surface" className="pcn-page-surface min-w-0 bg-slate-50/60 p-3 pb-20 md:p-5 [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-emerald-500">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Phòng Chứng nhận (PCN)</p><h1 className="mt-1 text-xl font-black text-slate-900">Phiếu yêu cầu & Luân chuyển mẫu nội bộ</h1><p className="mt-1 text-[11px] text-slate-500">Theo dõi từng mẫu thử trong một lô và chỉ hiển thị các phép thử đã gán cho mẫu đó. PYC trên trang này chỉ gửi các phòng thử nội bộ thuộc Trung tâm TVCI.</p>{initialDossierId && <p className="mt-1 text-[10px] font-bold text-indigo-700">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</p>}</div>{editable && !openForm && <button type="button" onClick={() => { if (initialDossierId) selectDossier(initialDossierId); setOpenForm(true); }} className="mobile-touch-target inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-sm hover:bg-emerald-500"><Plus size={14} /> Tạo lô mẫu</button>}</div>
    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"><div className="pgdcn-kpi-card"><div className="min-w-0"><div className="truncate text-[11px] font-black uppercase text-slate-400">Tổng lô mẫu</div><div className="mt-0.5 text-lg font-black leading-5 text-slate-800">{stats.lots}</div></div></div><div className="pgdcn-kpi-card"><div className="min-w-0"><div className="truncate text-[11px] font-black uppercase text-slate-400">Đang luân chuyển</div><div className="mt-0.5 text-lg font-black leading-5 text-blue-700">{stats.moving}</div></div></div><div className="pgdcn-kpi-card"><div className="min-w-0"><div className="truncate text-[11px] font-black uppercase text-slate-400">Chờ KQTN</div><div className="mt-0.5 text-lg font-black leading-5 text-amber-700">{stats.waitingResults}</div></div></div><div className="pgdcn-kpi-card"><div className="min-w-0"><div className="truncate text-[11px] font-black uppercase text-slate-400">Có vấn đề</div><div className="mt-0.5 text-lg font-black leading-5 text-rose-700">{stats.issues}</div></div></div></div>
    {editable && openForm && <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm md:p-4"><div className="flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-800">Tạo lô mẫu PCN</h2><p className="mt-0.5 text-[11px] text-slate-500">Một lô có thể đi nhiều phòng thử; mỗi tuyến hiển thị thành một cell riêng.</p></div><button type="button" onClick={resetForm} disabled={saving} aria-label="Đóng biểu mẫu tạo lô mẫu" className="mobile-touch-target min-h-11 min-w-11 text-slate-400 disabled:opacity-40"><X size={16} /></button></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Hồ sơ chứng nhận <RequiredMarker /></span><PcnCatalogCombobox id="pcn-sample-flow-dossier" label="Hồ sơ chứng nhận" hideLabel required value={form.dossierId} onChange={selectDossier} options={dossierOptions} /></label><div className="rounded-md border border-indigo-100 bg-indigo-50/60 px-2.5 py-1.5"><div className="text-[11px] font-black text-indigo-900">Mã hóa lô</div><p className="mt-0.5 text-[11px] font-bold text-indigo-700">Server tự cấp theo dạng CN TTTT-YY khi lưu</p></div><label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Số lượng mẫu <RequiredMarker /></span><input required type="number" min="1" aria-label="Số lượng mẫu" className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Loại mẫu/kiểu loại đầu tiên <RequiredMarker /></span><input required className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.sampleName} onChange={(event) => setForm({ ...form, sampleName: event.target.value })} /></label><label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Kiểu loại đầu tiên <RequiredMarker /></span><input required className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label><label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Nhãn hiệu</span><input className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></label></div>
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3"><div className="flex items-center justify-between gap-2"><div><div className="text-[11px] font-black text-indigo-900">Mẫu/kiểu loại bổ sung trong cùng lô</div><p className="mt-0.5 text-[11px] text-indigo-700">Mỗi dòng là một mẫu riêng; PYC vẫn được tạo theo toàn bộ lô.</p></div><button type="button" onClick={addSampleItem} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-black text-indigo-700"><Plus size={11} /> Thêm mẫu/kiểu loại</button></div>{form.sampleItems.length > 0 && <div className="mt-2 space-y-2">{form.sampleItems.map((item, index) => <div key={`${index}-${item.sampleCode}`} className="rounded-md border border-indigo-100 bg-white p-2"><div className="mb-1.5 grid gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_6rem_auto]"><span>Mã mẫu</span><span>Loại mẫu <RequiredMarker /></span><span>Kiểu loại <RequiredMarker /></span><span>Số lượng <RequiredMarker /></span><span>Đơn vị</span><span /></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_6rem_6rem_auto]"><input aria-label={`Mã mẫu bổ sung ${index + 1}`} value={item.sampleCode} onChange={(event) => updateSampleItem(index, { sampleCode: event.target.value })} className="mobile-touch-target min-h-11 rounded border border-slate-200 px-2 py-1 text-[11px]" /><input required aria-required="true" aria-label={`Loại mẫu bổ sung ${index + 1}`} value={item.sampleType} onChange={(event) => updateSampleItem(index, { sampleType: event.target.value })} className="mobile-touch-target min-h-11 rounded border border-slate-200 px-2 py-1 text-[11px]" /><input required aria-required="true" aria-label={`Kiểu loại bổ sung ${index + 1}`} value={item.model} onChange={(event) => updateSampleItem(index, { model: event.target.value })} className="mobile-touch-target min-h-11 rounded border border-slate-200 px-2 py-1 text-[11px]" /><input required aria-required="true" aria-label={`Số lượng bổ sung ${index + 1}`} type="number" min="1" value={item.quantity} onChange={(event) => updateSampleItem(index, { quantity: event.target.value })} className="mobile-touch-target min-h-11 rounded border border-slate-200 px-2 py-1 text-[11px]" /><input aria-label={`Đơn vị bổ sung ${index + 1}`} value={item.unit} onChange={(event) => updateSampleItem(index, { unit: event.target.value })} className="mobile-touch-target min-h-11 rounded border border-slate-200 px-2 py-1 text-[11px]" /><button type="button" onClick={() => removeSampleItem(index)} aria-label={`Xóa mẫu bổ sung ${index + 1}`} className="mobile-touch-target min-h-11 rounded border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-700">Xóa</button><div className="sm:col-span-2 lg:col-span-6"><TestAssignment label={`Phép thử cho ${item.sampleCode || `mẫu bổ sung ${index + 1}`}`} options={availableLabOptions} selected={item.testLabCodes} onToggle={(code, checked) => toggleSampleItemTest(index, code, checked)} /></div></div></div>)}</div>}</div>
      <div aria-required="true"><div className="mb-1.5 text-[11px] font-black text-slate-500">Phép thử gán cho từng mẫu <RequiredMarker /></div><p className="mb-1.5 text-[11px] text-slate-500">Mã mẫu vật lý do hệ thống tạo mặc định theo mã lô; tại đây chọn đúng phép thử nội bộ cho từng mẫu. Kiểu loại có số lượng lớn hơn 1 chạy song song; kiểu loại chỉ có 1 mẫu chạy luân phiên theo chặng.</p>{availableLabOptions.length === 0 ? <p className="text-[11px] text-slate-500">Chọn Lĩnh vực để hiển thị các phép thử nội bộ phù hợp.</p> : <div className="space-y-2"><TestAssignment label="Mẫu chính · mã mẫu cấp khi lưu" options={availableLabOptions} selected={form.testLabCodes} onToggle={togglePrimaryTest} />{form.sampleItems.map((item, index) => <TestAssignment key={`${index}-${item.sampleCode}`} label={`${item.sampleCode || `Mẫu bổ sung ${index + 1}`} · ${item.model || 'chưa có kiểu loại'}`} options={availableLabOptions} selected={item.testLabCodes} onToggle={(code, checked) => toggleSampleItemTest(index, code, checked)} />)}</div>}</div>
      <div role="group" aria-required="true"><div className="mb-1.5 text-[11px] font-black text-slate-500">Lĩnh vực liên quan <RequiredMarker /></div>{!selectedDossier ? <p className="text-[11px] text-slate-500">Chọn hồ sơ trước để hiển thị các Lĩnh vực được phép.</p> : availableFields.length === 0 ? <p className="text-[11px] text-amber-700">Hồ sơ chưa có Lĩnh vực để gắn lô mẫu.</p> : <div className="flex flex-wrap gap-2">{availableFields.map((field) => <label key={field.code} className={`mobile-touch-target min-h-11 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${form.fieldCodes.includes(field.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={form.fieldCodes.includes(field.code)} onChange={(event) => toggleField(field.code, event.target.checked)} />{field.name}</label>)}</div>}</div>
      <label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">Ghi chú</span><textarea rows={2} className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="flex justify-end gap-2"><button type="button" onClick={resetForm} disabled={saving} className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 disabled:opacity-40">Hủy</button><button type="submit" disabled={saving} className="mobile-touch-target min-h-11 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Tạo lô và tuyến'}</button></div>
    </form>}
    <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Search size={14} className="shrink-0 text-slate-400" />
        <input className="mobile-touch-target min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        <button type="button" onClick={expandVisibleLots} disabled={visibleLots.length === 0} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-black text-slate-600 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronsDownUp size={13} /> Mở tất cả</button>
        <button type="button" onClick={collapseVisibleLots} disabled={visibleLots.length === 0} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-black text-slate-600 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><ChevronsUpDown size={13} /> Thu gọn tất cả</button>
      </div>
    </div>
    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[980px] w-full border-collapse text-left">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="w-[220px] px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Lô mẫu / hồ sơ</th>
            <th className="w-[210px] px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Mẫu / model</th>
            <th className="w-[70px] px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">SL</th>
            <th className="px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Luồng phép thử đã gán</th>
            <th className="w-[150px] px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Vị trí hiện tại</th>
            <th className="w-[150px] px-3 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-500">Trạng thái lô</th>
          </tr>
        </thead>
        <tbody>
          {visibleLots.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-[11px] text-slate-400">Chưa có lô mẫu phù hợp.</td></tr> : visibleLots.map((lot) => {
            const dossier = dossiers.find((item) => item.id === lot.dossierId);
            const proposal = proposals.find((item) => item.id === dossier?.proposalId);
            const customerSnapshot = dossier ? getPcnDossierCustomerSnapshot(dossier, proposal) : undefined;
            const routes = routesByLot.get(lot.id) || [];
            const items = sampleItems.filter((item) => item.sampleLotId === lot.id);
            const itemRouteGroups = items.map((item) => ({ item, routes: routes.filter((route) => isPcnSampleRouteAssignedToItem(route, item.id, item)).map((route) => getPcnSampleRouteSnapshotForItem(route, item.id)) })).filter((group) => group.routes.length > 0);
            const lotProjection = derivePcnSampleLotStatus(routes, items);
            const hasItemSnapshots = routes.some((route) => Object.keys(route.itemSnapshots || {}).length > 0);
            const isExpanded = expandedLotIds.has(lot.id);
            return <tr key={lot.id} className="border-b border-slate-100 align-top last:border-0">
              <td className="px-3 py-3">
                <div className="flex items-center gap-1.5"><Boxes size={14} className="text-emerald-600" /><span className="font-mono text-xs font-black text-slate-800">{lot.lotCode}</span></div>
                <div className="mt-1 text-[11px] font-bold text-slate-600">{dossier?.dossierCode || lot.dossierId}</div>
                <div className="text-[11px] text-slate-500">{proposal?.proposalCode || 'Đề nghị'} • {customerSnapshot?.name || 'Chưa có khách hàng'}</div>
              </td>
              <td className="px-3 py-3">
                <button type="button" onClick={() => toggleLot(lot.id)} aria-expanded={isExpanded} aria-controls={`lot-flow-${lot.id}`} className="flex w-full min-w-0 items-start gap-1.5 text-left">
                  <ChevronDown size={15} className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-bold text-slate-700">{items.length > 0 ? items.map((item) => <span key={item.id} className="mr-1 inline-flex rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-indigo-700">{item.sampleCode} · {item.model} · SL {item.quantity} · {item.quantity > 1 ? 'Song song' : 'Tuần tự'}</span>) : lot.sampleName}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">{lot.brand || '—'}{lot.model ? ` • ${lot.model}` : ''}</span>
                    <span className="mt-1 flex flex-wrap gap-1">{lot.fieldCodes.map((code) => <span key={code} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">{code}</span>)}</span>
                  </span>
                </button>
              </td>
              <td className="px-3 py-3 text-center"><span className="text-sm font-black text-slate-700">{lot.quantity}</span><span className="block text-[9px] text-slate-400">{lot.unit || 'mẫu'}</span></td>
              <td className="px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-slate-600">{routes.length} phép thử đã gán{hasItemSnapshots ? ' · đã đồng bộ mẫu' : ''}</span>
                  <button type="button" onClick={() => toggleLot(lot.id)} aria-expanded={isExpanded} aria-controls={`lot-flow-${lot.id}`} className="mobile-touch-target min-h-11 shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-emerald-700 hover:border-emerald-300">{isExpanded ? 'Thu gọn' : 'Mở luồng'}</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {routes.length === 0 ? <span className="rounded-lg border border-dashed border-slate-200 px-2 py-1 text-[11px] text-slate-500">Chưa gán phép thử</span> : itemRouteGroups.length > 0 ? itemRouteGroups.flatMap(({ item, routes: itemRoutes }) => itemRoutes.map((route) => <span key={`${item.id}-${route.id}`} className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{item.sampleCode} · {route.labName} · {route.labRequestId ? 'Có PYC' : 'Chưa có PYC'}</span>)) : routes.map((route) => <span key={route.id} className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{route.labName} · {route.labRequestId ? 'Có PYC' : 'Chưa có PYC'}</span>)}
                </div>
                <div id={`lot-flow-${lot.id}`} hidden={!isExpanded} className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                  {itemRouteGroups.length > 0 ? itemRouteGroups.map(({ item, routes: itemRoutes }) => <div key={item.id} className="w-full rounded-lg border border-indigo-100 bg-indigo-50/40 p-2"><div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-black text-indigo-800"><span>{item.sampleCode} · {item.model}</span><span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] text-indigo-700">SL {item.quantity} · {item.quantity > 1 ? 'Song song' : 'Luân phiên'}</span></div><div className="flex flex-wrap gap-2">{itemRoutes.map((route) => <RouteCell key={`${item.id}-${route.id}`} route={route} canStart={canStartRouteForLot(route, routes, [item])} editable={editable} busyRouteId={busyRouteId} onAdvance={(nextRoute, status) => void advanceRoute(nextRoute, status)} onOpenHandover={onOpenHandover} />)}</div></div>) : routes.map((route) => <RouteCell key={route.id} route={route} canStart={canStartRouteForLot(route, routes, items)} editable={editable} busyRouteId={busyRouteId} onAdvance={(nextRoute, status) => void advanceRoute(nextRoute, status)} onOpenHandover={onOpenHandover} />)}
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-start gap-1.5 text-[11px] font-bold text-slate-600"><MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />{lotProjection.currentLocation}</div>
                <div className="mt-1 text-[9px] text-slate-400">Cập nhật: {formatDate(lot.updatedAt)}</div>
              </td>
              <td className="px-3 py-3">
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${LOT_STATUS_CLASSES[lotProjection.status]}`}>{LOT_STATUS_LABELS[lotProjection.status]}</span>
                <div className="mt-2 text-[9px] text-slate-400">{routes.length} tuyến đã gán</div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    {onOpenHandover && <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-2"><div className="text-[11px] font-black text-indigo-800">Mở nhanh biên bản theo tuyến</div><div className="mt-1.5 flex flex-wrap gap-1.5">{visibleLots.flatMap((lot) => (routesByLot.get(lot.id) || []).map((route) => <button key={route.id} type="button" onClick={() => onOpenHandover(route.id)} className="mobile-touch-target min-h-11 rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100">{lot.lotCode} · {route.labName}</button>))}</div></div>}
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600"><ClipboardList size={13} className="text-emerald-600" />Kiểu loại có số lượng lớn hơn 1 mới chạy song song; kiểu loại chỉ có 1 mẫu chạy luân phiên theo các chặng đã gán.<span className="mx-1 text-slate-300">•</span><Send size={13} className="text-blue-600" />Lịch thử và kết quả được đồng bộ từ app phòng thử nội bộ.</div>
  </div>;
}

export default PcnSampleFlowView;
