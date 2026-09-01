// Author: Codex
// OS support: Web/Node
// Description: Read-only PCN user KPI ranking backed by the activity summary API

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Loader2 } from 'lucide-react';
import type { ActivityKpiSummary, UserAccount } from '../types';
import { isActivityLogVisibleToUser } from '../utils/activityLog';
import { activityLogClient } from '../utils/activityLogApi';
import { getActivityKpiSegments, selectActivityKpiRows } from '../utils/activityLogKpi';
import { getActivityPeriodBounds, type ActivityPeriod } from '../utils/activityLogTime';

const KPI_LEGEND = [
  { label: 'Phiếu', color: '#059669' },
  { label: 'KQTN', color: '#2563eb' },
  { label: 'Biên bản', color: '#d97706' },
  { label: 'Lịch', color: '#7c3aed' },
  { label: 'Khác', color: '#94a3b8' },
] as const;

const ACTIVITY_PERIOD_LABELS: Record<ActivityPeriod, string> = {
  DAY: 'Ngày',
  WEEK: 'Tuần',
  MONTH: 'Tháng',
  YEAR: 'Năm',
};

const EMPTY_ACTORS: string[] = [];

export interface PcnUserKpiTableProps {
  currentUser?: UserAccount | null;
  selectedActors?: string[];
  period?: ActivityPeriod;
  onPeriodChange?: (period: ActivityPeriod) => void;
  showPeriodSelector?: boolean;
  onOpenActivityLogs?: () => void;
  title?: string;
}

