'use client';

import { formatDateDdMmYyyy } from '../utils/formatter';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleUserRound, ClipboardList, FileWarning, UserRound } from 'lucide-react';

import type { CertificationDossier, CertificationProposal, PcnCertificationField, PcnDossierDocument, PcnDocumentRequirement, PcnDossierWorkflowTask, PcnUserAccount, UserAccount } from '../types';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { buildPcnWorkQueueRows } from '../utils/pcnWorkQueue';
import { buildPcnDossierCompleteness, filterPcnDossiersByField, getPcnPipelineStation } from '../utils/pcnDossierPipeline';
import { getPcnWorkflowStage } from '../utils/pcnWorkflowStages';
import { getPcnDossierStationTab, type PcnDossierDetailTab } from '../utils/pcnDossierNavigation';
import { getPcnDossierAssignmentDenial, getPcnOwnerAssignmentAuthorityDenial } from '../utils/pcnDossierAssignment';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';
import { getPcnDossierStatusLabel } from '../utils/pcnWorkflow';
import { getPcnWorkflowFocusNode } from '../utils/pcnWorkflowRuntime';
import PcnDossierAssignmentControl from './PcnDossierAssignmentControl';

type BoardScope = 'ALL' | 'MINE' | 'OVERDUE';

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

const WORKFLOW_NODE_STATUS_LABELS: Record<string, string> = {
  LOCKED: 'Chưa mở',
  READY: 'Sẵn sàng',
  IN_PROGRESS: 'Đang xử lý',
  WAITING: 'Đang chờ',
  COMPLETED: 'Đã hoàn tất',
  RETURNED: 'Đã trả lại',
  SKIPPED: 'Đã bỏ qua',
};

function userLabel(username: string | undefined, users: PcnUserAccount[]): string {
  return username ? getPcnUserDisplayName(username, users) : 'Chưa gán người thực hiện';
}

function formatDate(value?: string): string {
  return formatDateDdMmYyyy(value) || 'Chưa cập nhật';
}

function missingDocumentSummary(completeness: ReturnType<typeof buildPcnDossierCompleteness>): string {
  return completeness.missingRequiredByStage.map((group) => `${group.label}: ${group.labels.join(', ')}`).join(' · ');
}

