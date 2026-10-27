'use client';

import React, { useState } from 'react';
import { CheckCircle2, FileSearch, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnApprovalStep, PcnUserAccount } from '../types';
import type { PcnDossierMissingDocumentGroup } from '../utils/pcnDossierPipeline';
import { getPcnApprovalDecisionDenial } from '../utils/pcnApproval';
import { getPcnCodeFamilyLabel, type PcnCodeReview } from '../utils/pcnCodePolicy';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';

export type PcnApprovalPackageEvidence = {
  assetCount: number;
  checksumReadyCount: number;
  unknownMetadataCount: number;
  manifestStatus: 'READY_TO_VERIFY' | 'ACTION_REQUIRED';
  manifestNote: string;
  action: string;
};

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
  packageEvidence?: PcnApprovalPackageEvidence;
};

type ApprovalModalProps = {
  steps: PcnApprovalStep[];
  users: PcnUserAccount[];
  currentUser?: PcnUserAccount;
  dossierFieldCodes?: string[];
  evidence?: PcnApprovalEvidence;
  onAct: (stepId: string, decision: 'APPROVE' | 'RETURN', comment?: string) => Promise<void>;
  onOpenDossier: () => void;
  onClose: () => void;
};

function approvalRoleLabel(role: string): string {
  return ({
    TECHNICAL_REVIEW: 'Soát xét kỹ thuật',
    LEADERSHIP_APPROVAL: 'Phê duyệt lãnh đạo',
  } as Record<string, string>)[role] || role;
}

