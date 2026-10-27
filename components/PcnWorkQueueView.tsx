'use client';

import { formatDateDdMmYyyy } from '../utils/formatter';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, ListTodo } from 'lucide-react';

import type { CertificationDossier, CertificationProposal, PcnDossierDocument, PcnDossierWorkflowTask, PcnDocumentRequirement, PcnUserAccount, UserAccount } from '../types';
import { getPcnDossierAssignmentDenial, getPcnOwnerAssignmentAuthorityDenial } from '../utils/pcnDossierAssignment';
import { getPcnDossierStationTab } from '../utils/pcnDossierNavigation';
import { buildPcnWorkQueueRows, filterPcnWorkQueueRows, type PcnWorkQueuePriority, type PcnWorkQueueRow, type PcnWorkQueueScope } from '../utils/pcnWorkQueue';
import PcnDossierAssignmentControl from './PcnDossierAssignmentControl';

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
  return formatDateDdMmYyyy(value) || 'Chưa đặt hạn';
}

function assignmentLabel(row: PcnWorkQueueRow): string {
  return row.assigneeUsername ? 'Đã phân công cá nhân' : 'Chưa phân công cá nhân';
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
  workflowTasks = [],
  users = [],
  currentUser,
  onOpenDossier,
  onClaimDossier,
  onAssignDossier,
}: {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  documentRequirements?: PcnDocumentRequirement[];
  dossierDocuments?: PcnDossierDocument[];
  workflowTasks?: PcnDossierWorkflowTask[];
  users?: PcnUserAccount[];
  currentUser: UserAccount | null;
  onOpenDossier: (dossier: CertificationDossier, initialTab?: import('../utils/pcnDossierNavigation').PcnDossierDetailTab) => void;
  onClaimDossier?: (dossier: CertificationDossier) => Promise<void>;
  onAssignDossier?: (dossierId: string, ownerUsername: string) => Promise<void>;
}) {
  const [scope, setScope] = useState<PcnWorkQueueScope>('ALL');
  const [showAll, setShowAll] = useState(false);
  const [claimingDossierId, setClaimingDossierId] = useState<string | null>(null);
  const [assigningDossierId, setAssigningDossierId] = useState<string | null>(null);
  const rows = useMemo(() => buildPcnWorkQueueRows({ dossiers, proposals, currentUsername: currentUser?.username, documentRequirements, dossierDocuments, workflowTasks }), [currentUser?.username, dossierDocuments, documentRequirements, dossiers, proposals, workflowTasks]);
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
    <section data-testid="pcn-work-queue" className="pcn-page-surface min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><ListTodo size={17} /></span>
          <div><h2 className="text-sm font-black text-slate-800">Hàng đợi cần xử lý</h2>{/* Hàng đợi là projection gọn */}<p className="mt-0.5 text-[10px] text-slate-400">Hàng đợi là dữ liệu tổng hợp gọn để ưu tiên; mở hồ sơ chuẩn khi cần xem chi tiết.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          {scopeLabels.map((item) => <button key={item.value} type="button" onClick={() => setScope(item.value)} className={`min-h-11 rounded-lg border px-2.5 py-1.5 transition-colors ${scope === item.value ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}>{item.label}{item.value === 'MINE' && mineCount > 0 ? ` (${mineCount})` : ''}{item.value === 'OVERDUE' && overdueCount > 0 ? ` (${overdueCount})` : ''}</button>)}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-[11px] text-slate-500"><CheckCircle2 size={16} className="text-emerald-500" /> Không có việc phù hợp với bộ lọc hiện tại.</div>
      ) : (
        <div className="mobile-scroll-x mt-3 min-w-0 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table aria-label="Bảng hàng đợi cần xử lý" className="w-full min-w-[1180px] border-collapse text-left text-[10px]">
            <caption className="sr-only">Danh sách việc cần xử lý của các hồ sơ PCN</caption>
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="sticky left-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-3">Hồ sơ</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-3">Ưu tiên</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-3">Bước hiện tại</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-3">Khách hàng / Sản phẩm</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-3">Hoàn thiện</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-3">Tài liệu</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-3">Hạn xử lý</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-3">Chủ hồ sơ</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => {
                const priority = priorityStyle[row.priority];
                const dossier = dossiers.find((item) => item.id === row.dossierId);
                if (!dossier) return null;
                return (
                  <tr key={row.dossierId} data-testid="pcn-work-queue-row" data-missing-core={row.missingCoreLabels.join(', ')} className="align-top transition-colors hover:bg-emerald-50/30">
                    <th scope="row" className="sticky left-0 z-[1] bg-white px-3 py-3 font-normal"><button type="button" aria-label={`Mở hồ sơ ${row.dossierCode}`} onClick={() => onOpenDossier(dossier)} className="min-w-[150px] text-left"><span className="font-mono text-[11px] font-black text-slate-800">{row.dossierCode}</span>{row.assignedToCurrentUser && <span className="ml-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">Của tôi</span>}<span className="mt-1 block text-[9px] text-slate-500">{row.stepLabel}</span></button></th>
                    <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[9px] font-black ${priority.className}`}>{priority.label}</span></td>
                    <td className="max-w-[190px] px-3 py-3"><p className="font-black text-indigo-800">{row.workflowNodeLabel ? `Bước · ${row.workflowNodeLabel}` : `Bước ${row.stationNumber ? `${row.stationNumber} · ` : ''}${row.stationTitle}`}</p><p className="mt-1 text-[9px] text-slate-500">{row.stationActionLabel}</p></td>
                    <td className="max-w-[210px] px-3 py-3"><p className="truncate font-bold text-slate-800" title={row.customerName}>{row.customerName || 'Chưa có khách hàng'}</p><p className="mt-1 truncate text-[9px] text-slate-500" title={row.productName}>{row.productName || 'Chưa có sản phẩm'}</p></td>
                    <td className="whitespace-nowrap px-3 py-3"><span aria-label={`Mức hoàn thiện ${row.completenessScore}%`} className={`font-black ${row.completenessScore < 70 ? 'text-amber-700' : 'text-emerald-700'}`}>{row.completenessScore}%</span><p className="mt-1 text-[9px] text-slate-500">Điểm bước {row.stationScore === null || row.stationScore === undefined ? 'Không áp dụng' : `${row.stationScore}%`}</p></td>
                    <td className="max-w-[280px] px-3 py-3"><p className={row.missingRequiredCount > 0 ? 'font-bold text-rose-700' : 'font-bold text-emerald-700'}>{row.requiredDocumentPresent}/{row.requiredDocumentTotal} bắt buộc</p><p className="mt-1 truncate text-[9px] text-slate-500" title={row.missingRequiredCount > 0 ? `Tài liệu bắt buộc còn thiếu: ${missingDocumentSummary(row)}` : undefined}>{compactMissingSummary(row)}</p></td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700"><span className="inline-flex items-center gap-1"><Clock3 size={12} aria-hidden="true" />{formatTargetDate(row.targetDate)}</span></td>
                    <td className="min-w-[190px] px-3 py-3" data-owner-username={row.ownerUsername || ''} aria-label={!dossier.ownerUsername ? 'Nhận hồ sơ' : 'Người thực hiện hồ sơ'}><PcnDossierAssignmentControl dossier={dossier} users={users} currentUser={currentUser} onClaim={onClaimDossier ? () => claimDossier(dossier) : undefined} onAssign={onAssignDossier ? (ownerUsername) => assignDossier(dossier.id, ownerUsername) : undefined} claimDenial={getClaimDenial(dossier)} disabled={Boolean(assigningDossierId && assigningDossierId !== dossier.id) || claimingDossierId === dossier.id} compact /><span className="sr-only">{claimingDossierId === dossier.id ? 'Đang nhận…' : 'Nhận hồ sơ'}</span><span className="mt-1 block text-[9px] text-slate-500" title="Nhóm và trạng thái phân công">{assignmentLabel(row)}</span></td>
                    <td className="px-3 py-3 text-right"><button type="button" aria-label={`Mở hồ sơ${row.workflowNodeLabel ? ` tại bước · ${row.workflowNodeLabel}` : ` tại bước · ${row.stationActionLabel}`}`} onClick={() => onOpenDossier(dossier, row.workflowNodeLabel ? undefined : getPcnDossierStationTab(row.stationKey))} className="inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700" title={row.workflowNodeLabel ? `Mở bước ${row.workflowNodeLabel}` : `Mở ${row.stationActionLabel}`}><ExternalLink size={12} aria-hidden="true" /> {row.workflowNodeLabel ? 'Mở bước' : 'Mở bước này'}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredRows.length > 8 && <div className="flex flex-col items-center gap-1 border-t border-slate-100 p-2 pt-1"><button type="button" onClick={() => setShowAll((value) => !value)} className="min-h-11 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100">{showAll ? 'Xem ít' : `Xem tất cả (${filteredRows.length})`}</button>{!showAll && <p className="text-[10px] font-bold text-slate-400">Còn {filteredRows.length - 8} việc khác</p>}</div>}
        </div>
      )}
      {overdueCount > 0 && <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-rose-600"><AlertTriangle size={12} /> Có {overdueCount} hồ sơ quá hạn cần ưu tiên.</div>}
    </section>
  );
}

export default PcnWorkQueueView;
