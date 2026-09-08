'use client';

import { formatDateTimeDdMmYyyy } from '../utils/formatter';

import React from 'react';
import { Download, FileText, UserRound, X } from 'lucide-react';

import type { CertificationDossier, CertificationProposal, PcnCertificationField } from '../types';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';

function Value({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"><div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-[11px] font-bold text-slate-700">{value || 'Chưa cập nhật'}</div></div>;
}

export function PcnProposalDetailModal({ proposal, dossier, fields, onOpenDocuments, onClose }: { proposal: CertificationProposal; dossier: CertificationDossier; fields: PcnCertificationField[]; onOpenDocuments: (kind: 'PROPOSAL_FORM' | 'PROPOSAL_SUMMARY') => void; onClose: () => void }) {
  const customer = getPcnDossierCustomerSnapshot(dossier, proposal);
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="presentation">
      <section className="flex min-h-0 max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-md sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="pcn-proposal-detail-title">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div><div className="flex flex-wrap items-center gap-2"><FileText size={16} className="text-emerald-600" /><h2 id="pcn-proposal-detail-title" className="text-sm font-black text-slate-900">Chi tiết Đề nghị</h2><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[9px] font-black text-emerald-700">{proposal.proposalCode}</span></div><p className="mt-1 text-[10px] text-slate-500">Đề nghị là đầu vào của một bộ hồ sơ mới; mọi văn bản được tạo và lưu trong card hồ sơ {dossier.dossierCode}.</p></div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết Đề nghị" className="mobile-touch-target rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><X size={18} /></button>
        </header>
        <main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto p-3 md:p-4">
          <div className="grid gap-2 sm:grid-cols-2"><Value label="Khách hàng" value={<span className="inline-flex items-center gap-1.5"><UserRound size={12} className="text-emerald-600" />{customer?.name || proposal.customerSnapshot.name}</span>} /><Value label="Trạng thái Đề nghị" value={proposal.status} /><Value label="Kênh tiếp nhận" value={proposal.channel} /><Value label="Ngày tiếp nhận" value={formatDateTimeDdMmYyyy(proposal.receivedAt) || 'Chưa cập nhật'} /><Value label="Sản phẩm" value={proposal.productName} /><Value label="Model / Nhãn hiệu" value={[proposal.model, proposal.brand].filter(Boolean).join(' • ')} /><Value label="Nhà sản xuất" value={proposal.manufacturer} /><Value label="Địa chỉ nhà sản xuất" value={proposal.manufacturerAddress} /><Value label="Thông số kỹ thuật" value={proposal.specifications} /><Value label="Số lượng" value={`${proposal.quantity} ${proposal.quantity === 1 ? 'mẫu' : 'mẫu'}`} /><Value label="Địa chỉ/kho" value={proposal.warehouseAddress || customer?.address} /><Value label="Người liên hệ" value={[customer?.contactPerson, customer?.phone].filter(Boolean).join(' • ')} /></div>
          <section className="mt-3 rounded-lg border border-slate-200 bg-white p-3"><h3 className="text-xs font-black text-slate-800">Lĩnh vực áp dụng</h3><div className="mt-2 flex flex-wrap gap-1.5">{proposal.fieldCodes.map((code) => <span key={code} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">{code} · {fields.find((field) => field.code === code)?.name || 'Chưa đặt tên'}</span>)}</div></section>
        </main>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3"><button type="button" onClick={() => onOpenDocuments('PROPOSAL_SUMMARY')} className="mobile-touch-target min-h-11 inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><Download size={13} /> Sinh tóm tắt DOCX/PDF</button><button type="button" onClick={() => onOpenDocuments('PROPOSAL_FORM')} className="mobile-touch-target min-h-11 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><FileText size={13} /> Sinh biểu mẫu Đề nghị</button><button type="button" onClick={onClose} className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1">Đóng</button></footer>
      </section>
    </div>
  );
}

export default PcnProposalDetailModal;
