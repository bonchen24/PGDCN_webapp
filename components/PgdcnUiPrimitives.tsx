'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Circle, CircleDot, Clock3, Info, Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { getPgdcnStatusPresentation, type PgdcnDashboardDomain, type PgdcnStatusTone } from '../utils/pgdcnDashboard';

type StateTone = PgdcnStatusTone;

const statusToneClass: Record<StateTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  critical: 'border-rose-200 bg-rose-50 text-rose-800',
};

const statusIcon: Record<StateTone, LucideIcon> = {
  neutral: Circle,
  info: CircleDot,
  success: CheckCircle2,
  warning: Clock3,
  critical: AlertTriangle,
};
const stateIcon: Record<'loading' | 'empty' | 'error' | 'success', LucideIcon> = {
  loading: Loader2,
  empty: Info,
  error: AlertCircle,
  success: CheckCircle2,
};

const surfaceClass = 'min-w-0 rounded-xl border border-slate-200 shadow-sm';
const whiteSurfaceClass = 'bg-white';

const statePanelToneClass: Record<'loading' | 'empty' | 'error' | 'success', string> = {
  loading: 'bg-blue-50 text-blue-800',
  empty: 'bg-slate-100 text-slate-700',
  error: 'bg-rose-50 text-rose-800',
  success: 'bg-emerald-50 text-emerald-800',
};

export function PgdcnPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow || 'PGDCN'}</p><h1 className="mt-1 truncate text-xl font-black text-slate-900">{title}</h1>{description && <p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">{description}</p>}</div>{actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}</header>;
}

export function PgdcnToolbar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className={`${surfaceClass} ${whiteSurfaceClass} pgdcn-toolbar-nowrap p-3`}><div className="contents">{children}</div>{actions && <div className="pgdcn-toolbar-actions flex min-w-0 items-center justify-start gap-2">{actions}</div>}</div>;
}

export function PgdcnStatusBadge({ label, tone, domain, status, compact = false, className = '' }: { label?: string; tone?: StateTone; domain?: PgdcnDashboardDomain; status?: string; compact?: boolean; className?: string }) {
  const presentation = domain && status ? getPgdcnStatusPresentation(domain, status) : undefined;
  const resolvedTone = tone || presentation?.tone || 'neutral';
  const Icon = statusIcon[resolvedTone];
  const resolvedLabel = label || presentation?.label || 'Chưa xác định';
  const sizeClass = compact ? 'inline-flex min-h-5 px-1.5 py-0.5 text-[9px]' : 'inline-flex min-h-6 px-2 py-1 text-[10px]';
  return <span data-status-tone={resolvedTone} title={presentation?.description} className={sizeClass + ' items-center gap-1 rounded-full border font-black ' + statusToneClass[resolvedTone] + ' ' + className}><Icon size={compact ? 11 : 12} aria-hidden="true" /><span>{resolvedLabel}</span></span>;
}
export function PgdcnWorkflowRail({ steps }: { steps: readonly { id: string; label: string; state: 'complete' | 'current' | 'upcoming' | 'blocked' }[] }) {
  return <div className="mobile-scroll-x min-w-0 overflow-x-auto pb-1" role="list" aria-label="Các bước hồ sơ"><div className="flex min-w-max items-start gap-1">{steps.map((step, index) => <div key={step.id} role="listitem" aria-current={step.state === 'current' ? 'step' : undefined} className={`mobile-touch-target flex min-w-[9rem] items-center gap-2 rounded-lg border px-2.5 py-2 text-left shadow-sm ${step.state === 'current' ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : step.state === 'complete' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : step.state === 'blocked' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-500'}`}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black ring-1 ring-current/20">{index + 1}</span><span className="min-w-0 truncate text-[11px] font-black">{step.label}</span></div>)}</div></div>;
}

export function PgdcnStatePanel({ tone, title, description, action }: { tone: 'loading' | 'empty' | 'error' | 'success'; title: string; description: string; action?: ReactNode }) {
  const Icon = stateIcon[tone];
  return <section className={`${surfaceClass} flex min-h-36 flex-col items-center justify-center p-6 text-center ${statePanelToneClass[tone]}`} role={tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined} aria-live={tone === 'error' || tone === 'loading' ? 'polite' : undefined}><Icon size={22} className={tone === 'loading' ? 'animate-spin' : ''} /><h2 className="mt-2 text-xs font-black">{title}</h2><p className="mt-1 max-w-md text-[11px] leading-4">{description}</p>{action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}</section>;
}
