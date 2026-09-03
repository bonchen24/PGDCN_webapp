'use client';

import { AlertTriangle, ArrowRight, Award, Bell, Bot, CalendarClock, CheckCircle2, ClipboardCheck, FileCheck2, FolderOpen, Inbox, Plus, Timer, type LucideIcon } from 'lucide-react';

import type { AppNotification, CertificationDossier, DepartmentScope } from '../types';
import type { PgdInspectionRequest } from '../utils/pgdDomain';
import { getPgdcnDashboardProjection, type DashboardPipelineTone, type PgdcnDashboardDomainSummary, type PgdcnDashboardUpcomingItem } from '../utils/pgdcnDashboard';

type PgdcnDashboardViewProps = {
  scopes: readonly DepartmentScope[];
  pcnDossiers: readonly CertificationDossier[];
  pgdRequests: readonly PgdInspectionRequest[];
  notifications: readonly AppNotification[];
  onOpenPcn: (dossierId: string) => void;
  onOpenPgd: (requestId: string) => void;
  onOpenPcnWorkspace: () => void;
  onOpenPgdWorkspace: () => void;
  onOpenNotifications: () => void;
  onSelectNotification: (notification: AppNotification) => void;
};

const DOMAIN_CONFIG = {
  PCN: {
    eyebrow: 'CHỨNG NHẬN',
    title: 'Chứng nhận PCN',
    description: 'Hồ sơ chứng nhận, PYC liên phòng và phát hành.',
    actionLabel: 'Mở workspace PCN',
    icon: Award,
    panel: 'border-emerald-200',
    accent: 'text-emerald-700',
    soft: 'bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  PGD: {
    eyebrow: 'GIÁM ĐỊNH',
    title: 'Giám định PGD',
    description: 'PYC, hiện trường, PTN, báo cáo và chứng thư.',
    actionLabel: 'Mở workspace PGD',
    icon: ClipboardCheck,
    panel: 'border-blue-200',
    accent: 'text-blue-700',
    soft: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
  },
} as const;

const PIPELINE_TONE_CLASS: Record<DashboardPipelineTone, string> = {
  neutral: 'bg-slate-300',
  info: 'bg-sky-400',
  warning: 'bg-amber-400',
  success: 'bg-emerald-500',
  critical: 'bg-rose-500',
};

const formatCount = (value: number): string => new Intl.NumberFormat('vi-VN').format(value);

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string }) {
  return (
    <article className="flex min-w-0 min-h-[108px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon size={16} /></div>
      <div className="mt-3 min-w-0">
        <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-black tracking-tight text-slate-900">{formatCount(value)}</p>
      </div>
    </article>
  );
}

