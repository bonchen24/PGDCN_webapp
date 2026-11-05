'use client';

import React, { useState } from 'react';
import { ArrowRight, FileText, FlaskConical, MapPin, Package, Save, X } from 'lucide-react';
import { toast } from 'sonner';

import type { OutboundLabRequest, PcnSampleHandoverDetails, PcnSampleLabCode, PcnSampleLot, PcnSampleRoute } from '../types';
import { PCN_SAMPLE_LAB_OPTIONS } from '../types';
import { buildPcnSampleHandoverDetails, type PcnSampleHandoverDetailsDraft } from '../utils/pcnHandoverPolicy';
import { formatDateTimeDdMmYyyy } from '../utils/formatter';
import { PgdcnDateTimeInput } from './PgdcnDateInput';

function labName(code: PcnSampleLabCode): string {
  return PCN_SAMPLE_LAB_OPTIONS.find((item) => item.code === code)?.name || code;
}
function dateTime(value?: string): string {
  return formatDateTimeDdMmYyyy(value) || 'Chưa cập nhật';
}
function toLocalDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function toUtcDateTime(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
function Value({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><div className="text-[11px] font-black uppercase tracking-wide text-slate-600">{label}</div><div className="mt-1 text-[11px] font-bold text-slate-700">{value || 'Chưa cập nhật'}</div></div>;
}

type HandoverFormState = {
  senderName: string;
  senderUnit: string;
  receiverName: string;
  receiverUnit: string;
  handoverAt: string;
  receivedAt: string;
  location: string;
  vehicle: string;
  driver: string;
  quantity: string;
  sampleCodes: string;
  note: string;
};

function getInitialForm(lot: PcnSampleLot, route: PcnSampleRoute, request?: OutboundLabRequest): HandoverFormState {
  const saved = request?.handoverDetails;
  return {
    senderName: saved?.senderName || '',
    senderUnit: saved?.senderUnit || 'Phòng Chứng nhận',
    receiverName: saved?.receiverName || '',
    receiverUnit: saved?.receiverUnit || route.labName,
    handoverAt: toLocalDateTime(saved?.handoverAt || route.sentAt || request?.handoverAt),
    receivedAt: toLocalDateTime(saved?.receivedAt || route.receivedAt || request?.receivedAt),
    location: saved?.location || lot.currentLocation || 'Kho PCN',
    vehicle: saved?.vehicle || '',
    driver: saved?.driver || '',
    quantity: String(saved?.quantity || lot.quantity || 1),
    sampleCodes: (saved?.sampleCodes || [lot.lotCode]).join('\n'),
    note: saved?.note || route.note || request?.handoverNote || lot.notes || '',
  };
}

function Input({ label, value, onChange, required = false, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-600">{label}{required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>{type === 'datetime-local' ? <PgdcnDateTimeInput required={required} value={value} onChange={onChange} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400" /> : <input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400" />}</label>;
}

export function PcnSampleHandoverModal({ lot, route, request, canEdit, onSaveHandover, onOpenDocuments, onClose }: { lot: PcnSampleLot; route: PcnSampleRoute; request?: OutboundLabRequest; canEdit?: boolean; onSaveHandover?: (details: PcnSampleHandoverDetails) => Promise<void>; onOpenDocuments: (kind: 'SAMPLE_HANDOVER' | 'SAMPLE_RETURN', routeId: string) => void; onClose: () => void }) {
  const [form, setForm] = useState<HandoverFormState>(() => getInitialForm(lot, route, request));
  const [saving, setSaving] = useState(false);
  const update = (key: keyof HandoverFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEdit || !onSaveHandover || !request) return;
    setSaving(true);
    try {
      const draft: PcnSampleHandoverDetailsDraft = {
        ...form,
        handoverAt: toUtcDateTime(form.handoverAt),
        receivedAt: toUtcDateTime(form.receivedAt),
        quantity: Number(form.quantity),
        sampleCodes: form.sampleCodes.split(/[\n,;]+/).map((code) => code.trim()).filter(Boolean),
      };
      await onSaveHandover(buildPcnSampleHandoverDetails(draft));
      toast.success('Đã lưu thông tin biên bản giao nhận mẫu.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu biên bản giao nhận mẫu.');
    } finally {
      setSaving(false);
    }
  };
  const trace = request?.handoverDetails;
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="presentation">
      <section className="flex min-h-0 max-h-[92dvh] [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-indigo-600 w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="pcn-sample-handover-title">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><div className="flex flex-wrap items-center gap-2"><Package size={16} className="text-blue-600" /><h2 id="pcn-sample-handover-title" className="text-sm font-black text-slate-900">Chi tiết giao nhận mẫu</h2><span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-black text-blue-700">{lot.lotCode}</span></div><p className="mt-1 text-[11px] text-slate-500">Mẫu được quản lý theo lô và tuyến phòng thử; không có lịch thử trong PCN.</p></div><button type="button" onClick={onClose} aria-label="Đóng chi tiết giao nhận mẫu" className="min-h-11 min-w-11 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button></header>
        <main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto p-3 md:p-4"><div className="grid gap-2 sm:grid-cols-2"><Value label="Tên mẫu" value={lot.sampleName} /><Value label="Kiểu loại / nhãn hiệu" value={[lot.model, lot.brand].filter(Boolean).join(' • ')} /><Value label="Số lượng theo lô" value={`${lot.quantity} ${lot.unit || 'mẫu'}`} /><Value label="Địa điểm hiện tại" value={<span className="inline-flex items-center gap-1.5"><MapPin size={12} className="text-blue-600" />{lot.currentLocation}</span>} /><Value label="Phòng thử nhận" value={<span className="inline-flex items-center gap-1.5"><FlaskConical size={12} className="text-indigo-600" />{labName(route.labCode)}</span>} /><Value label="Trạng thái tuyến" value={route.status} /><Value label="PYC liên kết" value={request?.pycNumber || 'Chưa tạo PYC'} /><Value label="Mã tuyến" value={route.id} /></div>
          {trace && <div className="mt-3 grid gap-2 sm:grid-cols-2"><Value label="Người giao đã lưu" value={`${trace.senderName}${trace.senderUnit ? ` · ${trace.senderUnit}` : ''}`} /><Value label="Người nhận đã lưu" value={`${trace.receiverName}${trace.receiverUnit ? ` · ${trace.receiverUnit}` : ''}`} /><Value label="Phương tiện / lái xe" value={[trace.vehicle, trace.driver].filter(Boolean).join(' · ')} /><Value label="Mã mẫu đã lưu" value={trace.sampleCodes.join(', ')} /></div>}
          <form onSubmit={save} className="mt-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xs font-black text-slate-900">Thông tin biên bản giao nhận</h3><p className="mt-1 text-[11px] text-slate-600">Ghi nhận trước khi sinh văn bản; dữ liệu được lưu vào bản chụp PYC và dùng chung cho DOCX/PDF.</p></div>{!request && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">Cần tạo PYC trước</span>}</div><div className="mt-3 grid gap-2 md:grid-cols-2"><Input label="Người giao mẫu" required value={form.senderName} onChange={(value) => update('senderName', value)} /><Input label="Đơn vị người giao" value={form.senderUnit} onChange={(value) => update('senderUnit', value)} /><Input label="Người nhận mẫu" required value={form.receiverName} onChange={(value) => update('receiverName', value)} /><Input label="Đơn vị/phòng thử nhận" value={form.receiverUnit} onChange={(value) => update('receiverUnit', value)} /><Input label="Thời điểm bàn giao" required type="datetime-local" value={form.handoverAt} onChange={(value) => update('handoverAt', value)} /><Input label="Thời điểm PTN nhận" type="datetime-local" value={form.receivedAt} onChange={(value) => update('receivedAt', value)} /><Input label="Địa điểm bàn giao" required value={form.location} onChange={(value) => update('location', value)} /><Input label="Phương tiện" value={form.vehicle} onChange={(value) => update('vehicle', value)} /><Input label="Lái xe" value={form.driver} onChange={(value) => update('driver', value)} /><Input label="Số lượng giao nhận" required type="number" value={form.quantity} onChange={(value) => update('quantity', value)} /></div><label className="mt-2 block"><span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-600">Mã mẫu / mã hóa theo lô *</span><textarea required rows={2} value={form.sampleCodes} onChange={(event) => update('sampleCodes', event.target.value)} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400" /></label><label className="mt-2 block"><span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-600">Ghi chú</span><textarea rows={2} value={form.note} onChange={(event) => update('note', event.target.value)} className="min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400" /></label><div className="mt-2 flex justify-end">{canEdit && onSaveHandover && request ? <button type="submit" disabled={saving} aria-busy={saving} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-indigo-700 disabled:opacity-50"><Save size={13} />{saving ? 'Đang lưu…' : 'Lưu biên bản'}</button> : <span className="text-[11px] font-bold text-slate-500">Chỉ người có quyền xử lý hồ sơ và PYC đã tạo mới có thể lưu.</span>}</div></form>
          <div className="mt-3 grid gap-2 sm:grid-cols-4"><Value label="Thời điểm gửi" value={dateTime(route.sentAt || request?.handoverAt)} /><Value label="PTN nhận" value={dateTime(route.receivedAt || request?.receivedAt)} /><Value label="Trả KQ" value={dateTime(route.resultReturnedAt)} /><Value label="Mẫu về PCN" value={dateTime(route.returnedAt)} /></div><div className="mt-3 rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center gap-2 text-xs font-black text-slate-800"><ArrowRight size={14} className="text-emerald-600" /> Ghi chú luân chuyển</div><p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-slate-600">{route.note || request?.handoverNote || lot.notes || 'Chưa có ghi chú giao nhận.'}</p></div></main>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3"><button type="button" onClick={() => onOpenDocuments('SAMPLE_HANDOVER', route.id)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-100"><FileText size={13} /> Sinh biên bản giao nhận</button>{['RETURNED_TO_PCN', 'CLOSED'].includes(route.status) && <button type="button" onClick={() => onOpenDocuments('SAMPLE_RETURN', route.id)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100"><FileText size={13} /> Sinh biên bản trả mẫu</button>}<button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-black text-slate-700 hover:bg-slate-50">Đóng</button></footer>
      </section>
    </div>
  );
}

export default PcnSampleHandoverModal;
