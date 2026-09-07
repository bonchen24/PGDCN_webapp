'use client';

import React from 'react';
import { ArrowRight, Download, ExternalLink, FileText, FlaskConical, MapPin, Package, RefreshCw, Send, X } from 'lucide-react';

import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnCertificationField, PcnGeneratedDocument, PcnSampleItem, PcnSampleLot, PcnSampleRoute } from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';

function Value({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 break-words text-[11px] font-bold text-slate-700">{value || 'Chưa cập nhật'}</div></div>;
}

function formatDateTime(value?: string): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa cập nhật' : date.toLocaleString('vi-VN');
}

function statusLabel(status: OutboundLabRequest['status']): string {
  return status === 'DRAFT' ? 'Bản nháp' : status === 'SENT' ? 'Đã gửi PTN' : status === 'RECEIVED' ? 'PTN đã nhận' : status === 'RESULT_RETURNED' ? 'Đã trả KQTN' : 'Đã hủy';
}

export function PcnLabRequestDetailModal({ request, dossier, proposal, field, lot, route, sampleItems = [], latestDocx, latestPdf, nextStatus, canEdit, busy, onMoveStatus, onDispatch, onReconcile, onOpenDocuments, onClose }: {
  request: OutboundLabRequest;
  dossier?: CertificationDossier;
  proposal?: CertificationProposal;
  field?: PcnCertificationField;
  lot?: PcnSampleLot;
  route?: PcnSampleRoute;
  sampleItems?: PcnSampleItem[];
  latestDocx?: PcnGeneratedDocument;
  latestPdf?: PcnGeneratedDocument;
  nextStatus?: OutboundLabRequest['status'];
  canEdit: boolean;
  busy?: boolean;
  onMoveStatus?: (status: OutboundLabRequest['status']) => void;
  onDispatch?: () => void;
  onReconcile?: () => void;
  onOpenDocuments?: () => void;
  onClose: () => void;
}) {
  const customer = dossier ? getPcnDossierCustomerSnapshot(dossier, proposal) : proposal?.customerSnapshot;
  const handover = request.handoverDetails;
  const handoverAt = handover?.handoverAt || request.handoverAt;
  const receivedAt = handover?.receivedAt || request.receivedAt;
  const integration = request.integration;

  return <div className="fixed inset-0 z-[86] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="presentation">
    <section className="flex min-h-0 max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-md sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="pcn-lab-request-detail-title">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><FileText size={16} className="text-indigo-600" /><h2 id="pcn-lab-request-detail-title" className="text-sm font-black text-slate-900">Chi tiết PYC gửi PTN</h2><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[9px] font-black text-indigo-700">{request.pycNumber}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-black text-slate-600">{statusLabel(request.status)}</span></div><p className="mt-1 text-[10px] text-slate-500">Chứng từ outbound của PCN, liên kết với hồ sơ, Lĩnh vực và tuyến mẫu.</p></div>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết PYC" className="mobile-touch-target shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><X size={18} /></button>
      </header>
      <main className="min-h-0 flex-1 mobile-scroll-y space-y-3 overflow-y-auto p-3 md:p-4">
        <div className="grid gap-2 sm:grid-cols-2"><Value label="Hồ sơ" value={dossier?.dossierCode || request.dossierId} /><Value label="Khách hàng" value={customer?.name} /><Value label="Lĩnh vực" value={field?.name || request.fieldCode} /><Value label="Phòng thử nghiệm nhận" value={request.laboratoryName} /><Value label="Số báo cáo / chỉ tiêu" value={request.criteria} /><Value label="Hạn trả KQTN" value={request.targetDate} /></div>
        <section className="rounded-lg border border-blue-200 bg-blue-50/40 p-3"><div className="flex items-center gap-2"><Package size={14} className="text-blue-600" /><h3 className="text-xs font-black text-slate-800">Mẫu và tuyến liên kết</h3></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><Value label="Lô mẫu" value={lot ? <span className="inline-flex items-center gap-1.5"><Package size={12} className="text-blue-600" />{lot.lotCode} · {lot.sampleName}</span> : 'PYC không gắn lô mẫu'} /><Value label="Tuyến phòng thử" value={route ? <span className="inline-flex items-center gap-1.5"><FlaskConical size={12} className="text-indigo-600" />{route.labName} · {route.status}</span> : 'PYC không gắn tuyến'} /><Value label="Địa điểm mẫu hiện tại" value={lot ? <span className="inline-flex items-center gap-1.5"><MapPin size={12} className="text-slate-500" />{lot.currentLocation}</span> : undefined} /><Value label="Mã tuyến" value={route?.id} /></div>{sampleItems.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{sampleItems.map((item) => <span key={item.id} className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-[9px] font-bold text-indigo-700">{item.sampleCode} · {item.sampleType} · {item.model} · SL {item.quantity}</span>)}</div>}</section>
        {integration && <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"><div className="flex items-center gap-2"><RefreshCw size={14} className="text-amber-700" /><h3 className="text-xs font-black text-slate-800">Liên kết app phòng thử</h3></div><div className="mt-2 grid gap-2 sm:grid-cols-2"><Value label="App đích" value={integration.targetSystemCode} /><Value label="Trạng thái đồng bộ" value={integration.syncStatus} /><Value label="Mã PYC tại phòng thử" value={integration.externalRequestCode || integration.externalRequestId} /><Value label="ACK gần nhất" value={formatDateTime(integration.acknowledgedAt)} /><Value label="Đồng bộ gần nhất" value={formatDateTime(integration.lastSyncedAt)} /><Value label="Lỗi gần nhất" value={integration.lastErrorMessage || integration.lastErrorCode} /></div></section>}
        <section className="rounded-lg border border-slate-200 bg-white p-3"><h3 className="text-xs font-black text-slate-800">Giao nhận mẫu</h3><div className="mt-2 grid gap-2 sm:grid-cols-2"><Value label="Người giao / đơn vị" value={handover ? `${handover.senderName}${handover.senderUnit ? ` · ${handover.senderUnit}` : ''}` : undefined} /><Value label="Người nhận / đơn vị" value={handover ? `${handover.receiverName}${handover.receiverUnit ? ` · ${handover.receiverUnit}` : ''}` : undefined} /><Value label="Thời điểm bàn giao" value={formatDateTime(handoverAt)} /><Value label="PTN nhận mẫu" value={formatDateTime(receivedAt)} /><Value label="Địa điểm" value={handover?.location} /><Value label="Phương tiện / lái xe" value={handover ? [handover.vehicle, handover.driver].filter(Boolean).join(' · ') : undefined} /><Value label="Số lượng giao nhận" value={handover?.quantity} /><Value label="Mã mẫu / mã hóa theo lô" value={handover?.sampleCodes?.join(' · ')} /></div>{(request.handoverNote || handover?.note) && <p className="mt-2 rounded-md bg-slate-50 px-2.5 py-2 text-[10px] text-slate-600"><b>Ghi chú:</b> {handover?.note || request.handoverNote}</p>}</section>
        <section className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex items-center gap-2"><FileText size={14} className="text-indigo-600" /><h3 className="text-xs font-black text-slate-800">Tài liệu PYC</h3></div><div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">{latestDocx && <a href={getPcnFileUrl(latestDocx.fileAssetId)} target="_blank" rel="noreferrer" className="mobile-touch-target min-h-11 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-bold text-indigo-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><ExternalLink size={12} /> Mở PYC DOCX</a>}{latestPdf && <a href={getPcnFileUrl(latestPdf.fileAssetId)} target="_blank" rel="noreferrer" className="mobile-touch-target min-h-11 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 font-bold text-indigo-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><ExternalLink size={12} /> Mở PYC PDF</a>}{!latestDocx && !latestPdf && <span className="text-slate-400">Chưa sinh tài liệu PYC.</span>}</div></section>
      </main>
      <footer className="flex shrink-0 flex-col items-stretch gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">{canEdit && onDispatch && request.status !== 'CANCELLED' && ['NOT_SENT', 'PENDING', 'ERROR', 'REJECTED'].includes(integration?.syncStatus || 'NOT_SENT') && <button type="button" onClick={onDispatch} disabled={busy} className="mobile-touch-target min-h-11 w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-black text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-50"><Send size={13} />{busy ? 'Đang gửi…' : 'Gửi PYC sang phòng thử'}</button>}{canEdit && onReconcile && integration?.externalRequestId && ['ACKNOWLEDGED', 'PENDING', 'ERROR'].includes(integration.syncStatus) && <button type="button" onClick={onReconcile} disabled={busy} className="mobile-touch-target min-h-11 w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-black text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1 disabled:opacity-50"><RefreshCw size={13} />{busy ? 'Đang đồng bộ…' : 'Đồng bộ lại'}</button>}{canEdit && onMoveStatus && nextStatus && <button type="button" onClick={() => onMoveStatus(nextStatus)} disabled={busy} className="mobile-touch-target min-h-11 w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 disabled:opacity-50"><ArrowRight size={13} />{busy ? 'Đang cập nhật…' : `Chuyển: ${statusLabel(nextStatus)}`}</button>}{onOpenDocuments && <button type="button" onClick={onOpenDocuments} className="mobile-touch-target min-h-11 w-full sm:w-auto inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><Download size={13} /> Sinh PYC DOCX/PDF</button>}<button type="button" onClick={onClose} className="mobile-touch-target min-h-11 w-full sm:w-auto rounded-md border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1">Đóng</button></footer>
    </section>
  </div>;
}

export default PcnLabRequestDetailModal;
