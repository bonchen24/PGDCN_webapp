'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, ListTodo, UserRound } from 'lucide-react';

import type { CertificationDossier, CertificationProposal, PcnDossierDocument, PcnDocumentRequirement, PcnUserAccount, UserAccount } from '../types';
import { getPcnDossierAssignmentDenial, getPcnOwnerAssignmentAuthorityDenial } from '../utils/pcnDossierAssignment';
import { getPcnDossierStationTab } from '../utils/pcnDossierNavigation';
import { buildPcnWorkQueueRows, filterPcnWorkQueueRows, type PcnWorkQueuePriority, type PcnWorkQueueRow, type PcnWorkQueueScope } from '../utils/pcnWorkQueue';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';

const scopeLabels: Array<{ value: PcnWorkQueueScope; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'MINE', label: 'Việc của tôi' },
  { value: 'OVERDUE', label: 'Quá hạn' },
];

const priorityStyle: Record<PcnWorkQueuePriority, { label: string; className: string }> = {
  OVERDUE: { label: 'Quá hạn', className: 'border-rose-200 bg-rose-50 text-rose-700' },
  DUE_SOON: { label: 'Sắp đến hạn', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  NORMAL: { label: 'Đang xử lý', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

function formatTargetDate(value?: string): string {
  if (!value) return 'Chưa đặt hạn';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa đặt hạn' : date.toLocaleDateString('vi-VN');
}

function assignmentLabel(row: PcnWorkQueueRow): string {
  return row.assigneeUsername ? 'Đã phân công cá nhân' : 'Chưa phân công cá nhân';
}

function dossierOwnerLabel(row: PcnWorkQueueRow, users: PcnUserAccount[]): string {
  return row.ownerUsername ? getPcnUserDisplayName(row.ownerUsername, users) : 'Chưa phân công';
}

function missingDocumentSummary(row: PcnWorkQueueRow): string {
  return row.missingRequiredByStage.map((group) => `${group.label}: ${group.labels.join(', ')}`).join(' · ');
}

function compactMissingSummary(row: PcnWorkQueueRow): string {
  const labels = row.stationMissingLabels.length > 0
    ? row.stationMissingLabels
    : row.missingRequiredByStage.flatMap((group) => group.labels);
  if (labels.length === 0) return 'Đủ tài liệu bắt buộc';
  const visible = labels.slice(0, 2).join(', ');
  return `Tài liệu còn thiếu: ${visible}${labels.length > 2 ? ` và ${labels.length - 2} mục khác` : ''}`;
}

export function PcnWorkQueueView({
  dossiers,
  proposals,
  documentRequirements,
  dossierDocuments,
  users = [],
  currentUser,
  onOpenDossier,
  onClaimDossier,
}: {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  documentRequirements?: PcnDocumentRequirement[];
  dossierDocuments?: PcnDossierDocument[];
  users?: PcnUserAccount[];
  currentUser: UserAccount | null;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab) => void;
  onClaimDossier?: (dossier: CertificationDossier) => Promise<void>;
}) {
  const [scope, setScope] = useState<PcnWorkQueueScope>('ALL');
  const [showAll, setShowAll] = useState(false);
  const [claimingDossierId, setClaimingDossierId] = useState<string | null>(null);
  const rows = useMemo(() => buildPcnWorkQueueRows({ dossiers, proposals, currentUsername: currentUser?.username, documentRequirements, dossierDocuments }), [currentUser?.username, dossierDocuments, documentRequirements, dossiers, proposals]);
  const filteredRows = useMemo(() => filterPcnWorkQueueRows(rows, { scope }), [rows, scope]);
  const visibleRows = showAll ? filteredRows : filteredRows.slice(0, 8);
  const overdueCount = rows.filter((row) => row.priority === 'OVERDUE').length;
  const mineCount = rows.filter((row) => row.assignedToCurrentUser).length;
  const getClaimDenial = (dossier: CertificationDossier): string | null => {
    if (!currentUser) return 'Chưa xác định người dùng hiện tại.';
    return getPcnOwnerAssignmentAuthorityDenial({
      currentUsername: dossier.ownerUsername,
      nextUsername: currentUser.username,
      actorUsername: currentUser.username,
      actorSystemRole: currentUser.systemRole || currentUser.role,
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

  return (
    <section data-testid="pcn-work-queue" className="pcn-page-surface min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ListTodo size={17} /></span>
          <div><h2 className="text-sm font-black text-slate-800">Hàng đợi cần xử lý</h2><p className="mt-0.5 text-[10px] text-slate-400">Hàng đợi là projection gọn để ưu tiên; mở card Kanban hoặc hồ sơ chuẩn khi cần xem chi tiết.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          {scopeLabels.map((item) => <button key={item.value} type="button" onClick={() => setScope(item.value)} className={`min-h-11 rounded-lg border px-2.5 py-1.5 transition-colors ${scope === item.value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>{item.label}{item.value === 'MINE' && mineCount > 0 ? ` (${mineCount})` : ''}{item.value === 'OVERDUE' && overdueCount > 0 ? ` (${overdueCount})` : ''}</button>)}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-[11px] text-slate-500"><CheckCircle2 size={16} className="text-emerald-500" /> Không có việc phù hợp với bộ lọc hiện tại.</div>
      ) : (
        <div className="mt-3 space-y-2">
          {visibleRows.map((row) => {
            const priority = priorityStyle[row.priority];
            const dossier = dossiers.find((item) => item.id === row.dossierId);
            if (!dossier) return null;
            return (
              <article key={row.dossierId} data-testid="pcn-work-queue-row" data-missing-core={row.missingCoreLabels.join(', ')} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/20">
                <button type="button" aria-label={`Mở hồ sơ ${row.dossierCode}`} onClick={() => onOpenDossier(dossier)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] font-black text-slate-700">{row.dossierCode}</span><span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${priority.className}`}>{priority.label}</span><span className="rounded-full border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black text-indigo-700">Bước {row.stationNumber ? `${row.stationNumber} · ` : ''}{row.stationTitle}</span>{row.assignedToCurrentUser && <span className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[9px] font-black">Của tôi</span>}</div>
                  <p className="mt-1 text-[11px] font-black text-slate-800">{row.stepLabel}</p>
                  <p className="truncate text-[10px] text-slate-500">{row.customerName} · {row.productName}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[9px] font-bold"><span className={`rounded-full px-1.5 py-0.5 ${row.completenessScore < 70 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>Mức hoàn thiện {row.completenessScore}%</span><span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-indigo-700">Điểm bước {row.stationScore === null || row.stationScore === undefined ? 'Không áp dụng' : `${row.stationScore}%`}</span><span className={row.missingRequiredCount > 0 ? 'text-rose-700' : 'text-emerald-700'}>{row.requiredDocumentPresent}/{row.requiredDocumentTotal} bắt buộc</span><span className={row.missingRequiredCount > 0 ? 'max-w-[340px] truncate text-rose-700' : 'text-emerald-700'} title={row.missingRequiredCount > 0 ? `Tài liệu bắt buộc còn thiếu: ${missingDocumentSummary(row)}` : undefined}>{compactMissingSummary(row)}</span></div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] text-slate-500"><span className="inline-flex items-center gap-1" title="Hạn xử lý"><Clock3 size={12} />{formatTargetDate(row.targetDate)}</span><span className="max-w-[220px] truncate" title="Chủ hồ sơ chịu trách nhiệm xuyên suốt">Chủ hồ sơ: {dossierOwnerLabel(row, users)}</span><span title="Nhóm và trạng thái phân công">Phụ trách: {assignmentLabel(row)}</span></div>
                {onClaimDossier && !dossier.ownerUsername && !getClaimDenial(dossier) && <button type="button" aria-label={`Nhận hồ sơ ${row.dossierCode}`} onClick={() => { void claimDossier(dossier).catch(() => undefined); }} disabled={claimingDossierId === dossier.id} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"><UserRound size={12} /> {claimingDossierId === dossier.id ? 'Đang nhận…' : 'Nhận hồ sơ'}</button>}
                <button type="button" aria-label={`Mở hồ sơ tại bước · ${row.stationActionLabel}`} onClick={() => onOpenDossier(dossier, getPcnDossierStationTab(row.stationKey))} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700" title={`Mở ${row.stationActionLabel}`}><ExternalLink size={12} /> Mở bước này</button>
              </article>
            );
          })}
          {filteredRows.length > 8 && <div className="flex flex-col items-center gap-1 pt-1"><button type="button" onClick={() => setShowAll((value) => !value)} className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100">{showAll ? 'Xem ít' : `Xem tất cả (${filteredRows.length})`}</button>{!showAll && <p className="text-[10px] font-bold text-slate-400">Còn {filteredRows.length - 8} việc khác</p>}</div>}
        </div>
      )}
      {overdueCount > 0 && <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-rose-600"><AlertTriangle size={12} /> Có {overdueCount} hồ sơ quá hạn cần ưu tiên.</div>}
    </section>
  );
}

export default PcnWorkQueueView;
