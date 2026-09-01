'use client';

import React, { useState } from 'react';
import { CheckCircle2, FileSearch, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnApprovalStep, PcnUserAccount } from '../types';
import type { PcnDossierMissingDocumentGroup } from '../utils/pcnDossierPipeline';
import { getPcnApprovalDecisionDenial } from '../utils/pcnApproval';
import { getPcnCodeFamilyLabel, type PcnCodeReview } from '../utils/pcnCodePolicy';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';

export type PcnApprovalEvidence = {
  dossierId: string;
  dossierCode: string;
  score: number;
  stationTitle: string;
  stationNumber?: number;
  stationDocumentTotal: number;
  stationDocumentPresent: number;
  stationMissingLabels: string[];
  requiredDocumentTotal: number;
  requiredDocumentPresent: number;
  coreFieldTotal: number;
  coreFieldPresent: number;
  missingCoreLabels: string[];
  missingRequiredByStage: PcnDossierMissingDocumentGroup[];
  codeReview: PcnCodeReview;
};

export function PcnApprovalModal({ steps, users, currentUser, dossierFieldCodes = [], evidence, onAct, onOpenDossier, onClose }: { steps: PcnApprovalStep[]; users: PcnUserAccount[]; currentUser?: PcnUserAccount; dossierFieldCodes?: string[]; evidence?: PcnApprovalEvidence; onAct: (stepId: string, decision: 'APPROVE' | 'RETURN', comment?: string) => Promise<void>; onOpenDossier: () => void; onClose: () => void }) {
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const current = [...steps].sort((left, right) => left.sequence - right.sequence).find((step) => step.status === 'PENDING');
  const decisionDenial = current ? getPcnApprovalDecisionDenial(current, currentUser, dossierFieldCodes) : null;
  const canAct = Boolean(current && !decisionDenial);

  const act = async (decision: 'APPROVE' | 'RETURN') => {
    if (isSaving) return;
    if (!current || !canAct) return;
    if (decision === 'RETURN' && !comment.trim()) {
      toast.error('Khi trả hồ sơ phải ghi rõ lý do.');
      return;
    }
    setIsSaving(true);
    try {
      await onAct(current.id, decision, comment);
      setComment('');
      toast.success(decision === 'APPROVE' ? 'Đã hoàn tất bước phê duyệt.' : 'Đã trả hồ sơ về bước kỹ thuật.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật phê duyệt');
    } finally {
      setIsSaving(false);
    }
  };

  if (current && !canAct) {
    return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-black text-slate-900">Chuỗi phê duyệt PCN</h2>
            <p className="mt-1 text-[10px] text-slate-500">Bạn chỉ được xem bằng chứng của hồ sơ.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chuỗi phê duyệt" className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">Đóng</button>
        </div>
        <div className="space-y-3 p-4">
          {evidence && <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><span><b>{evidence.dossierCode}</b> · Mức hoàn thiện <b>{evidence.score}%</b> · Bắt buộc <b>{evidence.requiredDocumentPresent}/{evidence.requiredDocumentTotal}</b></span><button type="button" onClick={onOpenDossier} className="rounded-md border border-emerald-300 bg-white px-2 py-1 font-black text-emerald-800 hover:bg-emerald-50">Mở kiểm tra trực quan</button></div></div>}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-5 text-amber-900">Không thể xử lý bước “{current.role}”: {decisionDenial}</p>
        </div>
      </div>
    </div>;
  }

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"><div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-black text-slate-900">Chuỗi phê duyệt PCN</h2><p className="mt-1 text-[10px] text-slate-500">Thực hiện tuần tự theo vai trò; không tự chọn người ngoài danh mục được cấp quyền.</p></div><button type="button" onClick={onClose} aria-label="Đóng chuỗi phê duyệt" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button></header><main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto p-4">{evidence && <section className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3" aria-label="Bằng chứng kiểm tra hồ sơ"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-800">Bằng chứng kiểm tra hồ sơ</div><p className="mt-1 text-[10px] text-emerald-900">{evidence.dossierCode} · chỉ đọc từ checklist hiện tại</p></div><button type="button" onClick={onOpenDossier} className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-[10px] font-black text-emerald-800 hover:bg-emerald-100"><FileSearch size={12} /> Mở kiểm tra trực quan</button></div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-md bg-white/80 p-2"><div className="text-[9px] font-bold text-slate-500">Mức hoàn thiện</div><div className="mt-0.5 text-lg font-black text-emerald-700">{evidence.score}%</div></div><div className="rounded-md bg-white/80 p-2"><div className="text-[9px] font-bold text-slate-500">Bắt buộc đã có</div><div className="mt-0.5 text-lg font-black text-slate-800">{evidence.requiredDocumentPresent}/{evidence.requiredDocumentTotal}</div></div><div className="col-span-2 rounded-md bg-white/80 p-2 sm:col-span-1"><div className="text-[9px] font-bold text-slate-500">Nhóm còn thiếu</div>{evidence.missingRequiredByStage.length === 0 ? <div className="mt-1 text-[10px] font-black text-emerald-700">Không còn mục bắt buộc</div> : <div className="mt-1 space-y-0.5 text-[10px] font-bold text-rose-700">{evidence.missingRequiredByStage.map((group) => <div key={group.stage}>{group.label}: {group.labels.join(', ')}</div>)}</div>}</div></div><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="col-span-2 rounded-md bg-white/80 p-2 sm:col-span-1"><div className="text-[9px] font-bold text-slate-500">Bước hiện tại</div><div className="mt-0.5 text-[11px] font-black text-indigo-700">{evidence.stationNumber ? `Bước ${evidence.stationNumber} · ` : ''}{evidence.stationTitle}</div><div className="mt-0.5 text-[9px] font-bold text-slate-600">Tài liệu bước: {evidence.stationDocumentPresent}/{evidence.stationDocumentTotal}</div>{evidence.stationMissingLabels.length > 0 && <div className="mt-1 text-[9px] font-bold text-amber-700">Thiếu tại bước: {evidence.stationMissingLabels.join(', ')}</div>}</div><div className="col-span-2 rounded-md bg-white/80 p-2 sm:col-span-2"><div className="text-[9px] font-bold text-slate-500">Thông tin lõi</div><div className="mt-0.5 text-[11px] font-black text-slate-800">{evidence.coreFieldPresent}/{evidence.coreFieldTotal} trường đã đủ</div>{evidence.missingCoreLabels.length > 0 ? <div className="mt-1 text-[9px] font-bold text-amber-700">Còn thiếu: {evidence.missingCoreLabels.join(', ')}</div> : <div className="mt-1 text-[9px] font-black text-emerald-700">Đã đủ thông tin lõi</div>}</div></div><div className="mt-2 rounded-md bg-white/80 p-2"><div className="text-[9px] font-bold text-slate-500">Mã nguồn PCN</div><div className={`mt-0.5 text-[11px] font-black ${evidence.codeReview.needsReview ? 'text-amber-800' : 'text-emerald-700'}`}>{getPcnCodeFamilyLabel(evidence.codeReview.family)} · {evidence.codeReview.needsReview ? 'Cần đối chiếu mã nguồn' : 'Đã nhận diện'}</div><div className="mt-1 grid gap-1 text-[9px] text-slate-600 sm:grid-cols-2"><span>Mã gốc: <b className="font-mono text-slate-800">{evidence.codeReview.source || 'Chưa có'}</b></span><span>Mã chuẩn hóa: <b className="font-mono text-slate-800">{evidence.codeReview.normalized || 'Chưa có'}</b></span></div>{evidence.codeReview.needsReview && <div className="mt-1 text-[9px] font-bold text-amber-700">{evidence.codeReview.message} Không tự sửa mã trong bước phê duyệt.</div>}</div></section>}{<div className="space-y-2">{[...steps].sort((left, right) => left.sequence - right.sequence).map((step) => <div key={step.id} className={`rounded-lg border p-3 ${step.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50/60' : step.status === 'RETURNED' ? 'border-rose-200 bg-rose-50/60' : step.id === current?.id ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-white'}`}><div className="flex items-start gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{step.sequence}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black text-slate-800">{step.role}</span><span className="text-[10px] font-bold text-slate-500">{step.status === 'APPROVED' ? 'Đã duyệt' : step.status === 'RETURNED' ? 'Đã trả' : step.id === current?.id ? 'Đang chờ xử lý' : 'Chờ đến lượt'}</span></div>{step.assigneeUsername && <p className="mt-1 text-[10px] text-slate-500">Thực hiện bởi: {getPcnUserDisplayName(step.assigneeUsername, users)}</p>}{step.comment && <p className="mt-1 text-[10px] text-slate-600">Ý kiến: {step.comment}</p>}</div>{step.status === 'APPROVED' && <CheckCircle2 size={16} className="text-emerald-600" />}</div></div>)}</div>}{current && <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-indigo-700">Ý kiến bước hiện tại: {current.role}</p><textarea rows={3} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Nhập ý kiến hoặc lý do trả hồ sơ" className="mt-2 w-full rounded-md border border-indigo-100 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400" /></div>}</main><footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">{current ? <><button disabled={isSaving} onClick={() => void act('RETURN')} className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-bold text-rose-700 disabled:opacity-50"><RotateCcw size={13} /> Trả hồ sơ</button><button disabled={isSaving} onClick={() => void act('APPROVE')} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-50"><CheckCircle2 size={13} /> Phê duyệt bước</button></> : <span className="text-[10px] font-bold text-emerald-700">Chuỗi phê duyệt đã hoàn tất</span>}</footer></div></div>;
}

export default PcnApprovalModal;