function CommandHeader({ scopes, onOpenPcnWorkspace, onOpenPgdWorkspace }: Pick<PgdcnDashboardViewProps, 'scopes' | 'onOpenPcnWorkspace' | 'onOpenPgdWorkspace'>) {
  return (
    <header className="relative min-w-0 overflow-hidden rounded-[1.75rem] bg-slate-900 p-5 text-white shadow-lg md:p-6">
      <span className="pointer-events-none absolute right-8 top-7 h-2 w-16 rounded-full bg-emerald-400/70" aria-hidden="true" />
      <span className="pointer-events-none absolute right-8 top-12 h-2 w-10 rounded-full bg-blue-400/70" aria-hidden="true" />
      <div className="relative flex min-w-0 flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">IEMM • TVCI · PGDCN</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">Điều hành phòng</h1>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-300 md:text-sm">Tập trung vào hồ sơ đang chờ, điểm nghẽn và mốc vận hành tiếp theo của Giám định và Chứng nhận.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {scopes.includes('PCN') && (
            <button type="button" onClick={onOpenPcnWorkspace} className="mobile-touch-target inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-3.5 text-[11px] font-black text-white shadow-sm transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300">
              <Plus size={16} /> Tạo Đề nghị
            </button>
          )}
          {scopes.includes('PGD') && (
            <button type="button" onClick={onOpenPgdWorkspace} className="mobile-touch-target inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-500 px-3.5 text-[11px] font-black text-white shadow-sm transition hover:bg-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300">
              <Inbox size={16} /> Tiếp nhận PYC
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function AttentionQueue({ items, onOpenPcn, onOpenPgd }: Pick<PgdcnDashboardViewProps, 'onOpenPcn' | 'onOpenPgd'> & { items: ReturnType<typeof getPgdcnDashboardProjection>['attention'] }) {
  return (
    <section data-testid="pgdcn-dashboard-attention-queue" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2"><Timer size={17} className="text-amber-500" /><h2 className="text-base font-black text-slate-900">Hàng đợi hành động</h2></div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Ưu tiên hồ sơ quá hạn, sau đó đến các trạng thái đang cần xử lý.</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">{formatCount(items.length)} hồ sơ</span>
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {items.map((item) => {
          const isPcn = item.domain === 'PCN';
          const open = isPcn ? () => onOpenPcn(item.id) : () => onOpenPgd(item.id);
          return (
            <button key={`${item.domain}-${item.id}`} type="button" onClick={open} aria-label={`Mở ${item.domain} ${item.label}`} className="mobile-touch-target group flex min-h-[68px] w-full min-w-0 items-center gap-3 py-2.5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-300">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.reason === 'OVERDUE' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                {item.reason === 'OVERDUE' ? <AlertTriangle size={17} /> : <Timer size={17} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${isPcn ? DOMAIN_CONFIG.PCN.badge : DOMAIN_CONFIG.PGD.badge}`}>{item.domain}</span>
                  <b className="min-w-0 truncate text-xs font-black text-slate-800">{item.label}</b>
                </span>
                <span className="mt-1 block truncate text-[10px] text-slate-500">{item.statusLabel} · {item.reason === 'OVERDUE' ? 'Quá hạn' : 'Đang chờ xử lý'}{item.dueLabel ? ` · ${item.dueLabel}` : ''}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-slate-300 transition group-hover:text-slate-700" />
            </button>
          );
        })}
        {items.length === 0 && <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center"><CheckCircle2 size={28} className="text-emerald-500" /><p className="text-[11px] font-bold text-slate-500">Không có hồ sơ cần chú ý.</p></div>}
      </div>
    </section>
  );
}

function DomainPipelineCard({ summary, onOpen }: { summary: PgdcnDashboardDomainSummary; onOpen: () => void }) {
  const config = DOMAIN_CONFIG[summary.domain];
  const Icon = config.icon;
  const barDescription = summary.segments.map((segment) => `${segment.label}: ${segment.count}`).join(', ') || 'Chưa có dữ liệu';
  return (
    <article className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm ${config.panel}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.soft} ${config.accent}`}><Icon size={19} /></span>
          <div className="min-w-0"><p className={`text-[10px] font-black uppercase tracking-[0.16em] ${config.accent}`}>{config.eyebrow}</p><h3 className="mt-1 truncate text-sm font-black text-slate-900">{config.title}</h3><p className="mt-1 text-[10px] leading-4 text-slate-500">{config.description}</p></div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${config.badge}`}>{summary.domain}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-xl bg-slate-50 p-2"><span className="block truncate text-[9px] font-bold text-slate-500">Tổng hồ sơ</span><b className="mt-1 block text-lg font-black text-slate-900">{formatCount(summary.total)}</b></div>
        <div className="min-w-0 rounded-xl bg-amber-50 p-2"><span className="block truncate text-[9px] font-bold text-slate-500">Đang xử lý</span><b className="mt-1 block text-lg font-black text-amber-700">{formatCount(summary.work)}</b></div>
        <div className="min-w-0 rounded-xl bg-rose-50 p-2"><span className="block truncate text-[9px] font-bold text-slate-500">Cần chú ý</span><b className="mt-1 block text-lg font-black text-rose-700">{formatCount(summary.attention)}</b></div>
      </div>
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3"><p className="text-[9px] font-black uppercase tracking-wide text-slate-400">Điểm nghẽn ưu tiên</p><p className="mt-1 truncate text-xs font-black text-slate-800">{summary.bottleneckLabel} <span className="font-bold text-slate-400">· {formatCount(summary.bottleneckCount)} hồ sơ</span></p></div>
      <div className="mt-3" role="img" aria-label={`Phân bổ trạng thái ${config.title}: ${barDescription}`}>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          {summary.segments.map((segment) => <span key={segment.key} className={PIPELINE_TONE_CLASS[segment.tone]} style={{ width: `${summary.total ? (segment.count / summary.total) * 100 : 0}%` }} />)}
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1">{summary.segments.map((segment) => <span key={segment.key} className="inline-flex min-w-0 items-center gap-1 text-[9px] text-slate-500"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PIPELINE_TONE_CLASS[segment.tone]}`} />{segment.label}: <b className="text-slate-700">{segment.count}</b></span>)}</div>
      </div>
      <button type="button" onClick={onOpen} aria-label={config.actionLabel} className={`mobile-touch-target mt-3 inline-flex min-h-10 items-center gap-1 text-[10px] font-black ${config.accent} focus:outline-none focus:ring-2 focus:ring-slate-300`}>{config.actionLabel} <ArrowRight size={14} /></button>
    </article>
  );
}

function DomainPipeline({ summaries, onOpenPcnWorkspace, onOpenPgdWorkspace }: Pick<PgdcnDashboardViewProps, 'onOpenPcnWorkspace' | 'onOpenPgdWorkspace'> & { summaries: PgdcnDashboardDomainSummary[] }) {
  return (
    <section data-testid="pgdcn-dashboard-domain-cards" className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2"><div><h2 className="text-base font-black text-slate-900">Pipeline theo miền</h2><p className="mt-1 text-[11px] text-slate-500">Tách biệt dữ liệu nhưng nhìn chung một nhịp vận hành.</p></div><FolderOpen size={17} className="text-slate-400" /></div>
      {summaries.map((summary) => <DomainPipelineCard key={summary.domain} summary={summary} onOpen={summary.domain === 'PCN' ? onOpenPcnWorkspace : onOpenPgdWorkspace} />)}
      {summaries.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-[11px] text-slate-400">Chưa có miền dữ liệu được cấp quyền.</div>}
    </section>
  );
}

function UpcomingMilestones({ items, onOpenPcn, onOpenPgd }: Pick<PgdcnDashboardViewProps, 'onOpenPcn' | 'onOpenPgd'> & { items: PgdcnDashboardUpcomingItem[] }) {
  return (
    <section data-testid="pgdcn-dashboard-upcoming" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-2"><CalendarClock size={17} className="text-blue-500" /><h2 className="text-base font-black text-slate-900">Mốc sắp tới</h2></div><p className="mt-1 text-[11px] text-slate-500">Các hạn xử lý và lịch giám định gần nhất.</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">{items.length}/5</span></div>
      <div className="mt-4 divide-y divide-slate-100">
        {items.map((item) => <button key={`${item.domain}-${item.id}`} type="button" onClick={() => item.domain === 'PCN' ? onOpenPcn(item.id) : onOpenPgd(item.id)} aria-label={`Mở ${item.domain} ${item.label}`} className="mobile-touch-target flex min-h-[62px] w-full min-w-0 items-center gap-3 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-300"><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${item.domain === 'PCN' ? DOMAIN_CONFIG.PCN.badge : DOMAIN_CONFIG.PGD.badge}`}>{item.domain}</span><span className="min-w-0 flex-1"><b className="block truncate text-xs font-black text-slate-800">{item.label}</b><span className="mt-1 block truncate text-[10px] text-slate-500">{item.milestoneLabel} · {item.statusLabel}</span></span><span className="shrink-0 text-right"><b className="block text-[10px] font-black text-slate-700">{item.dateLabel}</b><ArrowRight size={14} className="ml-auto mt-1 text-slate-300" /></span></button>)}
        {items.length === 0 && <p className="py-8 text-center text-[11px] text-slate-400">Chưa có mốc sắp tới.</p>}
      </div>
    </section>
  );
}

function SharedNotifications({ notifications, onOpenNotifications, onSelectNotification }: Pick<PgdcnDashboardViewProps, 'notifications' | 'onOpenNotifications' | 'onSelectNotification'>) {
  return (
    <section data-testid="pgdcn-dashboard-notifications" className="min-w-0 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex min-w-0 items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Bell size={16} /></span><div className="min-w-0"><h2 className="text-base font-black text-slate-900">Thông báo phòng</h2><p className="mt-1 truncate text-[11px] text-slate-500">Một luồng chung cho PCN và PGD.</p></div></div><button type="button" onClick={onOpenNotifications} className="mobile-touch-target shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-black text-violet-700 transition hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-200">Xem tất cả</button></div>
      <div className="mt-4 divide-y divide-slate-100">
        {notifications.slice(0, 5).map((notification) => { const isPgd = notification.domain === 'PGD'; const date = new Date(notification.createdAt); const dateLabel = Number.isFinite(date.getTime()) ? date.toLocaleDateString('vi-VN') : 'Mới'; return <button key={notification.id} type="button" onClick={() => onSelectNotification(notification)} aria-label={`Mở thông báo ${notification.title}`} className={`mobile-touch-target flex min-h-[62px] w-full min-w-0 items-start gap-2.5 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-200 ${notification.read ? '' : 'bg-violet-50/60'}`}><span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${isPgd ? DOMAIN_CONFIG.PGD.badge : DOMAIN_CONFIG.PCN.badge}`}>{isPgd ? 'PGD' : 'PCN'}</span><span className="min-w-0 flex-1"><b className="block truncate text-[11px] font-black text-slate-800">{notification.title}</b><span className="mt-1 block truncate text-[10px] text-slate-500">{notification.message}</span></span><span className="shrink-0 text-[9px] text-slate-400">{dateLabel}</span></button>; })}
        {notifications.length === 0 && <p className="py-8 text-center text-[11px] text-slate-400">Chưa có thông báo phòng.</p>}
      </div>
    </section>
  );
}

export default function PgdcnDashboardView({ scopes, pcnDossiers, pgdRequests, notifications, onOpenPcn, onOpenPgd, onOpenPcnWorkspace, onOpenPgdWorkspace, onOpenNotifications, onSelectNotification }: PgdcnDashboardViewProps) {
  const projection = getPgdcnDashboardProjection({ scopes, pcnDossiers, pgdRequests });
  return (
    <section className="pcn-page-surface min-w-0 space-y-4 bg-slate-50/70 p-3 pb-5 md:space-y-5 md:p-5 mobile-safe-bottom" aria-label="Điều hành phòng PGDCN">
      <CommandHeader scopes={scopes} onOpenPcnWorkspace={onOpenPcnWorkspace} onOpenPgdWorkspace={onOpenPgdWorkspace} />
      <div data-testid="pgdcn-dashboard-kpi-grid" className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-6"><Kpi label="Hồ sơ PCN" value={projection.kpis.pcnDossiers} icon={Award} tone="bg-emerald-50 text-emerald-600" /><Kpi label="Hồ sơ PGD" value={projection.kpis.pgdRequests} icon={ClipboardCheck} tone="bg-blue-50 text-blue-600" /><Kpi label="PCN cần xử lý" value={projection.kpis.pcnWork} icon={FolderOpen} tone="bg-amber-50 text-amber-600" /><Kpi label="PGD cần xử lý" value={projection.kpis.pgdWork} icon={FileCheck2} tone="bg-indigo-50 text-indigo-600" /><Kpi label="Hồ sơ cần AI hỗ trợ" value={projection.kpis.aiCandidates} icon={Bot} tone="bg-violet-50 text-violet-600" /><Kpi label="Quá hạn / cần chú ý" value={projection.kpis.attention} icon={AlertTriangle} tone="bg-rose-50 text-rose-600" /></div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.85fr)]"><AttentionQueue items={projection.attention} onOpenPcn={onOpenPcn} onOpenPgd={onOpenPgd} /><DomainPipeline summaries={projection.domainSummaries} onOpenPcnWorkspace={onOpenPcnWorkspace} onOpenPgdWorkspace={onOpenPgdWorkspace} /></div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-2"><UpcomingMilestones items={projection.upcoming} onOpenPcn={onOpenPcn} onOpenPgd={onOpenPgd} /><SharedNotifications notifications={notifications} onOpenNotifications={onOpenNotifications} onSelectNotification={onSelectNotification} /></div>
    </section>
  );
}
