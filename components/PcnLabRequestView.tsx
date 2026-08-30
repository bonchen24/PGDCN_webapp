'use client';

import React, { useState } from 'react';
import { CheckCircle2, FileText, FolderOpen, Plus, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnCertificationField,
  PcnGeneratedDocument,
  PcnSampleLot,
  PcnSampleRoute,
} from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnGeneratedDocumentsForKind } from '../utils/pcnGeneratedDocumentView';
import { buildPcnLabRequest, getNextPcnLabRequestStatuses, getPcnLabFieldSelection } from '../utils/pcnLabRouting';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';

function makeId(): string {
  return `lab-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function formatDate(value?: string): string {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định' : date.toLocaleDateString('vi-VN');
}

function fieldName(fields: PcnCertificationField[], code: string): string {
  return fields.find((field) => field.code === code)?.name || code;
}

function statusLabel(status: OutboundLabRequest['status']): string {
  return status === 'DRAFT'
    ? 'Bản nháp'
    : status === 'SENT'
      ? 'Đã gửi PTN'
      : status === 'RECEIVED'
        ? 'PTN đã nhận'
        : status === 'RESULT_RETURNED'
          ? 'Đã trả KQTN'
          : 'Đã hủy';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black text-slate-500">{label}</span>
      <div className="[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-slate-200 [&_input]:px-2.5 [&_input]:py-1.5 [&_input]:text-[11px] [&_input]:outline-none [&_input]:focus:border-emerald-400 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-slate-200 [&_select]:bg-white [&_select]:px-2.5 [&_select]:py-1.5 [&_select]:text-[11px] [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-slate-200 [&_textarea]:px-2.5 [&_textarea]:py-1.5 [&_textarea]:text-[11px]">
        {children}
      </div>
    </label>
  );
}

function EmptyLabState({ onCreate, canEdit }: { onCreate: () => void; canEdit: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center">
      <Send size={18} className="mx-auto text-slate-400" />
      <p className="mt-2 text-xs font-black text-slate-600">Chưa có PYC gửi PTN</p>
      <p className="mt-1 text-[10px] text-slate-400">Tạo PYC từ hồ sơ khi cần phối hợp với phòng thử nghiệm khác.</p>
      {canEdit ? <button onClick={onCreate} className="mt-3 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white">
        <Plus size={12} /> Tạo PYC
      </button> : <p className="mt-3 text-[10px] font-bold text-slate-500">Tài khoản chỉ được xem dữ liệu PYC.</p>}
    </div>
  );
}

export function PcnLabRequestView({
  fields,
  dossiers,
  proposals,
  requests,
  sampleLots,
  sampleRoutes,
  generatedDocuments,
  initialDossierId,
  canEdit,
  onSave,
  onStatusChange,
  onOpenDossier,
}: {
  fields: PcnCertificationField[];
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  requests: OutboundLabRequest[];
  sampleLots: PcnSampleLot[];
  sampleRoutes: PcnSampleRoute[];
  generatedDocuments: PcnGeneratedDocument[];
  initialDossierId?: string;
  canEdit: boolean;
  onSave: (request: OutboundLabRequest) => Promise<void>;
  onStatusChange: (requestId: string, status: OutboundLabRequest['status'], updates?: Partial<Pick<OutboundLabRequest, 'handoverAt' | 'receivedAt' | 'handoverNote' | 'handoverDocumentId' | 'sampleIssue'>>) => Promise<void>;
  onOpenDossier?: (dossierId: string) => void;
}) {
  const initialDossier = dossiers.find((dossier) => dossier.id === initialDossierId);
  const initialFieldCode = getPcnLabFieldSelection(initialDossier?.fieldCodes || fields.map((field) => field.code));
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string>();
  const [form, setForm] = useState({
    dossierId: initialDossierId || '',
    fieldCode: initialFieldCode,
    laboratoryName: '',
    pycNumber: '',
    targetDate: '',
    criteria: '',
    handoverNote: '',
    sampleLotId: '',
    sampleRouteId: '',
  });
  const selectedDossier = dossiers.find((dossier) => dossier.id === form.dossierId);
  const availableFields = selectedDossier
    ? fields.filter((field) => selectedDossier.fieldCodes.includes(field.code))
    : fields;
  const dossierLots = sampleLots.filter((lot) => lot.dossierId === form.dossierId);
  const lotRoutes = sampleRoutes.filter((route) => route.sampleLotId === form.sampleLotId);
  const visibleRequests = initialDossierId
    ? requests.filter((request) => request.dossierId === initialDossierId)
    : requests;

  const resetForm = () => {
    setForm({
      dossierId: initialDossierId || '',
      fieldCode: initialFieldCode,
      laboratoryName: '',
      pycNumber: '',
      targetDate: '',
      criteria: '',
      handoverNote: '',
      sampleLotId: '',
      sampleRouteId: '',
    });
    setOpenForm(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!canEdit) return;
    if (!form.dossierId || !form.laboratoryName.trim()) {
      toast.error('Vui lòng chọn hồ sơ và nhập phòng thử nghiệm nhận.');
      return;
    }
    setSaving(true);
    try {
      await onSave(buildPcnLabRequest({
        id: makeId(),
        dossierId: form.dossierId,
        fieldCode: form.fieldCode,
        laboratoryName: form.laboratoryName,
        pycNumber: form.pycNumber,
        targetDate: form.targetDate,
        criteria: form.criteria,
        handoverNote: form.handoverNote,
        sampleLotId: form.sampleLotId,
        sampleRouteId: form.sampleRouteId,
      }));
      toast.success('Đã tạo PYC gửi PTN.');
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tạo PYC');
    } finally {
      setSaving(false);
    }
  };

  const moveRequest = async (request: OutboundLabRequest, nextStatus: OutboundLabRequest['status']) => {
    if (!canEdit || busyRequestId === request.id) return;
    setBusyRequestId(request.id);
    try {
      await onStatusChange(request.id, nextStatus);
      toast.success(`Đã cập nhật PYC: ${statusLabel(nextStatus)}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật PYC');
    } finally {
      setBusyRequestId(undefined);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 p-3 pb-20 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">PYC gửi PTN</h1>
          <p className="mt-1 text-[11px] text-slate-500">Chứng từ outbound của PCN, luôn liên kết về hồ sơ và Lĩnh vực.</p>
          {initialDossierId && <p className="mt-2 text-[10px] font-black text-emerald-700">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</p>}
        </div>
        {!openForm && canEdit && (
          <button onClick={() => { setForm((previous) => ({ ...previous, dossierId: initialDossierId || previous.dossierId })); setOpenForm(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white">
            <Plus size={14} /> Tạo PYC
          </button>
        )}
      </div>

      {openForm && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm md:p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800">Thông tin PYC gửi PTN</h2>
            <button type="button" onClick={resetForm} disabled={saving} aria-label="Đóng biểu mẫu PYC" className="text-slate-400 disabled:opacity-40"><X size={16} /></button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <Field label="Hồ sơ chứng nhận *">
              <select value={form.dossierId} onChange={(event) => {
                const dossier = dossiers.find((item) => item.id === event.target.value);
                setForm({ ...form, dossierId: event.target.value, fieldCode: getPcnLabFieldSelection(dossier?.fieldCodes || [], form.fieldCode), sampleLotId: '', sampleRouteId: '' });
              }}>
                <option value="">Chọn hồ sơ</option>
                {dossiers.filter((dossier) => !initialDossierId || dossier.id === initialDossierId).map((dossier) => <option key={dossier.id} value={dossier.id}>{dossier.dossierCode} — {getPcnDossierCustomerSnapshot(dossier, proposals.find((proposal) => proposal.id === dossier.proposalId))?.name || 'Chưa có khách hàng'}</option>)}
              </select>
            </Field>
            <Field label="Lĩnh vực *">
              <select value={form.fieldCode} onChange={(event) => setForm({ ...form, fieldCode: event.target.value })} disabled={!form.dossierId}>
                <option value="">Chọn Lĩnh vực</option>
                {availableFields.map((field) => <option key={field.code} value={field.code}>{field.name}</option>)}
              </select>
            </Field>
            <Field label="Số PYC"><input value={form.pycNumber} onChange={(event) => setForm({ ...form, pycNumber: event.target.value })} placeholder="Tự sinh nếu bỏ trống" /></Field>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <Field label="Phòng thử nghiệm nhận *"><input value={form.laboratoryName} onChange={(event) => setForm({ ...form, laboratoryName: event.target.value })} placeholder="Ví dụ: PTN HSNL" /></Field>
            <Field label="Hạn trả KQTN"><input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></Field>
            <Field label="Chỉ tiêu/tiêu chuẩn"><input value={form.criteria} onChange={(event) => setForm({ ...form, criteria: event.target.value })} /></Field>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="Lô mẫu PCN (tùy chọn)">
              <select value={form.sampleLotId} onChange={(event) => setForm({ ...form, sampleLotId: event.target.value, sampleRouteId: '' })}>
                <option value="">PYC không gắn lô mẫu</option>
                {dossierLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.lotCode} — {lot.sampleName}</option>)}
              </select>
            </Field>
            <Field label="Tuyến phòng thử (tùy chọn)">
              <select value={form.sampleRouteId} onChange={(event) => {
                const route = lotRoutes.find((item) => item.id === event.target.value);
                setForm({ ...form, sampleRouteId: event.target.value, laboratoryName: route?.labName || form.laboratoryName });
              }} disabled={!form.sampleLotId}>
                <option value="">Chọn tuyến nếu PYC gắn lô</option>
                {lotRoutes.map((route) => <option key={route.id} value={route.id}>{route.labName} — {route.status}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Ghi chú giao nhận"><textarea rows={2} value={form.handoverNote} onChange={(event) => setForm({ ...form, handoverNote: event.target.value })} placeholder="Thông tin mẫu, niêm phong hoặc yêu cầu giao nhận" /></Field>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40">Hủy</button>
            <button type="submit" disabled={!canEdit || saving} aria-busy={saving} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:cursor-wait disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu PYC'}</button>
          </div>
        </form>
      )}

      <div className="mt-4 space-y-2">
        {visibleRequests.length === 0 ? <EmptyLabState canEdit={canEdit} onCreate={() => { setForm((previous) => ({ ...previous, dossierId: initialDossierId || previous.dossierId })); setOpenForm(true); }} /> : visibleRequests.map((request) => {
          const dossier = dossiers.find((item) => item.id === request.dossierId);
          const proposal = proposals.find((item) => item.id === dossier?.proposalId);
          const customerSnapshot = dossier ? getPcnDossierCustomerSnapshot(dossier, proposal) : undefined;
          const nextStatus = getNextPcnLabRequestStatuses(request.status).find((status) => status !== 'CANCELLED');
          const linkedRoute = request.sampleRouteId ? sampleRoutes.find((route) => route.id === request.sampleRouteId) : undefined;
          const requestDocuments = getPcnGeneratedDocumentsForKind(generatedDocuments, request.dossierId, 'LAB_REQUEST', undefined, request.id);
          const latestDocx = requestDocuments.find((document) => document.format === 'DOCX');
          const latestPdf = requestDocuments.find((document) => document.format === 'PDF');
          return (
            <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText size={14} className="text-emerald-600" />
                    <span className="font-mono text-xs font-black text-slate-800">{request.pycNumber}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">{statusLabel(request.status)}</span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-700">{request.laboratoryName} <span className="font-normal text-slate-400">• {customerSnapshot?.name || 'Hồ sơ PCN'}</span></p>
                  <p className="text-[10px] text-slate-500">{dossier?.dossierCode || request.dossierId} • {fieldName(fields, request.fieldCode)}{request.criteria ? ` • ${request.criteria}` : ''}</p>
                  <p className="mt-1 text-[10px] text-slate-400">Giao: {formatDate(request.handoverAt)} • PTN nhận: {formatDate(request.receivedAt)} • Hạn KQ: {formatDate(request.targetDate)}</p>
                  {linkedRoute && <p className="mt-1 text-[10px] font-bold text-emerald-700">Liên kết tuyến mẫu: {linkedRoute.labName} • {linkedRoute.status}</p>}
                  {request.sampleIssue && <p className="mt-1 text-[10px] font-bold text-rose-600">Mẫu có vấn đề: {request.sampleIssue.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px]">
                    {latestDocx || latestPdf ? <><span className="font-bold text-slate-500">Phiếu:</span>{latestDocx && <a href={getPcnFileUrl(latestDocx.fileAssetId)} target="_blank" rel="noreferrer" className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-bold text-indigo-700 underline underline-offset-2">Mở phiếu Word</a>}{latestPdf && <a href={getPcnFileUrl(latestPdf.fileAssetId)} target="_blank" rel="noreferrer" className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-bold text-indigo-700 underline underline-offset-2">Mở phiếu PDF</a>}</> : <span className="text-slate-400">Chưa sinh phiếu Word/PDF</span>}
                    {onOpenDossier && dossier && <button type="button" onClick={() => onOpenDossier(dossier.id)} className="rounded-md border border-slate-200 bg-white px-2 py-1 font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">Mở hồ sơ</button>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {canEdit && nextStatus && <button onClick={() => void moveRequest(request, nextStatus)} disabled={!canEdit || busyRequestId === request.id} aria-busy={busyRequestId === request.id} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-700 disabled:cursor-wait disabled:opacity-50">{busyRequestId === request.id ? 'Đang cập nhật...' : nextStatus === 'SENT' ? <><Send size={12} /> Gửi PTN</> : <><CheckCircle2 size={12} /> Xác nhận PTN nhận</>}</button>}
                  {canEdit && request.status === 'DRAFT' && <button onClick={() => void moveRequest(request, 'CANCELLED')} disabled={!canEdit || busyRequestId === request.id} aria-busy={busyRequestId === request.id} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-500 disabled:cursor-wait disabled:opacity-50"><FolderOpen size={12} /> Hủy PYC</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PcnLabRequestView;
