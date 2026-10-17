'use client';

import { formatDateDdMmYyyy } from '../utils/formatter';
import { getPgdcnNotificationActionLabel } from '../utils/pgdcnNotification';

import { AlertTriangle, ArrowRight, Award, Bell, Bot, CalendarClock, CheckCircle2, ClipboardCheck, FileCheck2, FolderOpen, Inbox, Plus, Timer, type LucideIcon } from 'lucide-react';

import type { AppNotification, CertificationDossier, CertificationProposal, DepartmentScope, PcnDossierWorkflowTask, UserAccount } from '../types';
import type { PgdInspectionRequest } from '../utils/pgdDomain';
import { PgdcnStatusBadge } from './PgdcnUiPrimitives';
import type { PgdcnRecentRecord } from '../utils/pgdcnRecent';
import { getPgdcnDashboardProjection, getPgdcnMyWorkProjection, type DashboardPipelineTone, type PgdcnDashboardDomainSummary, type PgdcnDashboardUpcomingItem, type PgdcnMyWorkItem, type PgdcnMyWorkProjection, type PgdcnNextAction } from '../utils/pgdcnDashboard';

type PgdcnDashboardViewProps = {
  scopes: readonly DepartmentScope[];
  pcnDossiers: readonly CertificationDossier[];
  pgdRequests: readonly PgdInspectionRequest[];
  currentUser?: UserAccount;
  pcnProposals?: readonly CertificationProposal[];
  pcnWorkflowTasks?: readonly PcnDossierWorkflowTask[];
  pcnEvidenceActions?: Readonly<Record<string, PgdcnNextAction>>;
  pgdAssignments?: readonly { requestId: string; leadInspectorUsername?: string; inspectorUsernames?: readonly string[]; technicalReviewerUsername?: string }[];
  notifications: readonly AppNotification[];
  onOpenPcn: (dossierId: string) => void;
  onOpenPgd: (requestId: string) => void;
  onOpenPcnWorkspace: () => void;
  onOpenPgdWorkspace: () => void;
  onOpenNotifications: () => void;
  onSelectNotification: (notification: AppNotification) => void;
  recentRecords?: readonly PgdcnRecentRecord[];
};

const DOMAIN_CONFIG = {
  PCN: {
    eyebrow: 'CHỨNG NHẬN',
    title: 'Chứng nhận PCN',
    description: 'Hồ sơ chứng nhận, PYC liên phòng và phát hành.',
    actionLabel: 'Mở workspace PCN',
    icon: Award,
    panel: 'border-slate-200',
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
    panel: 'border-slate-200',
    accent: 'text-blue-700',
    soft: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
  },
} as const;

const PIPELINE_TONE_CLASS: Record<DashboardPipelineTone, string> = {
  neutral: 'bg-slate-300',
  info: 'bg-blue-400',
  warning: 'bg-amber-400',
  success: 'bg-emerald-500',
  critical: 'bg-rose-500',
  cyan: 'bg-blue-400',
  indigo: 'bg-blue-400',
  purple: 'bg-slate-300',
  orange: 'bg-amber-400',
  teal: 'bg-emerald-500',
};

const formatCount = (value: number): string => new Intl.NumberFormat('vi-VN').format(value);

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: string }) {
  return (
    <article className="pgdcn-kpi-card gap-2 rounded-lg px-2 py-2">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${tone}`}><Icon size={14} /></div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-[11px] font-bold leading-4 text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-bold leading-5 tracking-tight text-slate-900">{formatCount(value)}</p>
      </div>
    </article>
  );
}

function CommandHeader({ scopes, onOpenPcnWorkspace, onOpenPgdWorkspace }: Pick<PgdcnDashboardViewProps, 'scopes' | 'onOpenPcnWorkspace' | 'onOpenPgdWorkspace'>) {
  const primaryDomain = scopes.includes('PCN') ? 'PCN' : 'PGD';

  return (
    <header className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-sm">
      <div className="flex min-w-0 flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">IEMM • TVCI · PGDCN</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 md:text-2xl">Điều hành phòng</h1>
          <p className="mt-0.5 max-w-xl text-xs leading-4 text-slate-600">Tập trung vào hồ sơ đang chờ, điểm nghẽn và mốc vận hành tiếp theo của Giám định và Chứng nhận.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {scopes.includes('PCN') && (
            <button type="button" onClick={onOpenPcnWorkspace} className={`mobile-touch-target inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 ${primaryDomain === 'PCN' ? 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-300 shadow-xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300'}`}>
              <Plus size={16} /> Tạo Đề nghị
            </button>
          )}
          {scopes.includes('PGD') && (
            <button type="button" onClick={onOpenPgdWorkspace} className={`mobile-touch-target inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 ${primaryDomain === 'PGD' ? 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-300 shadow-xs' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-300'}`}>
              <Inbox size={16} /> Tạo PYC
            </button>
          )}
        </div>
      </div>
    </header>
  );
}


