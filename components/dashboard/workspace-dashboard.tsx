'use client';

import React, { useMemo } from 'react';
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

export default function WorkspaceDashboard() {
  const router = useRouter();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();

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
  const myWorkItems: PgdcnMyWorkItem[] = myWork?.items || [];

  return (
    <div className="space-y-6 p-6">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Bàn làm việc Giám định & Chứng nhận
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Xin chào, <span className="font-semibold text-slate-900">{currentUser?.name || currentUser?.username}</span>. Theo dõi chỉ số vận hành và hồ sơ đang xử lý.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
          {hasPcn && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              onClick={() => router.push('/pcn')}
            >
              <Award className="mr-1.5 h-3.5 w-3.5" />
              Hàng đợi PCN
            </Button>
          )}
          {hasPgd && (
            <Button
              size="sm"
              variant="outline"
              className="border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold"
              onClick={() => router.push('/pgd')}
            >
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Hàng đợi PGD
            </Button>
          )}
        </div>
      </div>

      {/* 4 Core KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: In Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hồ sơ đang xử lý</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <FolderOpen className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900">{kpis.inProgress}</span>
            <span className="text-xs font-medium text-slate-500">hồ sơ toàn phòng</span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            {hasPcn && <span>PCN: <strong className="text-slate-800">{kpis.pcnWork}</strong></span>}
            {hasPcn && hasPgd && <span>•</span>}
            {hasPgd && <span>PGD: <strong className="text-slate-800">{kpis.pgdWork}</strong></span>}
          </div>
        </div>

        {/* KPI 2: Awaiting Approval */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chờ phê duyệt</span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-amber-600">{kpis.awaitingApproval}</span>
            <span className="text-xs font-medium text-slate-500">cần duyệt</span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span>Mốc phê duyệt 2 cấp PCN/PGD</span>
          </div>
        </div>

        {/* KPI 3: Overdue */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hồ sơ quá hạn</span>
            <div className="rounded-lg bg-rose-50 p-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-3xl font-black tracking-tight ${kpis.overdue > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {kpis.overdue}
            </span>
            <span className="text-xs font-medium text-slate-500">quá cam kết</span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span>Cần chú ý: <strong className="text-rose-600">{kpis.attention}</strong> hồ sơ</span>
          </div>
        </div>

        {/* KPI 4: Total Dossiers */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng hồ sơ tiếp nhận</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-slate-900">
              {kpis.pcnDossiers + kpis.pgdRequests}
            </span>
            <span className="text-xs font-medium text-slate-500">toàn thời gian</span>
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span>Tiến độ vận hành thông suốt</span>
          </div>
        </div>
      </div>

      {/* Workspaces & Direct Navigation Rails */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* PCN Section Card */}
        {hasPcn && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Phòng Chứng nhận · PCN</h2>
                  <p className="text-xs text-slate-500">Quy trình 7 bước chứng nhận sản phẩm, hàng hóa</p>
                </div>
              </div>
              <Link
                href="/pcn"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                Vào hàng đợi <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Quick Links */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Link
                href="/pcn"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <span className="text-lg font-bold text-slate-900">{pcn.dossiers.length}</span>
                <span className="mt-0.5 text-[11px] font-medium text-slate-600">Tổng hồ sơ</span>
              </Link>
              <Link
                href="/pcn?tab=operations"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <span className="text-lg font-bold text-slate-900">{pcn.proposals.length}</span>
                <span className="mt-0.5 text-[11px] font-medium text-slate-600">Sổ tổng hợp</span>
              </Link>
              <Link
                href="/pcn?tab=samples"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <span className="text-lg font-bold text-slate-900">{pcn.sampleLots.length}</span>
                <span className="mt-0.5 text-[11px] font-medium text-slate-600">Lô mẫu thử</span>
              </Link>
            </div>

            {/* Recent Dossiers */}
            <div className="mt-5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Hồ sơ gần đây</span>
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                {pcn.dossiers.slice(0, 4).map((dossier) => (
                  <div
                    key={dossier.id}
                    onClick={() => router.push(`/pcn/dossiers/${dossier.id}`)}
                    className="flex cursor-pointer items-center justify-between p-2.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-emerald-700">{dossier.dossierCode}</span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {dossier.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-600">
                        {dossier.customerSnapshot?.name || 'Khách hàng'}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PGD Section Card */}
        {hasPgd && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Phòng Giám định · PGD</h2>
                  <p className="text-xs text-slate-500">Giám định kỹ thuật & kiểm tra nhà nước hàng hóa</p>
                </div>
              </div>
              <Link
                href="/pgd"
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Vào hàng đợi <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Quick Links */}
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Link
                href="/pgd"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center transition-colors hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="text-lg font-bold text-slate-900">{pgd.requests.length}</span>
                <span className="mt-0.5 text-[11px] font-medium text-slate-600">Hồ sơ PYC</span>
              </Link>
              <Link
                href="/pgd?tab=operations"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center transition-colors hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="text-lg font-bold text-slate-900">{pgd.assignments.length}</span>
                <span className="mt-0.5 text-[11px] font-medium text-slate-600">Phân công GĐ</span>
              </Link>
              <Link
                href="/pgd?tab=samples"
                className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-center transition-colors hover:border-blue-200 hover:bg-blue-50/40"
              >
                <span className="text-lg font-bold text-slate-900">{pgd.samples.length}</span>
                <span className="mt-0.5 text-[11px] font-medium text-slate-600">Mẫu giám định</span>
              </Link>
            </div>

            {/* Recent Requests */}
            <div className="mt-5">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">PYC giám định gần đây</span>
              <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                {pgd.requests.slice(0, 4).map((request) => (
                  <div
                    key={request.id}
                    onClick={() => router.push(`/pgd/dossiers/${request.id}`)}
                    className="flex cursor-pointer items-center justify-between p-2.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-blue-700">{request.requestCode}</span>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {request.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-600">
                        {request.customerSnapshot?.name || 'Khách hàng'}
                      </p>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actionable Tasks List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">Việc của tôi cần xử lý ngay</h2>
        <p className="mt-0.5 text-xs text-slate-500">Các nhiệm vụ và phân công được giao cho tài khoản hiện tại</p>

        {myWorkItems.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="mt-2 text-xs font-semibold text-slate-700">Không có việc tồn đọng!</p>
            <p className="text-[11px] text-slate-500">Tất cả nhiệm vụ được giao đã hoàn thành xuất sắc.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {myWorkItems.map((item) => {
              const isPcn = item.domain === 'PCN';
              return (
                <div
                  key={`${item.domain}-${item.id}`}
                  onClick={() => router.push(isPcn ? `/pcn/dossiers/${item.id}` : `/pgd/dossiers/${item.id}`)}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/80 p-3 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-lg p-1.5 ${
                        isPcn ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isPcn ? <FileText className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-800">{item.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {item.domain}
                        </Badge>
                        <Badge
                          variant={item.isOverdue ? 'destructive' : 'secondary'}
                          className="text-[10px]"
                        >
                          {item.statusLabel}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {item.customerName} · <strong className="text-slate-800">{item.nextAction.label}</strong>
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