function DossierPipelineCard({ dossier, proposal, requirements, documents, workflowTasks, users, currentUser, overdue, claimDenial, claiming, assigning, onClaimDossier, onAssignDossier, onOpenDossier }: {
  dossier: CertificationDossier;
  proposal?: CertificationProposal;
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  workflowTasks: PcnDossierWorkflowTask[];
  users: PcnUserAccount[];
  currentUser: UserAccount | null;
  overdue: boolean;
  claimDenial: string | null;
  claiming: boolean;
  assigning: boolean;
  onClaimDossier?: (dossier: CertificationDossier) => Promise<void>;
  onAssignDossier?: (ownerUsername: string) => Promise<void>;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: PcnDossierDetailTab) => void;
}) {
  const completeness = buildPcnDossierCompleteness({ dossier, proposal, requirements, documents });
  const station = getPcnWorkflowStage(dossier.status) || getPcnPipelineStation(dossier.status);
  const focusNode = getPcnWorkflowFocusNode(dossier.workflowSnapshot, workflowTasks.filter((task) => task.dossierId === dossier.id));
  const focusNodeStatusLabel = focusNode ? WORKFLOW_NODE_STATUS_LABELS[focusNode.status] || focusNode.status : '';
  const snapshot = getPcnDossierCustomerSnapshot(dossier, proposal);
  const stepMissingLabels = completeness.stationMissingLabels;
  const exceptionReason = dossier.exceptionReason?.trim();
  const codeReview = completeness.codeReview;
  return (
    <article className="min-w-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-all font-mono text-[11px] font-black text-slate-800">{dossier.dossierCode}</p>
          <p className="mt-1 truncate text-[11px] font-black text-slate-700" title={snapshot?.name || undefined}>{snapshot?.name || 'Chưa gắn khách hàng'}</p>
          <p className="truncate text-[10px] text-slate-500">{proposal?.productName || 'Chưa có sản phẩm'}{proposal?.model ? ` · ${proposal.model}` : ''}</p>
          <p className={`mt-1 truncate text-[9px] font-bold ${codeReview.needsReview ? 'text-amber-700' : 'text-slate-400'}`} title={codeReview.source || 'Chưa có mã nguồn PCN'}>Mã nguồn PCN: {codeReview.source || 'Chưa có'}{codeReview.needsReview ? ' · Cần đối chiếu mã nguồn' : ` · ${codeReview.normalized}`}</p>
        </div>
        <span className={`max-w-[42%] shrink-0 truncate rounded-full border px-1.5 py-0.5 text-[9px] font-black ${overdue ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`} title={getPcnDossierStatusLabel(dossier.status)}>{overdue ? 'Quá hạn' : focusNode?.label || 'Chưa khởi tạo lưu trình'}</span>
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 p-2">
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="inline-flex min-w-0 items-center gap-1 font-bold text-slate-600" title={userLabel(dossier.ownerUsername, users)}><CircleUserRound size={12} className="shrink-0 text-emerald-600" /> <span className="truncate">Chủ hồ sơ</span></span>
          <span className={`font-black ${completeness.score < 70 ? 'text-amber-700' : 'text-emerald-700'}`}>{completeness.score}%</span>
        </div>
        <PcnDossierAssignmentControl
          dossier={dossier}
          users={users}
          currentUser={currentUser}
          onClaim={onClaimDossier ? () => onClaimDossier(dossier) : undefined}
          onAssign={onAssignDossier}
          claimDenial={claimDenial}
          disabled={assigning || claiming}
          compact
        />
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label={`Mức hoàn thiện ${completeness.score}%`}><div className={`h-full rounded-full ${completeness.score < 50 ? 'bg-rose-500' : completeness.score < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${completeness.score}%` }} /></div>
        <p className="mt-1.5 text-[9px] text-slate-500" aria-label={focusNode ? `Bước hiện tại ${focusNode.label}; Tài liệu tại bước ${completeness.stationDocumentPresent}/${completeness.stationDocumentTotal}; Điểm bước ${focusNodeStatusLabel}` : `Điểm bước ${completeness.stationScore === null ? 'Không áp dụng' : `${completeness.stationScore}%`}`}>{focusNode ? `Bước: ${focusNode.label} · ${focusNodeStatusLabel}` : 'Chưa có bước lưu trình để hiển thị'} · Tài liệu đang có: {completeness.stationDocumentPresent}/{completeness.stationDocumentTotal} · Hạn {formatDate(dossier.targetDate)}</p>
      </div>

      {stepMissingLabels.length > 0 && <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-100 bg-amber-50/70 p-2 text-[9px] leading-4 text-amber-800"><FileWarning size={12} className="mt-0.5 shrink-0" /><span><b>Tài liệu còn thiếu tại bước:</b> {stepMissingLabels.slice(0, 2).join(', ')}{stepMissingLabels.length > 2 ? ` và ${stepMissingLabels.length - 2} mục khác` : ''}</span></div>}
      {completeness.missingCoreLabels.length > 0 && <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-100 bg-amber-50/60 p-2 text-[9px] leading-4 text-amber-800"><FileWarning size={12} className="mt-0.5 shrink-0" /><span><b>Thông tin lõi còn thiếu:</b> {completeness.missingCoreLabels.join(', ')}</span></div>}
      {completeness.missingRequiredByStage.length > 0 && <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-100 bg-rose-50/60 p-2 text-[9px] leading-4 text-rose-800"><FileWarning size={12} className="mt-0.5 shrink-0" /><span className="min-w-0"><b>Tài liệu bắt buộc còn thiếu:</b> <span className="break-words">{missingDocumentSummary(completeness)}</span></span></div>}
      {stepMissingLabels.length === 0 && completeness.missingRequiredByStage.length === 0 && <p className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700"><CheckCircle2 size={12} /> {station.key === 'EXCEPTIONS' ? 'Ngoại lệ không dùng checklist riêng' : 'Bước này đã đủ tài liệu bắt buộc'}</p>}
      {station.key === 'EXCEPTIONS' && <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-[9px] leading-4 text-amber-900"><AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-700" /><span className="min-w-0"><b>Lý do ngoại lệ:</b> {exceptionReason || 'Chưa ghi nhận lý do ngoại lệ'}</span></div>}
      <div className="mt-3 grid gap-1.5">
        <button type="button" onClick={() => onOpenDossier(dossier, focusNode ? undefined : getPcnDossierStationTab(station.key))} title={focusNode ? 'Mở lưu trình hồ sơ' : station.actionLabel} className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-100">Mở hồ sơ: {focusNode?.label || station.actionLabel}</button>
      </div>
    </article>
  );
}

function DossierPipelineRow({ dossier, proposal, requirements, documents, workflowTasks, users, currentUser, overdue, claimDenial, claiming, assigning, onClaimDossier, onAssignDossier, onOpenDossier }: Parameters<typeof DossierPipelineCard>[0]) {
  const completeness = buildPcnDossierCompleteness({ dossier, proposal, requirements, documents });
  const station = getPcnWorkflowStage(dossier.status) || getPcnPipelineStation(dossier.status);
  const focusNode = getPcnWorkflowFocusNode(dossier.workflowSnapshot, workflowTasks.filter((task) => task.dossierId === dossier.id));
  const focusNodeStatusLabel = focusNode ? WORKFLOW_NODE_STATUS_LABELS[focusNode.status] || focusNode.status : '';
  const snapshot = getPcnDossierCustomerSnapshot(dossier, proposal);
  const codeReview = completeness.codeReview;
  const missing = completeness.missingRequiredByStage.length > 0 ? missingDocumentSummary(completeness) : '';
  return <tr className="align-top transition-colors hover:bg-emerald-50/30">
    <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-3 text-left font-normal"><button type="button" aria-label={`Mở hồ sơ ${dossier.dossierCode}`} onClick={() => onOpenDossier(dossier, focusNode ? undefined : getPcnDossierStationTab(station.key))} className="min-w-[170px] text-left"><span className="font-mono text-[11px] font-black text-slate-800">{dossier.dossierCode}</span><span className="mt-1 block truncate text-[10px] font-bold text-slate-700">{snapshot?.name || 'Chưa gắn khách hàng'}</span><span className="mt-1 block truncate text-[9px] text-slate-500">{proposal?.productName || 'Chưa có sản phẩm'}{proposal?.model ? ` · ${proposal.model}` : ''}</span></button></th>
    <td className="max-w-[220px] px-3 py-3"><p className="truncate text-[9px] text-slate-500" title={codeReview.source || 'Chưa có mã nguồn PCN'}>Mã nguồn: {codeReview.source || 'Chưa có'}</p><p className={`mt-1 text-[9px] font-bold ${codeReview.needsReview ? 'text-amber-700' : 'text-slate-500'}`}>{codeReview.needsReview ? 'Cần đối chiếu mã nguồn' : codeReview.normalized}</p></td>
    <td className="max-w-[230px] px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${overdue ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-indigo-200 bg-indigo-50 text-indigo-700'}`}>{overdue ? 'Quá hạn' : getPcnDossierStatusLabel(dossier.status)}</span><p className="mt-1 font-bold text-slate-700">{focusNode?.label || 'Chưa khởi tạo lưu trình'}</p><p className="mt-1 text-[9px] text-slate-500">{focusNode ? `Bước ${focusNodeStatusLabel}` : station.actionLabel} · Hạn {formatDate(dossier.targetDate)}</p></td>
    <td className="whitespace-nowrap px-3 py-3"><span className={`font-black ${completeness.score < 70 ? 'text-amber-700' : 'text-emerald-700'}`}>{completeness.score}%</span><div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200" aria-label={`Mức hoàn thiện ${completeness.score}%`}><div className={`h-full rounded-full ${completeness.score < 50 ? 'bg-rose-500' : completeness.score < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${completeness.score}%` }} /></div><p className="mt-1 text-[9px] text-slate-500">Bước {completeness.stationDocumentPresent}/{completeness.stationDocumentTotal}</p></td>
    <td className="max-w-[280px] px-3 py-3">{completeness.missingCoreLabels.length > 0 && <p className="flex items-start gap-1 text-[9px] text-amber-800"><FileWarning size={12} className="mt-0.5 shrink-0" />Thiếu thông tin: {completeness.missingCoreLabels.join(', ')}</p>}{missing && <p className="mt-1 flex items-start gap-1 text-[9px] text-rose-700"><FileWarning size={12} className="mt-0.5 shrink-0" /><span className="truncate" title={missing}>Thiếu bắt buộc: {missing}</span></p>}{!missing && completeness.missingCoreLabels.length === 0 && <p className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700"><CheckCircle2 size={12} />Đủ tài liệu bắt buộc</p>}</td>
    <td className="min-w-[190px] px-3 py-3"><span className="mb-1 inline-flex items-center gap-1 text-[9px] font-bold text-slate-600"><CircleUserRound size={12} className="text-emerald-600" />{userLabel(dossier.ownerUsername, users)}</span><PcnDossierAssignmentControl dossier={dossier} users={users} currentUser={currentUser} onClaim={onClaimDossier ? () => onClaimDossier(dossier) : undefined} onAssign={onAssignDossier} claimDenial={claimDenial} disabled={assigning || claiming} compact /></td>
    <td className="px-3 py-3 text-right"><button type="button" onClick={() => onOpenDossier(dossier, focusNode ? undefined : getPcnDossierStationTab(station.key))} title={focusNode ? 'Mở lưu trình hồ sơ' : station.actionLabel} className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[10px] font-black text-emerald-700 hover:bg-emerald-100">Mở hồ sơ</button></td>
  </tr>;
}

export function PcnPipelineBoard({ dossiers, proposals, fields, requirements, documents, workflowTasks = [], users, currentUser, onClaimDossier, onAssignDossier, onOpenDossier }: {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  fields: PcnCertificationField[];
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  workflowTasks?: PcnDossierWorkflowTask[];
  users: PcnUserAccount[];
  currentUser: UserAccount | null;
  onClaimDossier?: (dossier: CertificationDossier) => Promise<void>;
  onAssignDossier?: (dossierId: string, ownerUsername: string) => Promise<void>;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: PcnDossierDetailTab) => void;
}) {
  const [scope, setScope] = useState<BoardScope>('ALL');
  const [fieldFilter, setFieldFilter] = useState('');
  const [claimingDossierId, setClaimingDossierId] = useState<string | null>(null);
  const [assigningDossierId, setAssigningDossierId] = useState<string | null>(null);
  const proposalsById = useMemo(() => new Map(proposals.map((proposal) => [proposal.id, proposal])), [proposals]);
  const overdueIds = useMemo(() => new Set(buildPcnWorkQueueRows({ dossiers, proposals }).filter((row) => row.priority === 'OVERDUE').map((row) => row.dossierId)), [dossiers, proposals]);
  const boardFieldCodes = useMemo(() => [...new Set([...fields.filter((field) => field.active).map((field) => field.code), ...dossiers.flatMap((dossier) => dossier.fieldCodes)])], [dossiers, fields]);
  const fieldLabels = useMemo(() => new Map(fields.map((field) => [field.code, field.name])), [fields]);
  const fieldScopedDossiers = useMemo(() => filterPcnDossiersByField(dossiers, fieldFilter), [dossiers, fieldFilter]);
  const visibleDossiers = useMemo(() => fieldScopedDossiers.filter((dossier) => {
    if (scope === 'MINE') return normalizeUsername(dossier.ownerUsername) === normalizeUsername(currentUser?.username);
    if (scope === 'OVERDUE') return overdueIds.has(dossier.id);
    return true;
  }), [currentUser?.username, fieldScopedDossiers, overdueIds, scope]);
  const mineCount = fieldScopedDossiers.filter((dossier) => normalizeUsername(dossier.ownerUsername) === normalizeUsername(currentUser?.username)).length;
  const overdueCount = fieldScopedDossiers.filter((dossier) => overdueIds.has(dossier.id)).length;
  const getClaimDenial = (dossier: CertificationDossier): string | null => {
    if (!currentUser) return 'Chưa xác định người dùng hiện tại.';
    return getPcnOwnerAssignmentAuthorityDenial({
      currentUsername: dossier.ownerUsername,
      nextUsername: currentUser.username,
      actorUsername: currentUser.username,
      actorSystemRole: currentUser.systemRole || currentUser.role,
      actorManagementRoleCode: currentUser.managementRoleCode,
      actorDepartmentRoleCode: currentUser.departmentRoleCode,
    }) || getPcnDossierAssignmentDenial({
      assignmentLabel: 'Chủ hồ sơ',
      currentUsername: dossier.ownerUsername,
      nextUsername: currentUser.username,
      dossierFieldCodes: dossier.fieldCodes,
      users,
    });
  };
  const claimDossier = async (dossier: CertificationDossier) => {
    if (!onClaimDossier || dossier.ownerUsername || claimingDossierId || getClaimDenial(dossier)) return;
    setClaimingDossierId(dossier.id);
    try {
      await onClaimDossier(dossier);
    } finally {
      setClaimingDossierId(null);
    }
  };
  const assignDossier = async (dossierId: string, ownerUsername: string) => {
    if (!onAssignDossier || assigningDossierId) return;
    setAssigningDossierId(dossierId);
    try {
      await onAssignDossier(dossierId, ownerUsername);
    } finally {
      setAssigningDossierId(null);
    }
  };

  return (
    <section className="pcn-page-surface min-w-0 w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700"><ClipboardList size={17} /></span>
          <div><h2 className="text-sm font-black text-slate-800" aria-label="Hồ sơ cần hoàn thiện">Hồ sơ theo lưu trình</h2><p className="mt-0.5 text-[10px] text-slate-400">Mỗi dòng hiển thị bước đang xử lý, mức hoàn thiện và tài liệu cần thực hiện của một hồ sơ.</p></div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          {([{ value: 'ALL', label: 'Tất cả' }, { value: 'MINE', label: `Chủ hồ sơ của tôi${mineCount ? ` (${mineCount})` : ''}` }, { value: 'OVERDUE', label: `Quá hạn${overdueCount ? ` (${overdueCount})` : ''}` }] as Array<{ value: BoardScope; label: string }>).map((item) => <button key={item.value} type="button" onClick={() => setScope(item.value)} className={`min-h-11 rounded-lg border px-2.5 py-1.5 ${scope === item.value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>{item.label}</button>)}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold" role="group" aria-label="Lọc theo Lĩnh vực"><span className="mr-1 text-slate-500">Lĩnh vực:</span><button type="button" onClick={() => setFieldFilter('')} aria-pressed={fieldFilter === ''} className={`min-h-11 rounded-lg border px-2.5 py-1.5 ${fieldFilter === '' ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'}`}>Tất cả Lĩnh vực</button>{boardFieldCodes.map((code) => <button key={code} type="button" onClick={() => setFieldFilter(code)} aria-pressed={fieldFilter === code} className={`min-h-11 rounded-lg border px-2.5 py-1.5 ${fieldFilter === code ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-200'}`}>{fieldLabels.get(code) || code}</button>)}</div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div><h3 className="text-xs font-black text-slate-800">Danh sách hồ sơ</h3><p className="mt-0.5 text-[9px] text-slate-400">{visibleDossiers.length} hồ sơ trong phạm vi đang xem</p></div>
      </div>
      {visibleDossiers.length === 0 ? <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center text-[10px] text-slate-400">Chưa có hồ sơ phù hợp với phạm vi đang xem.</p> : <div className="mobile-scroll-x mt-3 min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white"><table aria-label="Bảng hồ sơ theo lưu trình" className="w-full min-w-[1180px] border-collapse text-left text-[10px]"><caption className="sr-only">Danh sách hồ sơ PCN theo lưu trình</caption><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500"><tr><th scope="col" className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3">Hồ sơ</th><th scope="col" className="border-b border-slate-200 px-3 py-3">Mã nguồn</th><th scope="col" className="border-b border-slate-200 px-3 py-3">Trạng thái / Bước hiện tại</th><th scope="col" className="border-b border-slate-200 px-3 py-3">Hoàn thiện</th><th scope="col" className="border-b border-slate-200 px-3 py-3">Tài liệu cần xử lý</th><th scope="col" className="border-b border-slate-200 px-3 py-3">Chủ hồ sơ</th><th scope="col" className="border-b border-slate-200 px-3 py-3 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleDossiers.map((dossier) => <DossierPipelineRow key={dossier.id} dossier={dossier} proposal={proposalsById.get(dossier.proposalId)} requirements={requirements} documents={documents} workflowTasks={workflowTasks} users={users} currentUser={currentUser} overdue={overdueIds.has(dossier.id)} claimDenial={getClaimDenial(dossier)} claiming={claimingDossierId === dossier.id} assigning={assigningDossierId === dossier.id} onClaimDossier={onClaimDossier ? claimDossier : undefined} onAssignDossier={onAssignDossier ? (ownerUsername) => assignDossier(dossier.id, ownerUsername) : undefined} onOpenDossier={onOpenDossier} />)}</tbody></table></div>}
      <p className="mt-3 inline-flex items-center gap-1 text-[9px] text-slate-400"><UserRound size={11} /> Nhân viên có thể bấm “Nhận hồ sơ” để tự gán tên mình; Quản trị viên/Quản lý chọn người thực hiện trong danh sách. Chủ hồ sơ chịu trách nhiệm từ Đề nghị đến đóng gói và lưu trữ.</p>
    </section>
  );
}

export default PcnPipelineBoard;

// --- End of PcnPipelineBoard.tsx ---