const WORK_BUCKET_LABELS: Record<string, string> = { OVERDUE: 'QUÁ HẠN', TODAY: 'CẦN LÀM HÔM NAY', MY_TURN: 'ĐANG CHỜ TÔI XỬ LÝ', APPROVAL: 'CHỜ PHÊ DUYỆT', RECENT: 'GẦN ĐÂY' };

function WorkItemCard({ item, onOpenPcn, onOpenPgd }: { item: PgdcnMyWorkItem; onOpenPcn: (id: string) => void; onOpenPgd: (id: string) => void }) {
  const isPcn = item.domain === 'PCN';
  const hasUnknownStatus = item.statusLabel === 'Chưa xác định';
  const actionHintId = `pgdcn-action-hint-${item.domain}-${encodeURIComponent(item.id)}`;
  return <article role="row" className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 border-b border-slate-100 px-3 py-3 last:border-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,1fr)] lg:items-center lg:py-2">
    <div role="cell" className="min-w-0">
      <span aria-hidden="true" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">Mã hồ sơ / khách hàng</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"><span className={'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ' + (isPcn ? DOMAIN_CONFIG.PCN.badge : DOMAIN_CONFIG.PGD.badge)}>{item.domain}</span><b className="min-w-0 break-words text-sm font-semibold text-slate-900">{item.label}</b></div>
      <p className="mt-1 break-words text-xs font-medium text-slate-700">{item.customerName}{item.productName ? ' · ' + item.productName : ''}</p>
    </div>
    <div role="cell" className="min-w-0">
      <span aria-hidden="true" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">Trạng thái</span>
      <PgdcnStatusBadge domain={item.domain} status={item.status} label={item.statusLabel} />
      {hasUnknownStatus && <p className="mt-1 break-words text-xs leading-4 text-amber-800">Trạng thái chưa xác định. Mở hồ sơ để kiểm tra bước phù hợp.</p>}
    </div>
    <div role="cell" className="min-w-0 break-words text-xs leading-4 text-slate-700">
      <span aria-hidden="true" className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">Bước hiện tại</span>
      {item.currentStepLabel}
    </div>
    <div role="cell" className="min-w-0 break-words text-xs leading-4 text-slate-700">
      <span aria-hidden="true" className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">Hạn xử lý</span>
      {item.isOverdue ? <span className="inline-flex min-w-0 flex-wrap items-center gap-1 font-semibold text-rose-700"><AlertTriangle size={13} aria-hidden="true" />Quá hạn · <span className="font-normal text-slate-700">{item.dueLabel || 'Chưa đặt hạn'}</span></span> : item.dueLabel || 'Chưa đặt hạn'}
    </div>
    <div role="cell" className="min-w-0">
      <span aria-hidden="true" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:hidden">Hành động tiếp theo</span>
      <button type="button" onClick={() => isPcn ? onOpenPcn(item.id) : onOpenPgd(item.id)} className={'mobile-touch-target inline-flex min-h-11 w-full max-w-full items-center justify-center gap-2 whitespace-normal rounded-lg px-3 py-2 text-center text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 lg:w-auto ' + (isPcn ? 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-300' : 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-300')} aria-label={item.nextAction.label + ' ' + item.label} aria-describedby={actionHintId}>Mở hồ sơ · {item.nextAction.label}<ArrowRight size={15} aria-hidden="true" /></button>
      <span id={actionHintId} className="sr-only">Chọn để mở hồ sơ và thực hiện bước tiếp theo: {item.nextAction.label}.</span>
      <p className="mt-1 break-words text-xs leading-4 text-slate-600"><span className="font-semibold text-slate-700">Bước tiếp theo:</span> {item.nextAction.label}. {item.nextAction.description}</p>
    </div>
  </article>;
}

