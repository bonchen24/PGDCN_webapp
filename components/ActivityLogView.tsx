// Author: Gemini
// OS support: Web/Node
// Description: Admin and management view for filtered, paginated, append-only system activity history

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Download, Filter, History, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { useStore } from '../store';
import { PRESET_ACCOUNTS, type ActivityKpiSummary, type ActivityLog, type ActivityLogAction, type ActivityLogEntityType, type UserAccount } from '../types';
import {
  activityActionLabels,
  activityEntityLabels,
  isActivityLogVisibleToUser,
} from '../utils/activityLog';
import { activityLogClient, type ActivityLogFilters } from '../utils/activityLogApi';
import { getActivityKpiSegments, selectActivityKpiRows } from '../utils/activityLogKpi';
import {
  DEFAULT_ACTIVITY_PERIOD,
  getActivityPeriodBounds,
  formatActivityTime,
  type ActivityPeriod,
} from '../utils/activityLogTime';
import { getUserFullName } from '../utils/userIdentity';

const PAGE_SIZE = 50;
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

interface ActivityFilters {
  search: string;
  action: ActivityLogAction | '';
  entityType: ActivityLogEntityType | '';
  period: ActivityPeriod;
}

export interface ActivityLogViewProps {
  currentUser?: UserAccount | null;
  systemUsers?: UserAccount[];
}

