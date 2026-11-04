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
  FileText,
  ArrowRight,
  TrendingUp,
  FolderOpen,
  PlusCircle,
  Filter,
  X,
  Layers,
} from 'lucide-react';

import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getPgdcnDashboardProjection,
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
      return 'bg-purple-50 text-purple-700 border-purple-200';
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
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'WAITING_LAB_RESULTS':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'REPORT_APPROVAL':
    case 'CERTIFICATE_APPROVAL':
      return 'bg-purple-50 text-purple-700 border-purple-200';
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

  // Compute canonical dashboard projection
  const projection = useMemo(() => {
    return getPgdcnDashboardProjection({
      scopes,
      pcnDossiers: pcn.dossiers,
      pgdRequests: pgd.requests,
    });
  }, [scopes, pcn.dossiers, pgd.requests]);

  // Compute My Work projection
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

  // Toggle KPI filter
  const handleToggleFilter = (filter: KpiFilterType) => {
    setActiveFilter((prev) => (prev === filter ? 'ALL' : filter));
  };

  // Filtered PCN dossiers
  const filteredPcnDossiers = useMemo(() => {
    return pcn.dossiers.filter((dossier) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'IN_PROGRESS') {
        return !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(dossier.status);
      }
      if (activeFilter === 'AWAITING_APPROVAL') {
        return ['APPROVAL_PENDING', 'LEADER_APPROVAL', 'DIRECTOR_APPROVAL', 'INTAKE_REVIEW'].includes(dossier.status);
      }
      if (activeFilter === 'OVERDUE') {
        return rawMyWorkItems.some((item) => item.domain === 'PCN' && item.id === dossier.id && item.isOverdue);
      }
      return true;
    });
  }, [pcn.dossiers, activeFilter, rawMyWorkItems]);

  // Filtered PGD requests
  const filteredPgdRequests = useMemo(() => {
    return pgd.requests.filter((request) => {
      if (request.deletedAt) return false;
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'IN_PROGRESS') {
        return !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(request.status);
      }
      if (activeFilter === 'AWAITING_APPROVAL') {
        return ['REPORT_APPROVAL', 'CERTIFICATE_APPROVAL', 'CAPABILITY_REVIEW'].includes(request.status);
      }
      if (activeFilter === 'OVERDUE') {
        return rawMyWorkItems.some((item) => item.domain === 'PGD' && item.id === request.id && item.isOverdue);
      }
      return true;
    });
  }, [pgd.requests, activeFilter, rawMyWorkItems]);

  // Filtered My Work items
  const filteredMyWorkItems = useMemo(() => {
    return rawMyWorkItems.filter((item) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'IN_PROGRESS') {
        return true;
      }
      if (activeFilter === 'AWAITING_APPROVAL') {
        return item.status.includes('APPROVAL') || item.status.includes('REVIEW');
      }
      if (activeFilter === 'OVERDUE') {
        return item.isOverdue;
      }
      return true;
    });
  }, [rawMyWorkItems, activeFilter]);

  const filterLabels: Record<KpiFilterType, string> = {
    ALL: 'Tất cả hồ sơ',
    IN_PROGRESS: 'Hồ sơ đang xử lý',
    AWAITING_APPROVAL: 'Hồ sơ chờ phê duyệt',
    OVERDUE: 'Hồ sơ quá hạn cam kết',
  };

  return (
    <div className="space-y-4 p-3.5 md:p-5">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-r from-emerald-600/10 via-teal-500/5 to-blue-600/10 px-4 py-2.5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white/90 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
              <Layers className="h-3 w-3" />
              Bàn làm việc tổng hợp
            </span>
            <h1 className="text-sm md:text-base font-black tracking-tight text-slate-900 truncate">
              Bàn làm việc Giám định & Chứng nhận
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 truncate">
            Xin chào, <strong className="font-semibold text-slate-800">{currentUser?.name || currentUser?.username}</strong> • Theo dõi chỉ số vận hành và tạo hồ sơ nghiệp vụ.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {hasPcn && (
            <Button
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 text-xs shadow-xs hover:shadow transition-all cursor-pointer"
              onClick={() => setOpenPcnCreate(true)}
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Tạo đề nghị PCN
            </Button>
          )}
          {hasPgd && (
            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 text-xs shadow-xs hover:shadow transition-all cursor-pointer"
              onClick={() => setOpenPgdCreate(true)}
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Tạo phiếu yêu cầu PGD
            </Button>
          )}
        </div>
      </div>

      {/* 4 Interactive KPI Stat Filter Cards */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <Filter className="h-3 w-3 text-slate-400" />
            <span>Chỉ số vận hành · Bấm thẻ để lọc hồ sơ</span>
          </div>
          {activeFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
              Xóa bộ lọc ({filterLabels[activeFilter]})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {/* KPI 1: In Progress (Emerald) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleToggleFilter('IN_PROGRESS')}
            className={`group relative cursor-pointer rounded-xl border bg-white p-2.5 transition-all duration-150 hover:shadow-xs flex items-center gap-3 ${
              activeFilter === 'IN_PROGRESS'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 shadow-xs'
                : 'border-slate-200/90 hover:border-emerald-300'
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <FolderOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Đang xử lý
                </span>
                {activeFilter === 'IN_PROGRESS' && (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-[9px] text-emerald-800 font-bold px-1.5 py-0 h-4">
                    Đang lọc
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black leading-none text-emerald-800">
                  {kpis.inProgress}
                </span>
                <span className="text-[10px] font-medium text-slate-400">hồ sơ toàn phòng</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 truncate">
                {hasPcn && <span>PCN: <strong className="font-bold text-emerald-700">{kpis.pcnWork}</strong></span>}
                {hasPcn && hasPgd && <span>•</span>}
                {hasPgd && <span>PGD: <strong className="font-bold text-blue-700">{kpis.pgdWork}</strong></span>}
              </div>
            </div>
          </div>

          {/* KPI 2: Awaiting Approval (Amber) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleToggleFilter('AWAITING_APPROVAL')}
            className={`group relative cursor-pointer rounded-xl border bg-white p-2.5 transition-all duration-150 hover:shadow-xs flex items-center gap-3 ${
              activeFilter === 'AWAITING_APPROVAL'
                ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30 shadow-xs'
                : 'border-slate-200/90 hover:border-amber-300'
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Chờ phê duyệt
                </span>
                {activeFilter === 'AWAITING_APPROVAL' && (
                  <Badge variant="outline" className="border-amber-300 bg-amber-100 text-[9px] text-amber-800 font-bold px-1.5 py-0 h-4">
                    Đang lọc
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black leading-none text-amber-700">
                  {kpis.awaitingApproval}
                </span>
                <span className="text-[10px] font-medium text-slate-400">cần duyệt</span>
              </div>
              <div className="mt-0.5 flex items-center text-[10px] text-slate-400 truncate">
                <span>Mốc phê duyệt 2 cấp</span>
              </div>
            </div>
          </div>

          {/* KPI 3: Overdue (Rose) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleToggleFilter('OVERDUE')}
            className={`group relative cursor-pointer rounded-xl border bg-white p-2.5 transition-all duration-150 hover:shadow-xs flex items-center gap-3 ${
              activeFilter === 'OVERDUE'
                ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/30 shadow-xs'
                : 'border-slate-200/90 hover:border-rose-300'
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Hồ sơ quá hạn
                </span>
                {activeFilter === 'OVERDUE' && (
                  <Badge variant="outline" className="border-rose-300 bg-rose-100 text-[9px] text-rose-800 font-bold px-1.5 py-0 h-4">
                    Đang lọc
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-xl font-black leading-none ${kpis.overdue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {kpis.overdue}
                </span>
                <span className="text-[10px] font-medium text-slate-400">quá cam kết</span>
              </div>
              <div className="mt-0.5 flex items-center text-[10px] text-slate-400 truncate">
                <span>Cần chú ý: <strong className="font-bold text-rose-600">{kpis.attention}</strong> hồ sơ</span>
              </div>
            </div>
          </div>

          {/* KPI 4: Total (Indigo / Slate) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleToggleFilter('ALL')}
            className={`group relative cursor-pointer rounded-xl border bg-white p-2.5 transition-all duration-150 hover:shadow-xs flex items-center gap-3 ${
              activeFilter === 'ALL'
                ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30 shadow-xs'
                : 'border-slate-200/90 hover:border-indigo-300'
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Tổng tiếp nhận
                </span>
                {activeFilter === 'ALL' && (
                  <Badge variant="outline" className="border-indigo-300 bg-indigo-100 text-[9px] text-indigo-800 font-bold px-1.5 py-0 h-4">
                    Mặc định
                  </Badge>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black leading-none text-slate-900">
                  {kpis.pcnDossiers + kpis.pgdRequests}
                </span>
                <span className="text-[10px] font-medium text-slate-400">toàn thời gian</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400 truncate">
                <TrendingUp className="h-3 w-3 text-emerald-600 shrink-0" />
                <span className="truncate">Vận hành thông suốt</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workspaces Rails: PCN & PGD Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* PCN Section Card */}
        {hasPcn && (
          <div className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
            {/* Header PCN */}
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300/40">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">Phòng Chứng nhận · PCN</h2>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      7 Bước
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Quy trình chứng nhận sản phẩm & hàng hóa</p>
                </div>
              </div>
              <Link
                href="/pcn"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                Hàng đợi PCN <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Quick Links */}
            <div className="mt-3.5 grid grid-cols-3 gap-2.5">
              <Link
                href="/pcn"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center transition-all hover:border-emerald-300 hover:bg-emerald-50/40"
              >
                <span className="text-base font-bold text-slate-900">{pcn.dossiers.length}</span>
                <span className="text-[11px] font-medium text-slate-600">Tổng hồ sơ</span>
              </Link>
              <Link
                href="/pcn?tab=operations"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center transition-all hover:border-emerald-300 hover:bg-emerald-50/40"
              >
                <span className="text-base font-bold text-slate-900">{pcn.proposals.length}</span>
                <span className="text-[11px] font-medium text-slate-600">Sổ tổng hợp</span>
              </Link>
              <Link
                href="/pcn?tab=samples"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center transition-all hover:border-emerald-300 hover:bg-emerald-50/40"
              >
                <span className="text-base font-bold text-slate-900">{pcn.sampleLots.length}</span>
                <span className="text-[11px] font-medium text-slate-600">Lô mẫu thử</span>
              </Link>
            </div>

            {/* Recent Dossiers List */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Hồ sơ gần đây {activeFilter !== 'ALL' && `(${filterLabels[activeFilter]})`}
                </span>
                <span className="text-[10px] text-slate-400">
                  {filteredPcnDossiers.length} hồ sơ
                </span>
              </div>
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                {filteredPcnDossiers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Không có hồ sơ PCN nào phù hợp bộ lọc
                  </div>
                ) : (
                  filteredPcnDossiers.slice(0, 4).map((dossier) => (
                    <div
                      key={dossier.id}
                      onClick={() => router.push(`/pcn/dossiers/${dossier.id}`)}
                      className="group flex cursor-pointer items-center justify-between p-2.5 transition-colors hover:bg-emerald-50/30"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-800">
                            {dossier.dossierCode}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] py-0 font-medium ${getPcnStatusBadgeClass(dossier.status)}`}
                          >
                            {dossier.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600 font-medium">
                          {dossier.customerSnapshot?.name || 'Khách hàng'}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* PGD Section Card */}
        {hasPgd && (
          <div className="rounded-2xl border border-blue-200/80 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
            {/* Header PGD */}
            <div className="flex items-center justify-between border-b border-blue-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 ring-1 ring-blue-300/40">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">Phòng Giám định · PGD</h2>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                      KTNN
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Giám định kỹ thuật & kiểm tra nhà nước hàng hóa</p>
                </div>
              </div>
              <Link
                href="/pgd"
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Hàng đợi PGD <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Quick Links */}
            <div className="mt-3.5 grid grid-cols-3 gap-2.5">
              <Link
                href="/pgd"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center transition-all hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="text-base font-bold text-slate-900">{pgd.requests.length}</span>
                <span className="text-[11px] font-medium text-slate-600">Hồ sơ PYC</span>
              </Link>
              <Link
                href="/pgd?tab=operations"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center transition-all hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="text-base font-bold text-slate-900">{pgd.assignments.length}</span>
                <span className="text-[11px] font-medium text-slate-600">Phân công GĐ</span>
              </Link>
              <Link
                href="/pgd?tab=samples"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-center transition-all hover:border-blue-300 hover:bg-blue-50/40"
              >
                <span className="text-base font-bold text-slate-900">{pgd.samples.length}</span>
                <span className="text-[11px] font-medium text-slate-600">Mẫu giám định</span>
              </Link>
            </div>

            {/* Recent Requests List */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  PYC gần đây {activeFilter !== 'ALL' && `(${filterLabels[activeFilter]})`}
                </span>
                <span className="text-[10px] text-slate-400">
                  {filteredPgdRequests.length} PYC
                </span>
              </div>
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                {filteredPgdRequests.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Không có PYC nào phù hợp bộ lọc
                  </div>
                ) : (
                  filteredPgdRequests.slice(0, 4).map((request) => (
                    <div
                      key={request.id}
                      onClick={() => router.push(`/pgd/dossiers/${request.id}`)}
                      className="group flex cursor-pointer items-center justify-between p-2.5 transition-colors hover:bg-blue-50/30"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-800">
                            {request.requestCode}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] py-0 font-medium ${getPgdStatusBadgeClass(request.status)}`}
                          >
                            {request.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-600 font-medium">
                          {request.customerSnapshot?.name || 'Khách hàng'}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actionable Tasks List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Việc của tôi cần xử lý ngay</h2>
            <p className="text-xs text-slate-500">Các nhiệm vụ và phân công được giao cho tài khoản hiện tại</p>
          </div>
          {filteredMyWorkItems.length > 0 && (
            <Badge className="bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">
              {filteredMyWorkItems.length} nhiệm vụ
            </Badge>
          )}
        </div>

        {filteredMyWorkItems.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="mt-2 text-xs font-semibold text-slate-700">Không có việc tồn đọng!</p>
            <p className="text-[11px] text-slate-500">Tất cả nhiệm vụ được giao đã hoàn thành hoặc không có việc thuộc bộ lọc.</p>
          </div>
        ) : (
          <div className="mt-3.5 space-y-2">
            {filteredMyWorkItems.map((item) => {
              const isPcn = item.domain === 'PCN';
              return (
                <div
                  key={`${item.domain}-${item.id}`}
                  onClick={() => router.push(isPcn ? `/pcn/dossiers/${item.id}` : `/pgd/dossiers/${item.id}`)}
                  className="group flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/90 p-3 transition-all hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        isPcn ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isPcn ? <FileText className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{item.label}</span>
                        <Badge
                          className={`text-[9px] py-0 font-bold ${
                            isPcn ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                          }`}
                        >
                          {item.domain}
                        </Badge>
                        <Badge
                          variant={item.isOverdue ? 'destructive' : 'outline'}
                          className="text-[9px] py-0"
                        >
                          {item.statusLabel}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-600">
                        {item.customerName} · <strong className="text-slate-800">{item.nextAction.label}</strong>
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-700 transition-colors" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
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