function MyWorkSection({ projection, currentUser, onOpenPcn, onOpenPgd }: { projection: PgdcnMyWorkProjection; currentUser?: UserAccount; onOpenPcn: (id: string) => void; onOpenPgd: (id: string) => void }) {
  const buckets = ['OVERDUE', 'TODAY', 'MY_TURN', 'APPROVAL', 'RECENT'] as const;
  const name = currentUser?.name || currentUser?.username || 'bạn';
  const count = buckets.reduce((total, bucket) => total + projection.buckets[bucket].length, 0);
  return <section data-testid="pgdcn-dashboard-my-work" className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex min-w-0 flex-col justify-between gap-2 lg:flex-row lg:items-center"><div className="min-w-0"><h2 className="break-words text-lg font-bold tracking-tight text-slate-900">Việc của tôi</h2><p className="mt-1 text-xs leading-4 text-slate-600">Xin chào, {name}. Các hồ sơ đang cần bạn xử lý, ưu tiên theo hạn và lượt xử lý hiện tại.</p></div><div role="group" aria-label={`${count} hồ sơ cần xử lý`} className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tổng việc cần xử lý</span><b className="text-xl font-black leading-6 text-slate-900">{formatCount(count)}</b></div></div>
    <div className="mt-3 space-y-3">{buckets.map((bucket) => { const items = projection.buckets[bucket]; if (!items.length) return null; return <div key={bucket}><div className="mb-1.5 flex items-center gap-2"><span aria-hidden="true" className={'h-2 w-2 rounded-full ' + (bucket === 'OVERDUE' ? 'bg-rose-500' : bucket === 'APPROVAL' ? 'bg-violet-500' : bucket === 'TODAY' ? 'bg-amber-500' : bucket === 'RECENT' ? 'bg-slate-400' : 'bg-emerald-500')} /><h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">{WORK_BUCKET_LABELS[bucket]}</h3><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{items.length}</span></div><div role="table" aria-label={WORK_BUCKET_LABELS[bucket]} className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white"><div role="row" className="sr-only lg:not-sr-only lg:grid border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.75fr)_minmax(0,1fr)] lg:gap-x-4"><span role="columnheader">Mã hồ sơ / khách hàng</span><span role="columnheader">Trạng thái</span><span role="columnheader">Bước hiện tại</span><span role="columnheader">Hạn xử lý</span><span role="columnheader">Hành động tiếp theo</span></div>{items.map((item) => <WorkItemCard key={item.domain + '-' + item.id} item={item} onOpenPcn={onOpenPcn} onOpenPgd={onOpenPgd} />)}</div></div>; })}{count === 0 && <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={24} aria-hidden="true" /><p className="mt-2 text-sm font-bold text-slate-800">{projection.waitingOthers.length > 0 ? 'Hiện chưa có hồ sơ đến lượt bạn xử lý.' : 'Bạn chưa có hồ sơ đến lượt xử lý.'}</p><p className="mt-1 text-xs text-slate-600">{projection.waitingOthers.length > 0 ? `${projection.waitingOthers.length} hồ sơ đang chờ người khác xử lý; mở danh sách bên dưới để theo dõi.` : 'Khi hồ sơ được giao cho bạn, bước tiếp theo sẽ xuất hiện tại đây.'}</p></div>}</div>
    {projection.waitingOthers.length > 0 && <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5"><summary className="mobile-touch-target min-h-11 w-full cursor-pointer justify-start rounded-md px-1 text-left text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Đang chờ người khác · {projection.waitingOthers.length} hồ sơ</summary><div className="mt-2 grid gap-2 md:grid-cols-2">{projection.waitingOthers.slice(0, 6).map((item) => <button key={item.domain + '-' + item.id} type="button" onClick={() => item.domain === 'PCN' ? onOpenPcn(item.id) : onOpenPgd(item.id)} className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"><span className="text-xs font-semibold text-slate-800">{item.label}</span><span className="mt-1 block text-xs text-slate-500">{item.statusLabel} · {item.ownerLabel}</span></button>)}</div></details>}
  </section>;
}

function AttentionQueue({ items, onOpenPcn, onOpenPgd }: Pick<PgdcnDashboardViewProps, 'onOpenPcn' | 'onOpenPgd'> & { items: ReturnType<typeof getPgdcnDashboardProjection>['attention'] }) {
  return (
    <section data-testid="pgdcn-dashboard-attention-queue" className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2"><Timer size={16} className="shrink-0 text-amber-500" /><h2 className="min-w-0 break-words text-sm font-semibold text-slate-900">Việc cần chú ý <span className="font-normal text-slate-400">· Hàng đợi hành động</span></h2></div>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">Ưu tiên hồ sơ quá hạn, sau đó đến các trạng thái đang cần xử lý.</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{formatCount(items.length)} hồ sơ</span>
      </div>
      <div className="mt-2 divide-y divide-slate-100">
        {items.map((item) => {
          const isPcn = item.domain === 'PCN';
          const open = isPcn ? () => onOpenPcn(item.id) : () => onOpenPgd(item.id);
          return (
            <button key={`${item.domain}-${item.id}`} type="button" onClick={open} aria-label={`Mở ${item.domain} ${item.label}`} className="mobile-touch-target group flex min-h-12 w-full min-w-0 items-center gap-2.5 py-1.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.reason === 'OVERDUE' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                {item.reason === 'OVERDUE' ? <AlertTriangle size={17} /> : <Timer size={17} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${isPcn ? DOMAIN_CONFIG.PCN.badge : DOMAIN_CONFIG.PGD.badge}`}>{item.domain}</span>
                  <b className="min-w-0 flex-1 break-words text-sm font-semibold text-slate-800">{item.label}</b>
                </span>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5"><PgdcnStatusBadge compact domain={item.domain} status={item.status} label={item.statusLabel} tone={item.reason === 'OVERDUE' ? 'critical' : undefined} /><span className="text-xs text-slate-500">{item.reason === 'OVERDUE' ? 'Quá hạn' : 'Đang chờ xử lý'}{item.dueLabel ? ' · ' + item.dueLabel : ''}</span></div>
              </span>
              <ArrowRight size={16} className="shrink-0 text-slate-300 group-hover:text-slate-700" />
            </button>
          );
        })}
        {items.length === 0 && <div className="flex min-h-20 flex-col items-center justify-center gap-2 text-center"><CheckCircle2 size={24} className="text-emerald-500" /><p className="text-sm font-bold text-slate-700">Không có hồ sơ cần chú ý.</p></div>}
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
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${config.soft} ${config.accent}`}><Icon size={19} /></span>
          <div className="min-w-0"><p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${config.accent}`}>{config.eyebrow}</p><h3 className="mt-1 break-words text-sm font-semibold text-slate-900">{config.title}</h3><p className="mt-1 break-words text-[10px] leading-4 text-slate-500">{config.description}</p></div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${config.badge}`}>{summary.domain}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-lg bg-slate-50 p-2"><span className="block break-words text-xs font-bold leading-4 text-slate-500">Tổng hồ sơ</span><b className="mt-1 block text-lg font-bold text-slate-900">{formatCount(summary.total)}</b></div>
        <div className="min-w-0 rounded-lg bg-amber-50 p-2"><span className="block break-words text-xs font-bold leading-4 text-slate-500">Đang xử lý</span><b className="mt-1 block text-lg font-bold text-amber-700">{formatCount(summary.work)}</b></div>
        <div className="min-w-0 rounded-lg bg-rose-50 p-2"><span className="block break-words text-xs font-bold leading-4 text-slate-500">Cần chú ý</span><b className="mt-1 block text-lg font-bold text-rose-700">{formatCount(summary.attention)}</b></div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Điểm nghẽn ưu tiên</p><p className="mt-1 break-words text-xs font-semibold text-slate-800">{summary.bottleneckLabel} <span className="font-bold text-slate-400">· {formatCount(summary.bottleneckCount)} hồ sơ</span></p></div>
      <div className="mt-3" role="img" aria-label={`Phân bổ trạng thái ${config.title}: ${barDescription}`}>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          {summary.segments.map((segment) => <span key={segment.key} className={PIPELINE_TONE_CLASS[segment.tone]} style={{ width: `${summary.total ? (segment.count / summary.total) * 100 : 0}%` }} />)}
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap gap-x-3 gap-y-1">{summary.segments.map((segment) => <span key={segment.key} className="inline-flex min-w-0 items-center gap-1 text-[11px] text-slate-600"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PIPELINE_TONE_CLASS[segment.tone]}`} />{segment.label}: <b className="text-slate-700">{segment.count}</b></span>)}</div>
      </div>
      <button type="button" onClick={onOpen} aria-label={config.actionLabel} className={`mobile-touch-target mt-4 inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 text-sm font-bold ${config.accent} hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300`}>{config.actionLabel} <ArrowRight size={14} /></button>
    </article>
  );
}