const INITIAL_FILTERS: ActivityFilters = {
  search: '',
  action: '',
  entityType: '',
  period: DEFAULT_ACTIVITY_PERIOD,
};

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const exportActivityLogs = (logs: ActivityLog[]): void => {
  const rows = [
    ['Thời gian', 'Người thực hiện', 'Hành động', 'Đối tượng', 'Định danh', 'Mô tả'],
    ...logs.map(log => [
      formatActivityTime(log.createdAt),
      log.actorName || 'Hệ thống',
      activityActionLabels[log.action] || log.action,
      activityEntityLabels[log.entityType] || log.entityType,
      log.entityLabel || log.requestCode || log.docNumber || log.reportNo || log.entityId || '',
      log.summary,
    ]),
  ];
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Nhat_ky_he_thong_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const toApiFilters = (
  filters: ActivityFilters,
  actors: string[] = [],
  periodBounds = getActivityPeriodBounds(filters.period),
): ActivityLogFilters => ({
  limit: PAGE_SIZE,
  search: filters.search.trim() || undefined,
  actor: actors.length > 0 ? actors : undefined,
  action: filters.action || undefined,
  entityType: filters.entityType || undefined,
  from: periodBounds.from,
  to: periodBounds.to,
});

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ currentUser: providedCurrentUser, systemUsers: providedSystemUsers }) => {
  const storeState = useStore();
  const currentUser = providedCurrentUser === undefined ? storeState.currentUser : providedCurrentUser;
  const systemUsers = providedSystemUsers === undefined ? storeState.systemUsers : providedSystemUsers;
  const [filters, setFilters] = useState<ActivityFilters>(INITIAL_FILTERS);
  const [selectedActors, setSelectedActors] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isUserFilterOpen, setIsUserFilterOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpiRows, setKpiRows] = useState<ActivityKpiSummary[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [selectedKpiActor, setSelectedKpiActor] = useState<string | null>(null);
  const [kpiDisplayLimit, setKpiDisplayLimit] = useState(10);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const logRequestSequence = useRef(0);
  const kpiRequestSequence = useRef(0);

  const canView = isActivityLogVisibleToUser(currentUser);

  const userOptions = useMemo(() => {
    const directory = providedSystemUsers === undefined ? [...PRESET_ACCOUNTS, ...(systemUsers || [])] : systemUsers || [];
    const merged = directory
      .map(user => ({
        username: String(user.username || user.id || '').trim(),
        name: getUserFullName(user, ''),
      }))
      .filter(user => user.username && user.name);
    return Array.from(new Map(merged.map(user => [user.username, user])).values())
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
  }, [providedSystemUsers, systemUsers]);

  const filteredUserOptions = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return userOptions;
    return userOptions.filter(user => user.name.toLowerCase().includes(query));
  }, [userOptions, userSearch]);

  const periodBounds = useMemo(
    () => getActivityPeriodBounds(filters.period),
    [filters.period],
  );

  const loadFirstPage = useCallback(async () => {
    const requestId = ++logRequestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await activityLogClient.fetchPage(toApiFilters(filters, selectedActors, periodBounds), null);
      if (requestId !== logRequestSequence.current) return;
      setLogs(page.items);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadError: any) {
      if (requestId !== logRequestSequence.current) return;
      setError(loadError?.message || 'Không thể tải nhật ký hệ thống.');
      setLogs([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      if (requestId === logRequestSequence.current) setIsLoading(false);
    }
  }, [filters, periodBounds, selectedActors]);

  useEffect(() => {
    if (canView) void loadFirstPage();
  }, [canView, loadFirstPage]);

  const loadKpiSummary = useCallback(async () => {
    const requestId = ++kpiRequestSequence.current;
    setKpiLoading(true);
    setKpiError(null);
    try {
      const page = await activityLogClient.fetchSummary({
        actor: selectedActors.length > 0 ? selectedActors : undefined,
        from: periodBounds.from,
        to: periodBounds.to,
      });
      if (requestId !== kpiRequestSequence.current) return;
      setKpiRows(page.items);
    } catch (loadError: any) {
      if (requestId !== kpiRequestSequence.current) return;
      setKpiError(loadError?.message || 'Không thể tải KPI công việc.');
      setKpiRows([]);
    } finally {
      if (requestId === kpiRequestSequence.current) setKpiLoading(false);
    }
  }, [periodBounds, selectedActors]);

  useEffect(() => {
    if (canView) void loadKpiSummary();
  }, [canView, loadKpiSummary]);

  const loadMore = async () => {
    if (!nextCursor || isLoading) return;
    const requestId = logRequestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const page = await activityLogClient.fetchPage(toApiFilters(filters, selectedActors, periodBounds), nextCursor);
      if (requestId !== logRequestSequence.current) return;
      setLogs(previous => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (loadError: any) {
      if (requestId !== logRequestSequence.current) return;
      setError(loadError?.message || 'Không thể tải thêm nhật ký.');
    } finally {
      if (requestId === logRequestSequence.current) setIsLoading(false);
    }
  };

  const updateFilter = <K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) => {
    setFilters(previous => ({ ...previous, [key]: value }));
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSelectedActors([]);
    setUserSearch('');
  };

  const toggleActor = (username: string) => {
    setSelectedActors(previous => previous.includes(username)
      ? previous.filter(actor => actor !== username)
      : [...previous, username]);
  };

  const visibleKpiRows = useMemo(
    () => selectActivityKpiRows(kpiRows, selectedActors, kpiDisplayLimit),
    [kpiDisplayLimit, kpiRows, selectedActors],
  );
  const selectedKpiRow = visibleKpiRows.find(row => row.actorUsername === selectedKpiActor) || visibleKpiRows[0] || null;

  const loadedLabel = useMemo(() => `${logs.length} dòng đã tải`, [logs.length]);

  if (!canView) {
    return (
      <section className="h-full flex items-center justify-center p-6" aria-label="Nhật ký hệ thống">
        <div className="max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 shadow-sm">
          <AlertCircle className="mx-auto mb-3" size={28} />
          <h2 className="text-sm font-black uppercase tracking-wide">Không có quyền truy cập</h2>
          <p className="mt-2 text-xs font-medium">Bạn không có quyền xem nhật ký hệ thống trong phiên này.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full min-h-0 flex flex-col bg-slate-50 p-3 sm:p-5 overflow-y-auto overscroll-contain mobile-safe-bottom" aria-label="Nhật ký hệ thống">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-900">
              <History className="shrink-0 text-emerald-600" size={20} aria-hidden="true" />
              <h1 className="truncate text-base font-black uppercase tracking-tight sm:text-lg">Nhật ký hệ thống</h1>
            </div>
            <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500 sm:text-xs">Theo dõi lịch sử thao tác nghiệp vụ trên toàn hệ thống.</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{loadedLabel}</span>
            <button
              type="button"
              onClick={() => void loadFirstPage()}
              className="mobile-touch-target inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-black uppercase text-slate-600 shadow-sm transition hover:border-emerald-300 hover:text-emerald-700"
              title="Tải lại nhật ký"
              aria-label="Làm mới nhật ký"
            >
              <RefreshCw size={14} aria-hidden="true" /><span className="hidden sm:inline">Làm mới</span>
            </button>
            <button
              type="button"
              onClick={() => exportActivityLogs(logs)}
              disabled={logs.length === 0}
              className="mobile-touch-target inline-flex min-h-10 items-center gap-1 rounded-lg bg-emerald-600 px-2 text-[10px] font-black uppercase text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Xuất CSV"
            >
              <Download size={14} aria-hidden="true" /><span className="hidden sm:inline">Xuất CSV</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/70 p-2">
          <div className="flex items-center justify-between gap-2 md:hidden">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600">
              <Filter size={14} className="text-emerald-600" aria-hidden="true" /> Bộ lọc
            </div>
            <button
              type="button"
              onClick={() => setIsFiltersOpen(previous => !previous)}
              aria-expanded={isFiltersOpen}
              className="mobile-touch-target rounded-lg px-2 text-[10px] font-black uppercase text-emerald-700"
            >
              {isFiltersOpen ? 'Thu gọn' : 'Mở bộ lọc'}
            </button>
          </div>
          <div className={`${isFiltersOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2 md:grid md:grid-cols-8`} role="search" aria-label="Bộ lọc nhật ký">
            <label className="relative col-span-2 md:col-span-2">
              <span className="sr-only">Tìm kiếm</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} aria-hidden="true" />
              <input
                value={filters.search}
                onChange={event => updateFilter('search', event.target.value)}
                placeholder="Tìm mô tả, mã phiếu, biên bản..."
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:min-h-9"
              />
            </label>
            <div className="relative col-span-2 md:col-span-2">
              <button type="button" onClick={() => setIsUserFilterOpen(previous => !previous)} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-left text-xs font-semibold text-slate-600 outline-none transition hover:border-emerald-300 sm:min-h-9">
                {selectedActors.length > 0 ? `Đã chọn ${selectedActors.length} người` : 'Chọn người dùng'}
              </button>
              {isUserFilterOpen && (
                <div className="absolute left-0 top-12 z-30 w-full min-w-[260px] rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl">
                  <div className="flex gap-1.5">
                    <input value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder="Tìm người dùng..." className="min-h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-emerald-400" />
                    <button type="button" onClick={() => setSelectedActors([])} className="whitespace-nowrap rounded-lg border border-slate-200 px-2 text-[10px] font-black uppercase text-slate-500">Bỏ chọn tất cả</button>
                  </div>
                  <button type="button" onClick={() => setSelectedActors(userOptions.map(user => user.username))} className="mt-1.5 text-[10px] font-black uppercase text-emerald-700">Chọn tất cả</button>
                  <div className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto border-t border-slate-100 pt-1.5">
                    {filteredUserOptions.map(user => (
                      <label key={user.username} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-emerald-50">
                        <input type="checkbox" checked={selectedActors.includes(user.username)} onChange={() => toggleActor(user.username)} className="h-4 w-4 accent-emerald-600" />
                        <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{user.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <label className="col-span-1 md:col-span-1">
              <span className="sr-only">Hành động</span>
              <select value={filters.action} onChange={event => updateFilter('action', event.target.value as ActivityLogAction | '')} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-400 sm:min-h-9">
                <option value="">Hành động</option>
                {Object.entries(activityActionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="col-span-1 md:col-span-1">
              <span className="sr-only">Đối tượng</span>
              <select value={filters.entityType} onChange={event => updateFilter('entityType', event.target.value as ActivityLogEntityType | '')} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-400 sm:min-h-9">
                <option value="">Đối tượng</option>
                {Object.entries(activityEntityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="col-span-2 md:col-span-1">
              <span className="sr-only">Kỳ thống kê</span>
              <select value={filters.period} onChange={event => updateFilter('period', event.target.value as ActivityPeriod)} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-400 sm:min-h-9" aria-label="Kỳ thống kê">
                {Object.entries(ACTIVITY_PERIOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button type="button" onClick={resetFilters} className="mobile-touch-target col-span-2 inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase text-slate-500 hover:text-rose-600 md:col-span-1">
              <Filter size={14} aria-hidden="true" /> Xóa lọc
            </button>
          </div>
        </div>
      </div>

      <section className="mt-2 shrink-0 rounded-xl border border-emerald-100 bg-white p-2 shadow-sm" aria-label="Biểu đồ KPI">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="min-w-0">
            <h2 className="truncate text-xs font-black uppercase tracking-tight text-slate-800 sm:text-sm">Biểu đồ KPI công việc</h2>
            <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-400">GMT+7 · Kỳ {ACTIVITY_PERIOD_LABELS[filters.period].toLowerCase()} · Chọn nhân viên để xem chi tiết.</p>
          </div>
          <label className="flex shrink-0 items-center gap-1.5 text-[9px] font-black uppercase text-slate-400">Hiển thị
            <select value={kpiDisplayLimit} onChange={event => setKpiDisplayLimit(Number(event.target.value))} className="mobile-touch-target min-h-9 rounded-lg border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-600">
              <option value={5}>5 người</option><option value={10}>10 người</option><option value={20}>20 người</option><option value={50}>50 người</option><option value={0}>Tất cả</option>
            </select>
          </label>
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

      {error && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
          <span className="flex items-center gap-2"><AlertCircle size={15} /> {error}</span>
          <button type="button" onClick={() => void loadFirstPage()} className="font-black uppercase">Thử lại</button>
        </div>
      )}

      <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading && logs.length === 0 ? (
          <div className="flex h-48 items-center justify-center gap-2 text-xs font-bold text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang tải nhật ký...</div>
        ) : logs.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-slate-400"><History size={28} /><p className="text-xs font-bold">Chưa có hoạt động phù hợp với bộ lọc.</p></div>
        ) : (
          <>
            <div className="hidden min-w-[760px] grid-cols-[150px_150px_130px_150px_minmax(280px,1fr)] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-wide text-slate-400 md:grid">
              <span>Thời gian</span><span>Người thực hiện</span><span>Hành động</span><span>Đối tượng</span><span>Mô tả</span>
            </div>
            <div className="divide-y divide-slate-100">
              {logs.map(log => (
                <button key={log.id} type="button" onClick={() => setSelectedLog(log)} className="block w-full text-left transition hover:bg-emerald-50/50 focus:bg-emerald-50/50 focus:outline-none">
                  <div className="hidden min-w-[760px] grid-cols-[150px_150px_130px_150px_minmax(280px,1fr)] items-center gap-3 px-4 py-3 md:grid">
                    <span className="text-[11px] font-semibold text-slate-500">{formatActivityTime(log.createdAt)}</span>
                    <span className="truncate text-xs font-bold text-slate-700">{log.actorName || 'Hệ thống'}</span>
                    <span className="text-[10px] font-black uppercase text-emerald-700">{activityActionLabels[log.action] || log.action}</span>
                    <span className="truncate text-[10px] font-bold text-slate-500">{activityEntityLabels[log.entityType] || log.entityType}</span>
                    <span className="truncate text-xs text-slate-700">{log.summary}</span>
                  </div>
                  <div className="flex flex-col gap-2 p-3 md:hidden">
                    <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-slate-400">{formatActivityTime(log.createdAt)}</span><span className="text-[10px] font-black uppercase text-emerald-700">{activityActionLabels[log.action] || log.action}</span></div>
                    <div className="text-xs font-bold text-slate-700">{log.summary}</div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-500"><span>{log.actorName || 'Hệ thống'}</span><span>·</span><span>{activityEntityLabels[log.entityType] || log.entityType}</span></div>
                  </div>
                </button>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center border-t border-slate-100 p-3">
                <button type="button" onClick={() => void loadMore()} disabled={isLoading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 px-4 text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Tải thêm</button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/40 p-2 backdrop-blur-sm md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="Chi tiết nhật ký">
          <div className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-900 p-4 text-white">
              <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Chi tiết hoạt động</p><h2 className="mt-1 text-sm font-black">{selectedLog.summary}</h2></div>
              <button type="button" onClick={() => setSelectedLog(null)} className="rounded-full p-2 hover:bg-white/10" aria-label="Đóng chi tiết"><X size={18} /></button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4 text-xs text-slate-700">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><span className="font-bold text-slate-400">Thời gian</span><p>{formatActivityTime(selectedLog.createdAt)}</p></div>
                <div><span className="font-bold text-slate-400">Người thực hiện</span><p>{selectedLog.actorName || 'Hệ thống'}</p></div>
                <div><span className="font-bold text-slate-400">Hành động</span><p>{activityActionLabels[selectedLog.action] || selectedLog.action}</p></div>
                <div><span className="font-bold text-slate-400">Đối tượng</span><p>{activityEntityLabels[selectedLog.entityType] || selectedLog.entityType}</p></div>
                <div><span className="font-bold text-slate-400">Định danh</span><p>{selectedLog.entityLabel || selectedLog.requestCode || selectedLog.docNumber || selectedLog.reportNo || selectedLog.entityId || '—'}</p></div>
                <div><span className="font-bold text-slate-400">Nguồn</span><p>{selectedLog.source}</p></div>
              </div>
              <div className="mt-5">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thay đổi dữ liệu</h3>
                {selectedLog.changes?.length ? (
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase text-slate-400"><span>Trường</span><span>Trước thay đổi</span><span>Sau thay đổi</span></div>
                    {selectedLog.changes.map(change => <div key={change.field} className="grid grid-cols-3 gap-2 border-t border-slate-100 px-3 py-2 text-[11px]"><span className="font-bold">{change.field}</span><span className="break-words text-rose-700">{JSON.stringify(change.before)}</span><span className="break-words text-emerald-700">{JSON.stringify(change.after)}</span></div>)}
                  </div>
                ) : <p className="mt-2 text-xs text-slate-400">Không có diff chi tiết cho hoạt động này.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// --- End of ActivityLogView.tsx ---
