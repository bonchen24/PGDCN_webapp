'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Award,
  ClipboardCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  FolderOpen,
  PlusCircle,
  X,
} from 'lucide-react';

import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getPgdcnDashboardProjection,
  getPgdcnDashboardStatusLabel,
  getPgdcnMyWorkProjection,
  type PgdcnMyWorkItem,
} from '@/utils/pgdcnDashboard';
import { CreatePcnProposalDialog } from './create-pcn-proposal-dialog';
import { CreatePgdRequestDialog } from './create-pgd-request-dialog';

type KpiFilterType = 'ALL' | 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'OVERDUE';

function getPcnStatusBadgeClass(status: string) {
  switch (status) {
    case 'INTAKE_REVIEW':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'TECHNICAL_REVIEW':
    case 'DOCUMENT_VERIFICATION':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'SAMPLING':
    case 'TESTING':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'APPROVAL_PENDING':
    case 'LEADER_APPROVAL':
    case 'DIRECTOR_APPROVAL':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'ISSUANCE':
    case 'COMPLETED':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
}

function getPgdStatusBadgeClass(status: string) {
  switch (status) {
    case 'CAPABILITY_REVIEW':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'FIELD_INSPECTION':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'WAITING_LAB_RESULTS':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'REPORT_APPROVAL':
    case 'CERTIFICATE_APPROVAL':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
}

export default function WorkspaceDashboard() {
  const router = useRouter();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();

  const [openPcnCreate, setOpenPcnCreate] = useState(false);
  const [openPgdCreate, setOpenPgdCreate] = useState(false);
  const [activeFilter, setActiveFilter] = useState<KpiFilterType>('ALL');

  const scopes = currentUser?.departmentScopes || ['PCN', 'PGD'];
  const hasPcn = scopes.length === 0 || scopes.includes('PCN') || currentUser?.systemRole === 'admin';
  const hasPgd = scopes.length === 0 || scopes.includes('PGD') || currentUser?.systemRole === 'admin';

  const projection = useMemo(() => {
    return getPgdcnDashboardProjection({
      scopes,
      pcnDossiers: pcn.dossiers,
      pgdRequests: pgd.requests,
    });
  }, [scopes, pcn.dossiers, pgd.requests]);

  const myWork = useMemo(() => {
    if (!currentUser) return null;
    return getPgdcnMyWorkProjection({
      scopes,
      currentUser,
      pcnDossiers: pcn.dossiers,
      pcnProposals: pcn.proposals,
      pcnWorkflowTasks: pcn.workflowTasks,
      pgdRequests: pgd.requests,
      pgdAssignments: pgd.assignments,
    });
  }, [currentUser, scopes, pcn.dossiers, pcn.proposals, pcn.workflowTasks, pgd.requests, pgd.assignments]);

  const kpis = projection.kpis;
  const rawMyWorkItems: PgdcnMyWorkItem[] = myWork?.items || [];

  const handleToggleFilter = (filter: KpiFilterType) => {
    setActiveFilter((prev) => (prev === filter ? 'ALL' : filter));
  };

  const filteredMyWorkItems = useMemo(() => {
    return rawMyWorkItems.filter((item) => {
      if (activeFilter === 'ALL' || activeFilter === 'IN_PROGRESS') return true;
      if (activeFilter === 'AWAITING_APPROVAL') {
        return item.status.includes('APPROVAL') || item.status.includes('REVIEW');
      }
      if (activeFilter === 'OVERDUE') {
        return item.isOverdue;
      }
      return true;
    });
  }, [rawMyWorkItems, activeFilter]);

  // De-duplicate: exclude dossiers already shown in the top "Việc của tôi" table when under 10 items
  const myWorkKeySet = useMemo(
    () => new Set(filteredMyWorkItems.slice(0, 8).map((item) => `${item.domain}:${item.id}`)),
    [filteredMyWorkItems]
  );

  const filteredPcnDossiers = useMemo(() => {
    return pcn.dossiers.filter((dossier) => {
      if (activeFilter === 'IN_PROGRESS' && ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(dossier.status)) {
        return false;
      }
      if (
        activeFilter === 'AWAITING_APPROVAL' &&
        !['APPROVAL_PENDING', 'LEADER_APPROVAL', 'DIRECTOR_APPROVAL', 'INTAKE_REVIEW'].includes(dossier.status)
      ) {
        return false;
      }
      if (
        activeFilter === 'OVERDUE' &&
        !rawMyWorkItems.some((item) => item.domain === 'PCN' && item.id === dossier.id && item.isOverdue)
      ) {
        return false;
      }
      return !myWorkKeySet.has(`PCN:${dossier.id}`);
    });
  }, [pcn.dossiers, activeFilter, rawMyWorkItems, myWorkKeySet]);

  const filteredPgdRequests = useMemo(() => {
    return pgd.requests.filter((request) => {
      if (request.deletedAt) return false;
      if (activeFilter === 'IN_PROGRESS' && ['COMPLETED', 'REJECTED', 'CANCELLED'].includes(request.status)) {
        return false;
      }
      if (
        activeFilter === 'AWAITING_APPROVAL' &&
        !['REPORT_APPROVAL', 'CERTIFICATE_APPROVAL', 'CAPABILITY_REVIEW'].includes(request.status)
      ) {
        return false;
      }
      if (
        activeFilter === 'OVERDUE' &&
        !rawMyWorkItems.some((item) => item.domain === 'PGD' && item.id === request.id && item.isOverdue)
      ) {
        return false;
      }
      return !myWorkKeySet.has(`PGD:${request.id}`);
    });
  }, [pgd.requests, activeFilter, rawMyWorkItems, myWorkKeySet]);

  const filterLabels: Record<KpiFilterType, string> = {
    ALL: 'Tất cả',
    IN_PROGRESS: 'Đang xử lý',
    AWAITING_APPROVAL: 'Chờ duyệt',
    OVERDUE: 'Quá hạn',
  };

  return (
    <div className="space-y-2.5 p-2.5 md:p-3.5">
      {/* Compact Top Strip: 4 KPI Filter Buttons + Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-2xs">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5 sm:grid-cols-4">
          <button
            type="button"
            aria-pressed={activeFilter === 'ALL'}
            onClick={() => handleToggleFilter('ALL')}
            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
              activeFilter === 'ALL'
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 hover:bg-slate-100/70'
            }`}
          >
            <div className="min-w-0">
              <div className={`truncate text-[10px] font-bold uppercase tracking-wider ${activeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
                Tổng tiếp nhận
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black leading-tight">{kpis.pcnDossiers + kpis.pgdRequests}</span>
                <span className={`truncate text-[10px] ${activeFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
                  {hasPcn ? `PCN ${kpis.pcnDossiers}` : ''}
                  {hasPcn && hasPgd ? ' · ' : ''}
                  {hasPgd ? `PGD ${kpis.pgdRequests}` : ''}
                </span>
              </div>
            </div>
            <CheckCircle2 className={`h-4 w-4 shrink-0 ${activeFilter === 'ALL' ? 'text-emerald-400' : 'text-slate-400'}`} />
          </button>

          <button
            type="button"
            aria-pressed={activeFilter === 'IN_PROGRESS'}
            onClick={() => handleToggleFilter('IN_PROGRESS')}
            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
              activeFilter === 'IN_PROGRESS'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500/30'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
            }`}
          >
            <div className="min-w-0">
              <div className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">Đang xử lý</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black leading-tight text-emerald-700">{kpis.inProgress}</span>
                <span className="truncate text-[10px] text-slate-500">
                  {hasPcn ? `PCN ${kpis.pcnWork}` : ''}
                  {hasPcn && hasPgd ? ' · ' : ''}
                  {hasPgd ? `PGD ${kpis.pgdWork}` : ''}
                </span>
              </div>
            </div>
            <FolderOpen className="h-4 w-4 shrink-0 text-emerald-600" />
          </button>

          <button
            type="button"
            aria-pressed={activeFilter === 'AWAITING_APPROVAL'}
            onClick={() => handleToggleFilter('AWAITING_APPROVAL')}
            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
              activeFilter === 'AWAITING_APPROVAL'
                ? 'border-amber-500 bg-amber-50 text-amber-950 ring-1 ring-amber-500/30'
                : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'
            }`}
          >
            <div className="min-w-0">
              <div className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">Chờ phê duyệt</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black leading-tight text-amber-700">{kpis.awaitingApproval}</span>
                <span className="truncate text-[10px] text-slate-500">cần duyệt</span>
              </div>
            </div>
            <Clock className="h-4 w-4 shrink-0 text-amber-600" />
          </button>

          <button
            type="button"
            aria-pressed={activeFilter === 'OVERDUE'}
            onClick={() => handleToggleFilter('OVERDUE')}
            className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
              activeFilter === 'OVERDUE'
                ? 'border-rose-500 bg-rose-50 text-rose-950 ring-1 ring-rose-500/30'
                : 'border-slate-200 bg-white text-slate-700 hover:border-rose-300'
            }`}
          >
            <div className="min-w-0">
              <div className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">Quá hạn / Chú ý</div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-base font-black leading-tight ${kpis.overdue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {kpis.overdue}
                </span>
                <span className="truncate text-[10px] text-slate-500">chú ý {kpis.attention}</span>
              </div>
            </div>
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {activeFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <X className="h-3 w-3" />
              {filterLabels[activeFilter]}
            </button>
          )}
          {hasPcn && (
            <Button
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 text-[11px] shadow-2xs cursor-pointer"
              onClick={() => setOpenPcnCreate(true)}
            >
              <PlusCircle className="mr-1 h-3.5 w-3.5" />
              Đề nghị PCN
            </Button>
          )}
          {hasPgd && (
            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 text-[11px] shadow-2xs cursor-pointer"
              onClick={() => setOpenPgdCreate(true)}
            >
              <PlusCircle className="mr-1 h-3.5 w-3.5" />
              PYC PGD
            </Button>
          )}
        </div>
      </div>

      {/* High-Density "Việc của tôi" Table (De-duplicated from domain lists below) */}
      {filteredMyWorkItems.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden" aria-label="Việc của tôi cần xử lý">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black text-slate-900">Việc của tôi cần xử lý</h2>
              <span className="rounded-full bg-slate-200/80 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                {filteredMyWorkItems.length}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">Ưu tiên theo hạn cam kết & phân công trực tiếp</span>
          </div>
          <div className="mobile-scroll-x overflow-x-auto">
            <table className="w-full border-collapse text-left text-[11px]">
              <thead className="border-b border-slate-100 bg-slate-50/40 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-1.5 pl-3 pr-2 w-36">Mã hồ sơ</th>
                  <th className="px-2 py-1.5">Khách hàng</th>
                  <th className="px-2 py-1.5 w-40">Trạng thái</th>
                  <th className="px-2 py-1.5 w-44">Việc tiếp theo</th>
                  <th className="py-1.5 pl-2 pr-3 text-right w-16">Mở</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMyWorkItems.slice(0, 8).map((item) => {
                  const isPcn = item.domain === 'PCN';
                  const href = isPcn ? `/pcn/dossiers/${item.id}` : `/pgd/dossiers/${item.id}`;
                  return (
                    <tr
                      key={`${item.domain}-${item.id}`}
                      onClick={() => router.push(href)}
                      className="group cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="py-1.5 pl-3 pr-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block rounded px-1 py-0.2 text-[9px] font-black ${
                              isPcn ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {item.domain}
                          </span>
                          <Link
                            href={href}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[11px] font-bold text-slate-900 hover:underline"
                          >
                            {item.label}
                          </Link>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 max-w-[260px] truncate font-medium text-slate-700" title={item.customerName}>
                        {item.customerName}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <Badge
                          variant={item.isOverdue ? 'destructive' : 'outline'}
                          className="text-[10px] px-1.5 py-0 font-semibold"
                        >
                          {item.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap font-semibold text-slate-800">
                        {item.nextAction.label}
                      </td>
                      <td className="py-1.5 pl-2 pr-3 text-right">
                        <ArrowRight className="inline h-3.5 w-3.5 text-slate-400 group-hover:text-slate-800" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* High-Density Dual Domain Tables: PCN & PGD (Up to 10 rows each, no duplicate stat boxes) */}
      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {hasPcn && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden" aria-label="Hồ sơ Chứng nhận PCN">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-emerald-50/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-700 shrink-0" />
                <h2 className="text-xs font-black text-slate-900">Chứng nhận · PCN</h2>
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                  {filteredPcnDossiers.length}/{pcn.dossiers.length}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <Link href="/pcn?tab=operations" className="text-slate-600 hover:text-emerald-700 hover:underline">
                  Sổ tổng hợp ({pcn.proposals.length})
                </Link>
                <span className="text-slate-300">·</span>
                <Link href="/pcn?tab=samples" className="text-slate-600 hover:text-emerald-700 hover:underline">
                  Mẫu ({pcn.sampleLots.length})
                </Link>
                <span className="text-slate-300">·</span>
                <Link href="/pcn" className="inline-flex items-center gap-0.5 font-bold text-emerald-700 hover:underline">
                  Hàng đợi <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {filteredPcnDossiers.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-slate-400">
                Không có hồ sơ PCN khác ngoài danh sách việc của tôi.
              </div>
            ) : (
              <div className="mobile-scroll-x overflow-x-auto">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-1.5 pl-3 pr-2 w-32">Mã hồ sơ</th>
                      <th className="px-2 py-1.5">Khách hàng</th>
                      <th className="py-1.5 pl-2 pr-3 text-right w-36">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPcnDossiers.slice(0, 10).map((dossier) => (
                      <tr
                        key={dossier.id}
                        onClick={() => router.push(`/pcn/dossiers/${dossier.id}`)}
                        className="group cursor-pointer transition-colors hover:bg-emerald-50/30"
                      >
                        <td className="py-1.5 pl-3 pr-2 whitespace-nowrap">
                          <Link
                            href={`/pcn/dossiers/${dossier.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[11px] font-bold text-emerald-800 hover:underline"
                          >
                            {dossier.dossierCode}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 max-w-[220px] truncate text-slate-700 font-medium" title={dossier.customerSnapshot?.name}>
                          {dossier.customerSnapshot?.name || 'Khách hàng'}
                        </td>
                        <td className="py-1.5 pl-2 pr-3 text-right whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 font-semibold ${getPcnStatusBadgeClass(dossier.status)}`}
                          >
                            {getPgdcnDashboardStatusLabel('PCN', dossier.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {hasPgd && (
          <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden" aria-label="Phiếu yêu cầu Giám định PGD">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-blue-50/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-blue-700 shrink-0" />
                <h2 className="text-xs font-black text-slate-900">Giám định · PGD</h2>
                <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-800">
                  {filteredPgdRequests.length}/{pgd.requests.filter((r) => !r.deletedAt).length}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <Link href="/pgd?tab=operations" className="text-slate-600 hover:text-blue-700 hover:underline">
                  Sổ tổng hợp ({pgd.assignments.length})
                </Link>
                <span className="text-slate-300">·</span>
                <Link href="/pgd?tab=samples" className="text-slate-600 hover:text-blue-700 hover:underline">
                  Mẫu ({pgd.samples.length})
                </Link>
                <span className="text-slate-300">·</span>
                <Link href="/pgd" className="inline-flex items-center gap-0.5 font-bold text-blue-700 hover:underline">
                  Hàng đợi <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {filteredPgdRequests.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-slate-400">
                Không có PYC PGD khác ngoài danh sách việc của tôi.
              </div>
            ) : (
              <div className="mobile-scroll-x overflow-x-auto">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-1.5 pl-3 pr-2 w-32">Mã PYC</th>
                      <th className="px-2 py-1.5">Khách hàng</th>
                      <th className="py-1.5 pl-2 pr-3 text-right w-36">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPgdRequests.slice(0, 10).map((request) => (
                      <tr
                        key={request.id}
                        onClick={() => router.push(`/pgd/dossiers/${request.id}`)}
                        className="group cursor-pointer transition-colors hover:bg-blue-50/30"
                      >
                        <td className="py-1.5 pl-3 pr-2 whitespace-nowrap">
                          <Link
                            href={`/pgd/dossiers/${request.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-[11px] font-bold text-blue-800 hover:underline"
                          >
                            {request.requestCode}
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 max-w-[220px] truncate text-slate-700 font-medium" title={request.customerSnapshot?.name}>
                          {request.customerSnapshot?.name || 'Khách hàng'}
                        </td>
                        <td className="py-1.5 pl-2 pr-3 text-right whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 font-semibold ${getPgdStatusBadgeClass(request.status)}`}
                          >
                            {getPgdcnDashboardStatusLabel('PGD', request.status)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {hasPcn && (
        <CreatePcnProposalDialog
          open={openPcnCreate}
          onOpenChange={setOpenPcnCreate}
        />
      )}
      {hasPgd && (
        <CreatePgdRequestDialog
          open={openPgdCreate}
          onOpenChange={setOpenPgdCreate}
        />
      )}
    </div>
  );
}