function DomainPipeline({ summaries, onOpenPcnWorkspace, onOpenPgdWorkspace }: Pick<PgdcnDashboardViewProps, 'onOpenPcnWorkspace' | 'onOpenPgdWorkspace'> & { summaries: PgdcnDashboardDomainSummary[] }) {
  return (
    <section data-testid="pgdcn-dashboard-domain-cards" className="mobile-scroll-x min-w-0 space-y-4 lg:overflow-x-visible">
      <div className="flex items-center justify-between gap-2"><div><h2 className="text-base font-semibold text-slate-900">Pipeline theo miền</h2><p className="mt-1 text-[11px] text-slate-500">Tách biệt dữ liệu nhưng nhìn chung một nhịp vận hành.</p></div><FolderOpen size={17} className="text-slate-400" /></div>
      {summaries.map((summary) => <DomainPipelineCard key={summary.domain} summary={summary} onOpen={summary.domain === 'PCN' ? onOpenPcnWorkspace : onOpenPgdWorkspace} />)}
      {summaries.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm leading-5 text-slate-600">Tài khoản chưa được cấp quyền truy cập miền PCN hoặc PGD.</div>}
    </section>
  );
}

function RecentItemsSection({ recentRecords, pcnDossiers, pgdRequests, onOpenPcn, onOpenPgd }: { recentRecords: readonly PgdcnRecentRecord[]; pcnDossiers: readonly CertificationDossier[]; pgdRequests: readonly PgdInspectionRequest[]; onOpenPcn: (id: string) => void; onOpenPgd: (id: string) => void }) {
  const items = recentRecords.map((recent) => {
    const openedAt = new Date(recent.openedAt);
    if (recent.domain === 'PCN') {
      const dossier = pcnDossiers.find((item) => item.id === recent.recordId);
      if (!dossier) return null;
      return { ...recent, label: dossier.dossierCode, description: dossier.customerSnapshot?.name || 'Hồ sơ chứng nhận', dateLabel: Number.isFinite(openedAt.getTime()) ? formatDateDdMmYyyy(openedAt) || 'Vừa mở' : 'Vừa mở' };
    }
    const request = pgdRequests.find((item) => item.id === recent.recordId);
    if (!request) return null;
    return { ...recent, label: request.requestCode, description: request.customerSnapshot.name || 'Hồ sơ giám định', dateLabel: Number.isFinite(openedAt.getTime()) ? formatDateDdMmYyyy(openedAt) || 'Vừa mở' : 'Vừa mở' };
  }).filter(Boolean) as Array<PgdcnRecentRecord & { label: string; description: string; dateLabel: string }>;

  return <section data-testid="pgdcn-dashboard-recent-items" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex min-w-0 flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><FolderOpen size={17} className="shrink-0 text-slate-500" /><h2 className="min-w-0 break-words text-base font-semibold text-slate-900">Hồ sơ vừa mở</h2></div><p className="mt-1 break-words text-xs text-slate-600">Quay lại đúng hồ sơ gần nhất mà bạn đã làm việc.</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{items.length}/6</span></div>
    <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => <button key={item.domain + '-' + item.recordId} type="button" onClick={() => item.domain === 'PCN' ? onOpenPcn(item.recordId) : onOpenPgd(item.recordId)} className="mobile-touch-target min-h-16 min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-left hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${item.domain === 'PCN' ? DOMAIN_CONFIG.PCN.badge : DOMAIN_CONFIG.PGD.badge}`}>{item.domain}</span>
        <span className="mt-1 block break-words text-sm font-semibold text-slate-800">{item.label}</span>
        <span className="mt-1 block break-words text-xs text-slate-600">{item.description} · {item.dateLabel}</span>
      </button>)}
      {items.length === 0 && <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-6 text-center"><FolderOpen size={22} className="mx-auto text-slate-300" aria-hidden="true" /><p className="mt-2 text-sm font-bold text-slate-700">Chưa có hồ sơ vừa mở.</p><p className="mt-1 text-xs text-slate-500">Hồ sơ bạn mở sẽ được giữ lại ở đây trên thiết bị này.</p></div>}
    </div>
  </section>;
}

