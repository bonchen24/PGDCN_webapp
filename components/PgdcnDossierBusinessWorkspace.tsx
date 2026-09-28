'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock3, FileCheck2, FlaskConical, Lightbulb, MapPin, UserRound } from 'lucide-react';

export type BusinessStatus = 'DONE' | 'IN_PROGRESS' | 'BLOCKED' | 'NOT_STARTED';

export type DossierBusinessGroup = {
  id: string;
  title: string;
  description: string;
  status: BusinessStatus;
  statusLabel: string;
  countLabel?: string;
  meta?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type DossierBlocker = {
  id: string;
  title: string;
  reason: string;
  severity?: 'HARD' | 'WARNING';
  source?: string;
  target?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type DossierTrackerRow = {
  id: string;
  code: string;
  title: string;
  state: string;
  stateTone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  meta?: string;
  detail?: string;
  session?: string;
  date?: string;
  lot?: string;
};

export type DossierSuggestedAction = {
  id: string;
  title: string;
  reason: string;
  actionLabel: string;
  onAction: () => void;
  tone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
};

export type DossierEvidenceGroup = {
  id: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  rows: DossierTrackerRow[];
};

export type DossierTimelineItem = {
  id: string;
  title: string;
  occurredAt?: string;
  actor?: string;
  location?: string;
  detail?: string;
  tone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
};

export type DossierFieldSession = {
  exists: boolean;
  status: string;
  statusTone?: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  occurredAt?: string;
  location?: string;
  inspectors?: string;
  objectLabel?: string;
  quantity?: string;
  observations?: string;
  measurements?: string;
  sampleSummary?: string;
  evidenceSummary?: string;
  sampleCount?: number;
  actionLabel?: string;
  onAction?: () => void;
  onView?: () => void;
  onEdit?: () => void;};

export type DossierFieldSessionSummary = DossierFieldSession & { id: string; sessionCode?: string; endedAt?: string; activityType?: string };

export type PgdcnDossierBusinessWorkspaceProps = {
  domain: 'PCN' | 'PGD';
  title?: string;
  description?: string;
  nextAction: {
    title: string;
    reason: string;
    owner?: string;
    missing?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  metrics: Array<{ id: string; label: string; value: string | number; tone?: 'neutral' | 'info' | 'warning' | 'success' }>;
  groups: DossierBusinessGroup[];
  blockers?: DossierBlocker[];
  suggestedActions?: DossierSuggestedAction[];
  fieldSession?: DossierFieldSession;
  fieldSessions?: DossierFieldSessionSummary[];
  sampleSummary?: { expectedUnits?: number; sampledUnits: number; expectedSampleCount?: number; expectedSampleQuantity?: number; actualSampleCount?: number; actualSampleQuantity?: number; sampleCount: number; labRequestCount: number; resultCount: number; pendingLabRequestCount: number };
  testSummary?: { requestCount: number; resultCount: number; pendingCount: number };
  evidenceTracker?: {
    title?: string;
    groups: DossierEvidenceGroup[];
    emptyText: string;
  };
  sampleTracker?: {
    title?: string;
    rows: DossierTrackerRow[];
    emptyText: string;
  };
  testTracker?: {
    title?: string;
    rows: DossierTrackerRow[];
    emptyText: string;
  };
  timeline?: {
    title?: string;
    items: DossierTimelineItem[];
    emptyText: string;
  };
};

const STATUS_CLASS: Record<BusinessStatus, string> = {
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  BLOCKED: 'border-rose-200 bg-rose-50 text-rose-700',
  NOT_STARTED: 'border-slate-200 bg-slate-50 text-slate-500',
};

const SUGGESTION_TONE_CLASS: Record<NonNullable<DossierSuggestedAction['tone']>, string> = {
  neutral: 'border-slate-200 bg-slate-50',
  info: 'border-blue-200 bg-blue-50/60',
  warning: 'border-amber-200 bg-amber-50/70',
  success: 'border-emerald-200 bg-emerald-50/60',
  danger: 'border-rose-200 bg-rose-50/70',
};

const TRACKER_TONE_CLASS: Record<NonNullable<DossierTrackerRow['stateTone']>, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
};

const TIMELINE_TONE_CLASS: Record<NonNullable<DossierTimelineItem['tone']>, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
};

function formatTimelineDate(value?: string): string {
  if (!value) return 'Chưa có thời điểm';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

function MetricCard({ item }: { item: PgdcnDossierBusinessWorkspaceProps['metrics'][number] }) {
  const tone = item.tone === 'success' ? 'text-emerald-700' : item.tone === 'warning' ? 'text-amber-700' : item.tone === 'info' ? 'text-blue-700' : 'text-slate-800';
  return <div className="rounded-xl border border-slate-200 bg-white p-2.5">
    <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{item.label}</div>
    <div className={'mt-1 text-lg font-black ' + tone}>{item.value}</div>
  </div>;
}


function ContextualActions({ actions }: { actions: DossierSuggestedAction[] }) {
  const visibleActions = actions.slice(0, 3);
  if (visibleActions.length === 0) return null;
  return <section className="rounded-xl border border-slate-200 bg-white p-3" data-testid="dossier-contextual-actions" aria-labelledby="dossier-contextual-actions-title">
    <div className="flex items-start gap-2">
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
      <div>
        <h4 id="dossier-contextual-actions-title" className="text-xs font-black text-slate-900">Gợi ý theo ngữ cảnh</h4>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">Đề xuất từ bằng chứng hiện có; bạn vẫn xác nhận trước khi mở hoặc sinh biểu mẫu.</p>
      </div>
    </div>
    <div className="mt-2 grid gap-2 md:grid-cols-3">
      {visibleActions.map((action) => <article key={action.id} className={'rounded-lg border p-2.5 ' + SUGGESTION_TONE_CLASS[action.tone || 'info']}>
        <h5 className="text-[11px] font-black text-slate-800">{action.title}</h5>
        <p className="mt-1 text-[11px] leading-4 text-slate-600">Vì sao: {action.reason}</p>
        <button type="button" onClick={action.onAction} className="mobile-touch-target mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-700 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
          <ArrowRight size={11} aria-hidden="true" />{action.actionLabel}
        </button>
      </article>)}
    </div>
  </section>;
}

function Tracker({ title, rows, emptyText, kind }: { title: string; rows: DossierTrackerRow[]; emptyText: string; kind: 'sample' | 'test' }) {
  const Icon = kind === 'sample' ? FlaskConical : FileCheck2;
  const [query, setQuery] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [lotFilter, setLotFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const normalized = query.trim().toLocaleLowerCase('vi-VN');
  const options = (key: 'session' | 'date' | 'lot' | 'state') => Array.from(new Set(rows.map((row) => key === 'state' ? row.state : row[key]).filter(Boolean) as string[])).sort((left, right) => left.localeCompare(right, 'vi'));
  const filteredRows = rows.filter((row) => {
    const matchesQuery = !normalized || [row.code, row.title, row.state, row.meta, row.detail, row.session, row.date, row.lot].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(normalized);
    return matchesQuery && (!sessionFilter || row.session === sessionFilter) && (!dateFilter || row.date === dateFilter) && (!lotFilter || row.lot === lotFilter) && (!statusFilter || row.state === statusFilter);
  });
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(safePage * pageSize, (safePage + 1) * pageSize);
  return <details className="rounded-xl border border-slate-200 bg-white" data-testid={'dossier-' + kind + '-tracker'}>
    <summary className="mobile-touch-target flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-black text-slate-800"><span className="flex items-center gap-2"><Icon size={14} className="text-blue-600" aria-hidden="true" />{title}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{rows.length} bản ghi</span></summary>
    <div className="border-t border-slate-100 p-2.5">
      {rows.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">{emptyText}</p> : <>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <input aria-label={'Tìm ' + (kind === 'sample' ? 'mẫu' : 'PYC PTN')} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} className="mobile-touch-target min-h-11 min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" placeholder="Tìm mã, trạng thái, PTN..." />
          {kind === 'sample' ? <select aria-label="Lọc theo phiên" value={sessionFilter} onChange={(event) => { setSessionFilter(event.target.value); setPage(0); }} className="mobile-touch-target min-h-11 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="">Tất cả phiên</option>{options('session').map((value) => <option key={value} value={value}>{value}</option>)}</select> : null}
          {kind === 'sample' ? <select aria-label="Lọc theo ngày" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(0); }} className="mobile-touch-target min-h-11 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="">Tất cả ngày</option>{options('date').map((value) => <option key={value} value={value}>{value}</option>)}</select> : null}
          {kind === 'sample' ? <select aria-label="Lọc theo lô" value={lotFilter} onChange={(event) => { setLotFilter(event.target.value); setPage(0); }} className="mobile-touch-target min-h-11 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="">Tất cả lô</option>{options('lot').map((value) => <option key={value} value={value}>{value}</option>)}</select> : null}
          <select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} className="mobile-touch-target min-h-11 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="">Tất cả trạng thái</option>{options('state').map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <span className="shrink-0 text-[11px] text-slate-500">{filteredRows.length}/{rows.length}</span>
        </div>
        <div className="space-y-1.5">{visibleRows.map((row) => <article key={row.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="font-mono text-[11px] font-black text-slate-800">{row.code}</div><div className="mt-0.5 text-[11px] font-bold text-slate-700">{row.title}</div></div><span className={'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ' + TRACKER_TONE_CLASS[row.stateTone || 'neutral']}>{row.state}</span></div>{row.meta ? <p className="mt-1 text-[11px] text-slate-500">{row.meta}</p> : null}{row.detail ? <p className="mt-1 text-[11px] leading-4 text-slate-600">{row.detail}</p> : null}</article>)}</div>
        {pageCount > 1 ? <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500"><span>Trang {safePage + 1}/{pageCount}</span><div className="flex gap-1"><button type="button" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="mobile-touch-target min-h-11 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold disabled:opacity-40">Trước</button><button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} className="mobile-touch-target min-h-11 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold disabled:opacity-40">Sau</button></div></div> : null}
      </>}
    </div>
  </details>;
}function EvidenceTracker({ title, groups, emptyText }: { title: string; groups: DossierEvidenceGroup[]; emptyText: string }) {
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return <details className="rounded-xl border border-slate-200 bg-white" data-testid="dossier-evidence-tracker">
    <summary className="mobile-touch-target flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-black text-slate-800">
      <span className="flex items-center gap-2"><FileCheck2 size={14} className="text-blue-600" aria-hidden="true" />{title}</span>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{total} mục</span>
    </summary>
    <div className="border-t border-slate-100 p-2.5">
      {groups.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">{emptyText}</p> : <div className="grid gap-2 md:grid-cols-2">
        {groups.map((group) => {
          const presentCount = group.rows.filter((row) => row.stateTone === 'success').length;
          return <section key={group.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5" aria-labelledby={'dossier-evidence-group-' + group.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h4 id={'dossier-evidence-group-' + group.id} className="text-[11px] font-black text-slate-800">{group.title}</h4>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-black text-slate-600">{presentCount}/{group.rows.length} có bằng chứng</span>
                {group.actionLabel && group.onAction ? <button type="button" onClick={group.onAction} className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-700 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><ArrowRight size={11} aria-hidden="true" />{group.actionLabel}</button> : null}
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              {group.rows.map((row) => <article key={row.id} className="rounded-lg border border-slate-100 bg-white p-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><div className="mt-0.5 text-[11px] font-bold text-slate-800">{row.title}</div><details className="mt-1 text-[11px] text-slate-400"><summary className="cursor-pointer font-bold">Thông tin kỹ thuật</summary><span className="font-mono">{row.code}</span></details></div>
                  <span className={'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ' + TRACKER_TONE_CLASS[row.stateTone || 'neutral']}>{row.state}</span>
                </div>
                {row.meta ? <p className="mt-1 text-[11px] text-slate-500">{row.meta}</p> : null}
                {row.detail ? <p className="mt-1 text-[11px] leading-4 text-slate-600">{row.detail}</p> : null}
              </article>)}
            </div>
          </section>;
        })}
      </div>}
    </div>
  </details>;
}

function Timeline({ title, items, emptyText }: { title: string; items: DossierTimelineItem[]; emptyText: string }) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return normalized ? items.filter((item) => [item.title, item.actor, item.location, item.detail].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(normalized)) : items;
  }, [items, query]);
  const visibleItems = showAll ? filteredItems : filteredItems.slice(0, 10);
  return <details className="rounded-xl border border-slate-200 bg-white" data-testid="dossier-event-timeline"><summary className="mobile-touch-target flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-black text-slate-800"><span className="flex items-center gap-2"><Clock3 size={14} className="text-blue-600" aria-hidden="true" />{title}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">{items.length} sự kiện</span></summary><div className="border-t border-slate-100 p-3">{items.length === 0 ? <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500">{emptyText}</p> : <><div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1"><input aria-label="Tìm sự kiện hồ sơ" value={query} onChange={(event) => setQuery(event.target.value)} className="mobile-touch-target min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" placeholder="Tìm sự kiện, người thực hiện..." /><span className="shrink-0 text-[11px] text-slate-500">{filteredItems.length}/{items.length}</span></div><ol className="space-y-3">{visibleItems.map((item) => <li key={item.id} className="relative pl-5"><span className={'absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ' + TIMELINE_TONE_CLASS[item.tone || 'neutral']} aria-hidden="true" /><div className="flex flex-wrap items-start justify-between gap-2"><div className="text-[11px] font-black text-slate-800">{item.title}</div><time className="text-[11px] text-slate-400" dateTime={item.occurredAt}>{formatTimelineDate(item.occurredAt)}</time></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1"><UserRound size={11} aria-hidden="true" />{item.actor || 'Chưa ghi nhận người thực hiện'}</span>{item.location ? <span className="inline-flex items-center gap-1"><MapPin size={11} aria-hidden="true" />{item.location}</span> : null}</div>{item.detail ? <p className="mt-1 text-[11px] leading-4 text-slate-600">{item.detail}</p> : null}</li>)}</ol>{filteredItems.length > 10 ? <button type="button" onClick={() => setShowAll((value) => !value)} className="mobile-touch-target mt-3 min-h-11 rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-black text-slate-700">{showAll ? 'Thu gọn' : `Xem thêm ${filteredItems.length - 10} sự kiện`}</button> : null}</>}</div></details>;
}
function FieldSessions({ sessions, onAction }: { sessions: DossierFieldSessionSummary[]; onAction?: () => void }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const visibleSessions = sessions.filter((session) => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return (!normalized || [session.sessionCode, session.objectLabel, session.location, session.inspectors, session.activityType].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(normalized)) && (!statusFilter || session.status === statusFilter);
  });
  const statuses = Array.from(new Set(sessions.map((session) => session.status)));
  return <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-3" data-testid="dossier-field-sessions" aria-labelledby="dossier-field-sessions-title">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-wide text-blue-600">PGD · Field Sessions</p><h4 id="dossier-field-sessions-title" className="mt-1 text-xs font-black text-slate-900">Các phiên hiện trường</h4><p className="mt-1 text-[11px] leading-4 text-slate-600">Mỗi phiên là một bản ghi độc lập; dữ liệu cũ vẫn được chuẩn hóa để xem chung.</p></div><span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[11px] font-black text-blue-700">{sessions.length} phiên</span></div>
    <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Tìm phiên hiện trường" value={query} onChange={(event) => setQuery(event.target.value)} className="mobile-touch-target min-h-11 min-w-[12rem] flex-1 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" placeholder="Tìm mã phiên, địa điểm, KTV..." /><select aria-label="Lọc trạng thái phiên" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mobile-touch-target min-h-11 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-[11px]"><option value="">Tất cả trạng thái</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
    <div className="mt-3 grid gap-2 md:grid-cols-2">{visibleSessions.map((session) => <article key={session.id} className="rounded-lg border border-blue-100 bg-white p-2.5"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-mono text-[11px] font-black text-slate-800">{session.sessionCode || session.id}</p><p className="mt-0.5 text-[11px] font-bold text-slate-700">{session.objectLabel || 'Chưa cập nhật đối tượng'}</p></div><span className={'rounded-full border px-2 py-0.5 text-[9px] font-black ' + TRACKER_TONE_CLASS[session.statusTone || 'neutral']}>{session.status}</span></div><div className="mt-2 grid gap-1 text-[11px] text-slate-600 sm:grid-cols-2"><span><CalendarDays size={11} className="mr-1 inline" aria-hidden="true" />Bắt đầu: {formatTimelineDate(session.occurredAt)}</span><span><CalendarDays size={11} className="mr-1 inline" aria-hidden="true" />Kết thúc: {formatTimelineDate(session.endedAt)}</span><span><MapPin size={11} className="mr-1 inline" aria-hidden="true" />{session.location || 'Chưa có địa điểm'}</span><span><UserRound size={11} className="mr-1 inline" aria-hidden="true" />{session.inspectors || 'Chưa có KTV'}</span><span>{session.activityType || 'Kiểm tra hiện trường'}</span><span>{session.quantity || 'Chưa có số lượng'} · {session.sampleCount ?? 0} mẫu</span></div>{session.observations ? <p className="mt-2 text-[11px] leading-4 text-slate-600">{session.observations}</p> : null}<div className="mt-2 flex flex-wrap gap-1.5">{session.onView ? <button type="button" onClick={session.onView} className="mobile-touch-target min-h-11 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-700">XEM</button> : null}{session.onEdit ? <button type="button" onClick={session.onEdit} className="mobile-touch-target min-h-11 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-black text-blue-700">SỬA</button> : null}</div></article>)}</div>
    {visibleSessions.length === 0 ? <p className="mt-2 rounded-lg border border-dashed border-blue-200 bg-white p-3 text-[11px] text-slate-500">Không có phiên phù hợp bộ lọc hiện tại.</p> : null}
    {onAction ? <button type="button" onClick={onAction} className="mobile-touch-target mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 text-[11px] font-black text-blue-700 hover:bg-blue-100"><ArrowRight size={13} aria-hidden="true" />THÊM PHIÊN HIỆN TRƯỜNG</button> : null}
  </section>;
}function EvidenceSummary({ sampleSummary, testSummary }: { sampleSummary?: PgdcnDossierBusinessWorkspaceProps['sampleSummary']; testSummary?: PgdcnDossierBusinessWorkspaceProps['testSummary'] }) {
  if (!sampleSummary && !testSummary) return null;
  const expected = sampleSummary?.expectedSampleCount ?? sampleSummary?.expectedUnits;
  const actualCount = sampleSummary?.actualSampleCount ?? sampleSummary?.sampleCount ?? 0;
  const actualQuantity = sampleSummary?.actualSampleQuantity ?? sampleSummary?.sampledUnits ?? 0;
  return <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" data-testid="dossier-evidence-summary">
    <div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Mẫu dự kiến</div><div className="mt-1 text-lg font-black text-slate-800">{expected === undefined ? 'Chưa xác định' : expected}</div><div className="mt-0.5 text-[11px] text-slate-500">Theo kế hoạch</div></div>
    <div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Mẫu đã lấy</div><div className="mt-1 text-lg font-black text-blue-700">{actualCount}</div><div className="mt-0.5 text-[11px] text-slate-500">Số entity mẫu</div></div>
    <div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Tổng lượng</div><div className="mt-1 text-lg font-black text-slate-800">{actualQuantity}</div><div className="mt-0.5 text-[11px] text-slate-500">Cộng quantity</div></div>
    <div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">PYC / KQTN</div><div className="mt-1 text-lg font-black text-slate-800">{testSummary?.requestCount ?? sampleSummary?.labRequestCount ?? 0} / {testSummary?.resultCount ?? sampleSummary?.resultCount ?? 0}</div><div className="mt-0.5 text-[11px] text-slate-500">Yêu cầu / đã nhận</div></div>
    <div className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Còn thiếu KQTN</div><div className="mt-1 text-lg font-black text-amber-700">{testSummary?.pendingCount ?? sampleSummary?.pendingLabRequestCount ?? 0}</div><div className="mt-0.5 text-[11px] text-slate-500">Chưa liên kết kết quả</div></div>
  </section>;
}export function PgdcnDossierBusinessWorkspace({ domain, title = 'Bản đồ hồ sơ nghiệp vụ', description = 'Một lớp nhìn theo công việc thật của hồ sơ; dữ liệu vẫn lấy từ các module hiện có.', nextAction, metrics, groups, blockers = [], suggestedActions = [], fieldSession, fieldSessions, sampleSummary, testSummary, evidenceTracker, sampleTracker, testTracker, timeline }: PgdcnDossierBusinessWorkspaceProps) {
  const accent = domain === 'PCN' ? 'indigo' : 'blue';
  return <section data-testid={'dossier-business-workspace-' + domain.toLowerCase()} className={'min-w-0 space-y-3 [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 ' + (accent === 'indigo' ? '[&_*:focus-visible]:ring-indigo-500' : '[&_*:focus-visible]:ring-blue-500')} aria-labelledby={'dossier-business-workspace-title-' + domain.toLowerCase()}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className={'text-[11px] font-black uppercase tracking-[0.16em] ' + (accent === 'indigo' ? 'text-indigo-600' : 'text-blue-600')}>{domain} · Work-first</p><h3 id={'dossier-business-workspace-title-' + domain.toLowerCase()} className="mt-1 text-sm font-black text-slate-900">{title}</h3><p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">{description}</p></div>
      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-black text-slate-500">Projection từ dữ liệu hiện có</span>
    </div>
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{metrics.map((item) => <MetricCard key={item.id} item={item} />)}</div>
    <section className={'rounded-xl border p-3 ' + (accent === 'indigo' ? 'border-indigo-200 bg-indigo-50/60' : 'border-blue-200 bg-blue-50/60')} data-testid="dossier-next-action-card">
      <div className="flex items-start gap-2"><ArrowRight size={16} className={'mt-0.5 shrink-0 ' + (accent === 'indigo' ? 'text-indigo-600' : 'text-blue-600')} aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Next Action</p><h4 className="mt-1 text-xs font-black text-slate-900">{nextAction.title}</h4><p className="mt-1 text-[11px] leading-4 text-slate-600">Vì sao: {nextAction.reason}</p><div className="mt-2 grid gap-1 text-[11px] text-slate-500 sm:grid-cols-3"><span>Phụ trách: <b className="text-slate-700">{nextAction.owner || 'Chưa phân công'}</b></span><span>Thiếu: <b className="text-slate-700">{nextAction.missing || 'Không có thiếu hụt đã biết'}</b></span><span>Trạng thái: <b className="text-slate-700">Đang theo dõi</b></span></div>{nextAction.actionLabel && nextAction.onAction ? <button type="button" onClick={nextAction.onAction} className={'mobile-touch-target mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[11px] font-black text-white ' + (accent === 'indigo' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-blue-600 hover:bg-blue-500')}><ArrowRight size={13} aria-hidden="true" />{nextAction.actionLabel}</button> : null}</div></div>
    </section>
    {suggestedActions.length > 0 ? <ContextualActions actions={suggestedActions} /> : null}
    {blockers.length > 0 ? <section className="rounded-xl border border-rose-200 bg-rose-50/70 p-3" data-testid="dossier-hard-blockers" aria-labelledby="dossier-hard-blockers-title"><div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" aria-hidden="true" /><div><h4 id="dossier-hard-blockers-title" className="text-xs font-black text-rose-900">Điểm chặn cần xử lý</h4><p className="mt-1 text-[11px] leading-4 text-rose-800">Chỉ hiển thị thiếu hụt đang cản bước hoặc cần bằng chứng; không thay thế cảnh báo nghiệp vụ trong từng module.</p></div></div><div className="mt-2 space-y-1.5">{blockers.map((blocker) => <div key={blocker.id} className="rounded-lg border border-rose-100 bg-white/80 p-2"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[11px] font-black text-slate-800">{blocker.title}</p><p className="mt-0.5 text-[11px] leading-4 text-slate-600">{blocker.reason}</p></div>{blocker.actionLabel && blocker.onAction ? <button type="button" onClick={blocker.onAction} className="mobile-touch-target min-h-11 rounded-md border border-rose-200 bg-white px-2.5 text-[11px] font-black text-rose-700 hover:bg-rose-50">{blocker.actionLabel}</button> : null}</div></div>)}</div></section> : <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] font-bold text-emerald-700" data-testid="dossier-no-hard-blockers"><CheckCircle2 size={14} aria-hidden="true" /> Chưa có điểm chặn cứng từ dữ liệu đang chiếu.</div>}
    <EvidenceSummary sampleSummary={sampleSummary} testSummary={testSummary} />
    {fieldSessions && fieldSessions.length > 0 ? <FieldSessions sessions={fieldSessions} onAction={fieldSession?.onAction} /> : null}
    {fieldSession && !fieldSessions?.length ? <section className="rounded-xl border border-blue-200 bg-blue-50/50 p-3" data-testid="dossier-field-session" aria-labelledby="dossier-field-session-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[9px] font-black uppercase tracking-wide text-blue-600">PGD · Field Session</p><h4 id="dossier-field-session-title" className="mt-1 text-xs font-black text-slate-900">Phiên hiện trường</h4><p className="mt-1 text-[11px] leading-4 text-slate-600">Một phiên ghi nhận có thời điểm, địa điểm, người thực hiện, đối tượng, quan sát, đo đạc, mẫu và bằng chứng.</p></div>
        <span className={'rounded-full border px-2 py-1 text-[9px] font-black ' + TRACKER_TONE_CLASS[fieldSession.statusTone || (fieldSession.exists ? 'info' : 'neutral')]}>{fieldSession.status}</span>
      </div>
      {fieldSession.exists ? <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-blue-100 bg-white p-2"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Thời điểm</div><div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-700"><CalendarDays size={12} aria-hidden="true" />{formatTimelineDate(fieldSession.occurredAt)}</div></div>
        <div className="rounded-lg border border-blue-100 bg-white p-2"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Địa điểm</div><div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-700"><MapPin size={12} aria-hidden="true" />{fieldSession.location || 'Chưa cập nhật'}</div></div>
        <div className="rounded-lg border border-blue-100 bg-white p-2"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Người thực hiện</div><div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-700"><UserRound size={12} aria-hidden="true" />{fieldSession.inspectors || 'Chưa cập nhật'}</div></div>
        <div className="rounded-lg border border-blue-100 bg-white p-2"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Đối tượng / số lượng</div><div className="mt-1 text-[11px] font-bold text-slate-700">{fieldSession.objectLabel || 'Chưa cập nhật'}{fieldSession.quantity ? ' · ' + fieldSession.quantity : ''}</div></div>
      </div> : <div className="mt-3 rounded-lg border border-dashed border-blue-200 bg-white p-3 text-[11px] text-slate-600">Chưa có phiên hiện trường được ghi nhận. Hãy mở work panel để nhập biên bản hiện trường; hệ thống không tự tạo sự kiện.</div>}
      {fieldSession.exists ? <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-white p-2.5"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Quan sát</div><p className="mt-1 text-[11px] leading-4 text-slate-700">{fieldSession.observations || 'Chưa có ghi nhận'}</p></div>
        <div className="rounded-lg border border-blue-100 bg-white p-2.5"><div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Đo đạc / mẫu / bằng chứng</div><p className="mt-1 text-[11px] leading-4 text-slate-700">{fieldSession.measurements || 'Chưa có số đo'}{fieldSession.sampleSummary ? ' · ' + fieldSession.sampleSummary : ''}{fieldSession.evidenceSummary ? ' · ' + fieldSession.evidenceSummary : ''}</p></div>
      </div> : null}
      {fieldSession.actionLabel && fieldSession.onAction ? <button type="button" onClick={fieldSession.onAction} className="mobile-touch-target mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 text-[11px] font-black text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"><ArrowRight size={13} aria-hidden="true" />{fieldSession.actionLabel}</button> : null}
    </section> : null}
    {evidenceTracker ? <EvidenceTracker title={evidenceTracker.title || 'Evidence Tracker · bộ chứng từ'} groups={evidenceTracker.groups} emptyText={evidenceTracker.emptyText} /> : null}
    <section className="grid gap-2 md:grid-cols-2" data-testid="dossier-business-groups">{groups.map((group) => <article key={group.id} className={'rounded-xl border p-3 ' + (group.status === 'BLOCKED' ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white')}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="text-[11px] font-black text-slate-800">{group.title}</h4><p className="mt-1 text-[11px] leading-4 text-slate-500">{group.description}</p></div><span className={'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ' + STATUS_CLASS[group.status]}>{group.statusLabel}</span></div><div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">{group.countLabel ? <span className="font-black text-slate-700">{group.countLabel}</span> : null}{group.meta ? <span>{group.meta}</span> : null}</div>{group.actionLabel && group.onAction ? <button type="button" onClick={group.onAction} className="mobile-touch-target mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-700 hover:border-blue-300 hover:bg-blue-50">{group.actionLabel}</button> : null}</article>)}</section>
    {sampleTracker || testTracker ? <div className="grid gap-2 md:grid-cols-2">{sampleTracker ? <Tracker title={sampleTracker.title || 'Theo dõi mẫu'} rows={sampleTracker.rows} emptyText={sampleTracker.emptyText} kind="sample" /> : null}{testTracker ? <Tracker title={testTracker.title || 'Theo dõi PYC/KQTN'} rows={testTracker.rows} emptyText={testTracker.emptyText} kind="test" /> : null}</div> : null}
    {timeline ? <Timeline title={timeline.title || 'Event Timeline / Work Log'} items={timeline.items} emptyText={timeline.emptyText} /> : null}
  </section>;
}

export default PgdcnDossierBusinessWorkspace;