function ApprovalEvidenceCard({ evidence, onOpenDossier }: { evidence?: PcnApprovalEvidence; onOpenDossier: () => void }) {
  if (!evidence) return null;
  const packageEvidence = evidence.packageEvidence;
  const hasMissingRequirements = evidence.missingRequiredByStage.length > 0;
  return (
    <section className="mb-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3" aria-label="Bằng chứng kiểm tra hồ sơ">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-emerald-800">Bằng chứng kiểm tra hồ sơ · chỉ xem</div>
          <p className="mt-1 text-[11px] text-emerald-900">{evidence.dossierCode} · chỉ đọc từ bản chụp danh sách kiểm tra hiện tại</p>
        </div>
        <button type="button" onClick={onOpenDossier} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-[11px] font-black text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"><FileSearch size={12} aria-hidden="true" /> Mở kiểm tra trực quan</button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-md bg-white/80 p-2"><div className="text-[11px] font-bold text-slate-500">Mức hoàn thiện</div><div className="mt-0.5 text-lg font-black text-emerald-700">{evidence.score}%</div></div>
        <div className="rounded-md bg-white/80 p-2"><div className="text-[11px] font-bold text-slate-500">Bắt buộc đã có</div><div className="mt-0.5 text-lg font-black text-slate-800">{evidence.requiredDocumentPresent}/{evidence.requiredDocumentTotal}</div></div>
        <div className="col-span-2 rounded-md bg-white/80 p-2 sm:col-span-1"><div className="text-[11px] font-bold text-slate-500">Nhóm còn thiếu</div>{hasMissingRequirements ? <div className="mt-1 space-y-0.5 text-[11px] font-bold text-rose-700">{evidence.missingRequiredByStage.map((group) => <div key={group.stage}>{group.label}: {group.labels.join(', ')}</div>)}</div> : <div className="mt-1 text-[11px] font-black text-emerald-700">Không còn mục bắt buộc</div>}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 rounded-md bg-white/80 p-2 sm:col-span-1"><div className="text-[11px] font-bold text-slate-500">Bước hiện tại</div><div className="mt-0.5 text-[11px] font-black text-indigo-700">{evidence.stationNumber ? `Bước ${evidence.stationNumber} · ` : ''}{evidence.stationTitle}</div><div className="mt-0.5 text-[11px] font-bold text-slate-600">Tài liệu bước: {evidence.stationDocumentPresent}/{evidence.stationDocumentTotal}</div>{evidence.stationMissingLabels.length > 0 && <div className="mt-1 text-[11px] font-bold text-amber-700">Thiếu tại bước: {evidence.stationMissingLabels.join(', ')}</div>}</div>
        <div className="col-span-2 rounded-md bg-white/80 p-2 sm:col-span-2"><div className="text-[11px] font-bold text-slate-500">Thông tin lõi</div><div className="mt-0.5 text-[11px] font-black text-slate-800">{evidence.coreFieldPresent}/{evidence.coreFieldTotal} trường đã đủ</div>{evidence.missingCoreLabels.length > 0 ? <div className="mt-1 text-[11px] font-bold text-amber-700">Còn thiếu: {evidence.missingCoreLabels.join(', ')}</div> : <div className="mt-1 text-[11px] font-black text-emerald-700">Đã đủ thông tin lõi</div>}</div>
      </div>
      <div className="rounded-md bg-white/80 p-2"><div className="text-[11px] font-bold text-slate-500">Mã nguồn PCN</div><div className={`mt-0.5 text-[11px] font-black ${evidence.codeReview.needsReview ? 'text-amber-800' : 'text-emerald-700'}`}>{getPcnCodeFamilyLabel(evidence.codeReview.family)} · {evidence.codeReview.needsReview ? 'Cần đối chiếu mã nguồn' : 'Đã nhận diện'}</div><div className="mt-1 grid gap-1 text-[9px] text-slate-600 sm:grid-cols-2"><span>Mã gốc: <b className="font-mono text-slate-800">{evidence.codeReview.source || 'Chưa có'}</b></span><span>Mã chuẩn hóa: <b className="font-mono text-slate-800">{evidence.codeReview.normalized || 'Chưa có'}</b></span></div>{evidence.codeReview.needsReview && <div className="mt-1 text-[11px] font-bold text-amber-700">{evidence.codeReview.message} Không tự sửa mã trong bước phê duyệt.</div>}</div>
      <section className={`rounded-md border p-2 ${packageEvidence?.manifestStatus === 'ACTION_REQUIRED' ? 'border-amber-200 bg-amber-50/80' : 'border-indigo-100 bg-white/80'}`} aria-label="Bằng chứng gói hồ sơ"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[11px] font-black uppercase tracking-wide text-indigo-800">Bằng chứng gói hồ sơ · chỉ xem</div><span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-700">Bản kê hệ thống</span></div>{packageEvidence ? <><div className="mt-1 grid gap-1 text-[9px] text-slate-700 sm:grid-cols-3"><span>Liên kết tệp: <b>{packageEvidence.assetCount}</b></span><span>Mã kiểm tra/nguồn gốc: <b>{packageEvidence.checksumReadyCount}/{packageEvidence.assetCount}</b></span><span>Thiếu thông tin tệp: <b>{packageEvidence.unknownMetadataCount}</b></span></div><p className={`mt-1 text-[11px] font-bold ${packageEvidence.manifestStatus === 'ACTION_REQUIRED' ? 'text-amber-800' : 'text-indigo-800'}`}>Bản kê: {packageEvidence.manifestNote}</p><p className="mt-1 text-[11px] text-slate-700"><b>Hành động tiếp theo:</b> {packageEvidence.action}</p></> : <p className="mt-1 text-[11px] text-amber-800"><b>Bản kê:</b> Chưa có bản chụp danh sách tệp trong phiên làm việc. <b>Hành động tiếp theo:</b> mở kiểm tra trực quan; hệ thống sẽ xác nhận nguồn gốc và mã kiểm tra cuối cùng.</p>}</section>
      {hasMissingRequirements && <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800" role="status"><b>Hành động tiếp theo:</b> mở danh sách kiểm tra để bổ sung hoặc đánh dấu bỏ qua từng tài liệu bắt buộc kèm lý do.</p>}
    </section>
  );
}

function ApprovalAuthorityCard({ current, currentUser, canAct, decisionDenial, users }: { current?: PcnApprovalStep; currentUser?: PcnUserAccount; canAct: boolean; decisionDenial: string | null; users: PcnUserAccount[] }) {
  if (!current) return null;
  const authorityLabel = currentUser ? `${getPcnUserDisplayName(currentUser.username, users)} · ${currentUser.departmentRoleCode || currentUser.managementRoleCode || currentUser.role}` : 'Chưa xác định tài khoản PCN';
  return <section className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="Quyền quyết định"><div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-700"><ShieldCheck size={13} aria-hidden="true" /> Quyền quyết định</div><div className="mt-2 grid gap-1 text-[11px] text-slate-700 sm:grid-cols-3"><span>Vai trò yêu cầu: <b>{approvalRoleLabel(current.role)}</b></span><span>Người thao tác: <b>{authorityLabel}</b></span><span>Ủy quyền: <b>{current.assigneeUsername ? `Giao đích danh · ${getPcnUserDisplayName(current.assigneeUsername, users)}` : 'Theo chức vụ và Lĩnh vực'}</b></span></div><p className={`mt-2 rounded-md px-2 py-1.5 text-[11px] font-bold ${canAct ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`} role={canAct ? 'status' : 'alert'}>{canAct ? 'Được phép quyết định bước này.' : `Bạn chỉ được xem bằng chứng; ${decisionDenial || 'chưa có bước cần xử lý.'}`}</p></section>;
}

export function PcnApprovalModal({ steps, users, currentUser, dossierFieldCodes = [], evidence, onAct, onOpenDossier, onClose }: ApprovalModalProps) {
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

  const title = <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h2 id="pcn-approval-dialog-title" className="text-sm font-black text-slate-900">Phê duyệt bước 5</h2><p className="mt-1 text-[11px] text-slate-500">Lãnh đạo kiểm tra danh sách tài liệu, bộ hồ sơ chỉ xem và quyết định phê duyệt.</p></div><button type="button" onClick={onClose} aria-label="Đóng vùng phê duyệt bước 5" className="mobile-touch-target min-h-11 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><X size={18} aria-hidden="true" /></button></header>;
  if (current && !canAct) return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="pcn-approval-dialog-title" className="flex min-h-0 max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">{title}<main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto p-4"><ApprovalEvidenceCard evidence={evidence} onOpenDossier={onOpenDossier} /><ApprovalAuthorityCard current={current} currentUser={currentUser} canAct={false} decisionDenial={decisionDenial} users={users} /></main></section></div>;

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="pcn-approval-dialog-title" className="flex min-h-0 max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">{title}<main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto p-4"><ApprovalEvidenceCard evidence={evidence} onOpenDossier={onOpenDossier} /><ApprovalAuthorityCard current={current} currentUser={currentUser} canAct={canAct} decisionDenial={decisionDenial} users={users} />{current && <div className="space-y-2">{[...steps].sort((left, right) => left.sequence - right.sequence).map((step) => <div key={step.id} className={`rounded-lg border p-3 ${step.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50/60' : step.status === 'RETURNED' ? 'border-rose-200 bg-rose-50/60' : step.id === current.id ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-200 bg-white'}`}><div className="flex items-start gap-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black text-slate-500 ring-1 ring-slate-200">{step.sequence}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black text-slate-800">{approvalRoleLabel(step.role)}</span><span className="text-[11px] font-bold text-slate-500">{step.status === 'APPROVED' ? 'Đã duyệt' : step.status === 'RETURNED' ? 'Đã trả' : step.id === current.id ? 'Đang chờ xử lý' : 'Chờ đến lượt'}</span></div>{step.assigneeUsername && <p className="mt-1 text-[11px] text-slate-500">Thực hiện bởi: {getPcnUserDisplayName(step.assigneeUsername, users)}</p>}{step.comment && <p className="mt-1 text-[11px] text-slate-600">Ý kiến: {step.comment}</p>}</div>{step.status === 'APPROVED' && <CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />}</div></div>)}</div>}{current && <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3"><label htmlFor="pcn-approval-comment" className="text-[11px] font-black uppercase tracking-wide text-indigo-700">Ý kiến quyết định bước 5 <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span> <span className="font-bold normal-case">(Bắt buộc khi trả hồ sơ)</span></label><textarea id="pcn-approval-comment" rows={3} value={comment} onChange={(event) => setComment(event.target.value)} aria-describedby="pcn-approval-comment-hint" data-return-reason-required="true" className="mt-2 w-full rounded-md border border-indigo-100 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400" /><p id="pcn-approval-comment-hint" className="mt-1 text-[11px] text-indigo-800">Khi chọn “Trả hồ sơ”, lý do không được để trống; khi phê duyệt, ý kiến là tùy chọn.</p></div>}</main><footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 px-4 py-3">{current && canAct ? <><button disabled={isSaving} type="button" onClick={() => void act('RETURN')} className="mobile-touch-target min-h-11 inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"><RotateCcw size={13} aria-hidden="true" /> Trả hồ sơ về bước 4</button><button disabled={isSaving} type="button" onClick={() => void act('APPROVE')} className="mobile-touch-target min-h-11 inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"><CheckCircle2 size={13} aria-hidden="true" /> Phê duyệt bước 5</button></> : <span className="text-[11px] font-bold text-emerald-700">Quyết định bước 5 đã hoàn tất</span>}</footer></section></div>;
}

export default PcnApprovalModal;