function UpcomingMilestones({ items, onOpenPcn, onOpenPgd }: Pick<PgdcnDashboardViewProps, 'onOpenPcn' | 'onOpenPgd'> & { items: PgdcnDashboardUpcomingItem[] }) {
  return (
    <section data-testid="pgdcn-dashboard-upcoming" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><CalendarClock size={17} className="shrink-0 text-blue-500" /><h2 className="min-w-0 break-words text-base font-semibold text-slate-900">Mốc sắp tới</h2></div><p className="mt-1 break-words text-xs text-slate-600">Các hạn xử lý và lịch giám định gần nhất.</p></div><span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{items.length}/5</span></div>
      <div className="mt-4 divide-y divide-slate-100">
        {items.map((item) => <button key={`${item.domain}-${item.id}`} type="button" onClick={() => item.domain === 'PCN' ? onOpenPcn(item.id) : onOpenPgd(item.id)} aria-label={`Mở ${item.domain} ${item.label}`} className="mobile-touch-target flex min-h-16 w-full min-w-0 items-start gap-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300"><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${item.domain === 'PCN' ? DOMAIN_CONFIG.PCN.badge : DOMAIN_CONFIG.PGD.badge}`}>{item.domain}</span><span className="min-w-0 flex-1"><b className="block break-words text-sm font-semibold text-slate-800">{item.label}</b><span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1 break-words text-xs text-slate-600">{item.milestoneLabel} · <PgdcnStatusBadge compact domain={item.domain} status={item.status} label={item.statusLabel} /></span></span><span className="shrink-0 text-right"><b className="block whitespace-nowrap text-xs font-semibold text-slate-700">{item.dateLabel}</b><ArrowRight size={14} className="ml-auto mt-1 text-slate-300" /></span></button>)}
        {items.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Chưa có mốc sắp tới.</p>}
      </div>
    </section>
  );
}

function SharedNotifications({ notifications, onOpenNotifications, onSelectNotification }: Pick<PgdcnDashboardViewProps, 'notifications' | 'onOpenNotifications' | 'onSelectNotification'>) {
  return (
    <section data-testid="pgdcn-dashboard-notifications" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Bell size={16} /></span><div className="min-w-0"><h2 className="text-base font-semibold text-slate-900">Thông báo phòng</h2><p className="mt-1 break-words text-[11px] text-slate-500">Một luồng chung cho PCN và PGD.</p></div></div><button type="button" onClick={onOpenNotifications} className="mobile-touch-target shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300">Xem tất cả</button></div>
      <div className="mt-4 divide-y divide-slate-100">
        {notifications.slice(0, 5).map((notification) => { const isPgd = notification.domain === 'PGD'; const actionLabel = getPgdcnNotificationActionLabel(notification); const date = new Date(notification.createdAt); const dateLabel = Number.isFinite(date.getTime()) ? formatDateDdMmYyyy(date) || 'Mới' : 'Mới'; return <button key={notification.id} type="button" onClick={() => onSelectNotification(notification)} aria-label={`Mở thông báo ${notification.title} · ${notification.read ? 'Đã đọc' : 'Chưa đọc'}`} className={`mobile-touch-target flex min-h-16 w-full min-w-0 items-start gap-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300 ${notification.read ? '' : 'bg-slate-50'}`}><span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${isPgd ? DOMAIN_CONFIG.PGD.badge : DOMAIN_CONFIG.PCN.badge}`}>{isPgd ? 'PGD' : 'PCN'}</span><span className="min-w-0 flex-1"><b className="block break-words text-[11px] font-semibold text-slate-800">{notification.title}</b><span className="mt-1 block break-words text-[10px] text-slate-500">{notification.message}</span><span className="mt-1 block text-xs font-semibold text-slate-700">{actionLabel}</span></span><span className="shrink-0 whitespace-nowrap text-[9px] text-slate-400">{dateLabel}</span></button>; })}
        {notifications.length === 0 && <p className="py-8 text-center text-[11px] text-slate-400">Chưa có thông báo phòng.</p>}
      </div>
    </section>
  );
}