export const PcnUserKpiTable: React.FC<PcnUserKpiTableProps> = ({
  currentUser,
  selectedActors,
  period,
  onPeriodChange,
  showPeriodSelector = true,
  onOpenActivityLogs,
  title = 'KPI người dùng',
}) => {
  const [localPeriod, setLocalPeriod] = useState<ActivityPeriod>('MONTH');
  const [kpiRows, setKpiRows] = useState<ActivityKpiSummary[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [selectedKpiActor, setSelectedKpiActor] = useState<string | null>(null);
  const [kpiDisplayLimit, setKpiDisplayLimit] = useState(10);
  const kpiRequestSequence = useRef(0);
  const canView = isActivityLogVisibleToUser(currentUser);
  const activePeriod = period || localPeriod;
  const actorFilter = selectedActors || EMPTY_ACTORS;
  const periodBounds = useMemo(() => getActivityPeriodBounds(activePeriod), [activePeriod]);

  const loadKpiSummary = useCallback(async () => {
    const requestId = ++kpiRequestSequence.current;
    setKpiLoading(true);
    setKpiError(null);
    try {
      const page = await activityLogClient.fetchSummary({
        actor: actorFilter.length > 0 ? actorFilter : undefined,
        from: periodBounds.from,
        to: periodBounds.to,
      });
      if (requestId !== kpiRequestSequence.current) return;
      setKpiRows(page.items);
    } catch (loadError: any) {
      if (requestId !== kpiRequestSequence.current) return;
      setKpiError(loadError?.message || 'Không thể tải KPI người dùng.');
      setKpiRows([]);
    } finally {
      if (requestId === kpiRequestSequence.current) setKpiLoading(false);
    }
  }, [actorFilter, periodBounds]);

  useEffect(() => {
    if (canView) void loadKpiSummary();
  }, [canView, loadKpiSummary]);

  const visibleKpiRows = useMemo(
    () => selectActivityKpiRows(kpiRows, actorFilter, kpiDisplayLimit),
    [actorFilter, kpiDisplayLimit, kpiRows],
  );
  const selectedKpiRow = visibleKpiRows.find(row => row.actorUsername === selectedKpiActor) || visibleKpiRows[0] || null;

  if (!canView) return null;

  const changePeriod = (nextPeriod: ActivityPeriod) => {
    if (onPeriodChange) onPeriodChange(nextPeriod);
    else setLocalPeriod(nextPeriod);
  };

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-2 shadow-sm" aria-label="Bảng KPI người dùng">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="min-w-0">
          <h2 className="truncate text-xs font-black uppercase tracking-tight text-slate-800 sm:text-sm">{title}</h2>
          <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">GMT+7 · Kỳ {ACTIVITY_PERIOD_LABELS[activePeriod].toLowerCase()} · Chọn nhân viên để xem chi tiết.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {showPeriodSelector && <label className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400">Kỳ
            <select aria-label="Kỳ KPI người dùng" value={activePeriod} onChange={event => changePeriod(event.target.value as ActivityPeriod)} className="mobile-touch-target min-h-9 rounded-lg border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-600">
              {Object.entries(ACTIVITY_PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
          <label className="flex items-center gap-1.5 text-[9px] font-black uppercase text-slate-400">Hiển thị
            <select aria-label="Số người dùng hiển thị" value={kpiDisplayLimit} onChange={event => setKpiDisplayLimit(Number(event.target.value))} className="mobile-touch-target min-h-9 rounded-lg border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-600">
              <option value={5}>5 người</option><option value={10}>10 người</option><option value={20}>20 người</option><option value={50}>50 người</option><option value={0}>Tất cả</option>
            </select>
          </label>
          {onOpenActivityLogs && <button type="button" onClick={onOpenActivityLogs} aria-label="Mở Nhật ký hệ thống" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[9px] font-black text-emerald-700 hover:bg-emerald-100">Nhật ký <ArrowUpRight size={13} /></button>}
        </div>
      </div>
      {kpiError && <p className="mt-1 text-[10px] font-semibold text-rose-600">{kpiError}</p>}
      {kpiLoading && kpiRows.length === 0 ? (
        <div className="flex h-28 items-center justify-center gap-2 text-[10px] font-bold text-slate-400"><Loader2 className="animate-spin" size={16} /> Đang tải KPI...</div>
      ) : visibleKpiRows.length === 0 ? (
        <div className="flex h-28 items-center justify-center text-[10px] font-bold text-slate-400">Chưa có KPI trong kỳ đã chọn.</div>
      ) : (
        <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.38fr)]">
          <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 p-1.5">
            <div className="flex items-center justify-between gap-2 px-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
              <span>Tổng thao tác theo nhân viên</span>
              <span>{visibleKpiRows.length} người</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 px-1 text-[8px] font-bold text-slate-500">
              {KPI_LEGEND.map(item => <span key={item.label} className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
            </div>
            <div className="mt-1.5 overflow-y-auto max-h-[min(360px,42vh)]" role="list" aria-label="Danh sách KPI nhân viên">
              <div className="grid grid-cols-[minmax(6.25rem,0.7fr)_minmax(0,1.7fr)_2.5rem] items-center gap-2 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-slate-400">
                <span>Nhân viên</span><span>Phân bổ công việc</span><span className="text-right">Tổng</span>
              </div>
              {visibleKpiRows.map(row => {
                const segments = getActivityKpiSegments(row);
                const segmentTotal = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
                const isSelected = row.actorUsername === selectedKpiRow?.actorUsername;
                return (
                  <button key={row.actorUsername} type="button" role="listitem" onClick={() => setSelectedKpiActor(row.actorUsername)} aria-label={`${row.actorName}: ${row.totalActions} thao tác`} className={`grid w-full min-w-0 grid-cols-[minmax(6.25rem,0.7fr)_minmax(0,1.7fr)_2.5rem] items-center gap-2 rounded-md border-t border-slate-100 px-2 py-1.5 text-left transition ${isSelected ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-white'}`}>
                    <span className="min-w-0 truncate text-[10px] font-bold text-slate-700">{row.actorName}</span>
                    <span className="min-w-0">
                      <span className="flex h-2.5 min-w-0 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                        {segments.map(segment => <span key={segment.label} className="h-full shrink-0" style={{ width: `${(segment.value / segmentTotal) * 100}%`, backgroundColor: segment.color }} />)}
                      </span>
                      <span className="mt-0.5 flex min-w-0 gap-1 overflow-hidden whitespace-nowrap text-[8px] font-bold leading-3 text-slate-400">
                        <span className="text-emerald-700">P {row.requestsCreated}</span>
                        <span className="text-blue-700">M {row.samplesProcessed}</span>
                        <span className="text-violet-700">KQ {row.kqtnUpdated}</span>
                        <span className="text-amber-700">BB {row.handoversCreated}</span>
                        <span className="text-purple-700">L {row.scheduleActions}</span>
                        <span className="text-slate-500">K {row.otherActions}</span>
                      </span>
                    </span>
                    <span className="text-right text-xs font-black text-slate-700">{row.totalActions}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="hidden rounded-lg border border-slate-100 bg-slate-50 p-2 lg:block">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cơ cấu hoạt động</p>
            <p className="mt-0.5 truncate text-xs font-black text-slate-700">{selectedKpiRow?.actorName}</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1 text-center">
              <div className="rounded-md bg-white p-1.5"><p className="text-[8px] font-black uppercase text-slate-400">Phiếu tạo</p><p className="text-sm font-black text-emerald-700">{selectedKpiRow?.requestsCreated || 0}</p></div>
              <div className="rounded-md bg-white p-1.5"><p className="text-[8px] font-black uppercase text-slate-400">Mẫu xử lý</p><p className="text-sm font-black text-blue-700">{selectedKpiRow?.samplesProcessed || 0}</p></div>
              <div className="rounded-md bg-white p-1.5"><p className="text-[8px] font-black uppercase text-slate-400">KQTN cập nhật</p><p className="text-sm font-black text-violet-700">{selectedKpiRow?.kqtnUpdated || 0}</p></div>
              <div className="rounded-md bg-white p-1.5"><p className="text-[8px] font-black uppercase text-slate-400">Biên bản tạo</p><p className="text-sm font-black text-amber-700">{selectedKpiRow?.handoversCreated || 0}</p></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// --- End of PcnUserKpiTable.tsx ---