export default function PgdcnDashboardView({ scopes, pcnDossiers, pcnEvidenceActions, pgdRequests, currentUser, pcnProposals, pcnWorkflowTasks, pgdAssignments, notifications, onOpenPcn, onOpenPgd, onOpenPcnWorkspace, onOpenPgdWorkspace, onOpenNotifications, onSelectNotification, recentRecords = [] }: PgdcnDashboardViewProps) {
  const projection = getPgdcnDashboardProjection({ scopes, pcnDossiers, pgdRequests });
  const myWork = currentUser ? getPgdcnMyWorkProjection({ scopes, currentUser, pcnDossiers, pcnProposals, pcnWorkflowTasks, pcnEvidenceActions, pgdRequests, pgdAssignments }) : undefined;
  return (
    <section className="pcn-page-surface app-compact min-w-0 space-y-3 bg-slate-50 p-3 pb-5 md:p-4 mobile-safe-bottom" aria-label="Điều hành phòng PGDCN">
      <CommandHeader scopes={scopes} onOpenPcnWorkspace={onOpenPcnWorkspace} onOpenPgdWorkspace={onOpenPgdWorkspace} />
      {myWork ? <MyWorkSection projection={myWork} currentUser={currentUser} onOpenPcn={onOpenPcn} onOpenPgd={onOpenPgd} /> : null}
      <div data-testid="pgdcn-dashboard-kpi-grid" className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6"><Kpi label="Hồ sơ PCN" value={projection.kpis.pcnDossiers} icon={Award} tone="bg-emerald-50 text-emerald-600" /><Kpi label="Hồ sơ PGD" value={projection.kpis.pgdRequests} icon={ClipboardCheck} tone="bg-blue-50 text-blue-600" /><Kpi label="PCN cần xử lý" value={projection.kpis.pcnWork} icon={FolderOpen} tone="bg-slate-100 text-slate-600" /><Kpi label="PGD cần xử lý" value={projection.kpis.pgdWork} icon={FileCheck2} tone="bg-slate-100 text-slate-600" /><Kpi label="Cần AI hỗ trợ" value={projection.kpis.aiCandidates} icon={Bot} tone="bg-slate-100 text-slate-600" /><Kpi label="Quá hạn / chú ý" value={projection.kpis.attention} icon={AlertTriangle} tone="bg-rose-50 text-rose-600" /></div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.85fr)]"><AttentionQueue items={projection.attention} onOpenPcn={onOpenPcn} onOpenPgd={onOpenPgd} /><DomainPipeline summaries={projection.domainSummaries} onOpenPcnWorkspace={onOpenPcnWorkspace} onOpenPgdWorkspace={onOpenPgdWorkspace} /></div>
      <RecentItemsSection recentRecords={recentRecords} pcnDossiers={pcnDossiers} pgdRequests={pgdRequests} onOpenPcn={onOpenPcn} onOpenPgd={onOpenPgd} />
      <div className="grid min-w-0 gap-4 lg:grid-cols-2"><UpcomingMilestones items={projection.upcoming} onOpenPcn={onOpenPcn} onOpenPgd={onOpenPgd} /><SharedNotifications notifications={notifications} onOpenNotifications={onOpenNotifications} onSelectNotification={onSelectNotification} /></div>
    </section>
  );
}
