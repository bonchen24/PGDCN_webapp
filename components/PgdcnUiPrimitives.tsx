'use client';

import { AlertCircle, CheckCircle2, Info, Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type StateTone = 'neutral' | 'info' | 'success' | 'warning' | 'critical';

const statusToneClass: Record<StateTone, string> = {
  neutral: 'border-slate-200 bg-slate-100 text-slate-700',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  critical: 'border-rose-200 bg-rose-50 text-rose-800',
};

const stateIcon: Record<'loading' | 'empty' | 'error' | 'success', LucideIcon> = {
  loading: Loader2,
  empty: Info,
  error: AlertCircle,
  success: CheckCircle2,
};

export function PgdcnPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <header className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{eyebrow || 'PGDCN'}</p><h1 className="mt-1 truncate text-xl font-black text-slate-900">{title}</h1>{description && <p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">{description}</p>}</div>{actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}</header>;
}

export function PgdcnToolbar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <div className="grid min-w-0 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>{actions && <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:justify-end">{actions}</div>}</div>;
}

export function PgdcnStatusBadge({ label, tone = 'neutral' }: { label: string; tone?: StateTone }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2 py-1 text-[9px] font-black ${statusToneClass[tone]}`}>{label}</span>;
}

export function PgdcnWorkflowRail({ steps }: { steps: readonly { id: string; label: string; state: 'complete' | 'current' | 'upcoming' | 'blocked' }[] }) {
  return <div className="mobile-scroll-x min-w-0 overflow-x-auto pb-1" role="list" aria-label="Các bước hồ sơ"><div className="flex min-w-max items-start gap-1">{steps.map((step, index) => <div key={step.id} role="listitem" aria-current={step.state === 'current' ? 'step' : undefined} className={`mobile-touch-target flex min-w-[9rem] items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${step.state === 'current' ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : step.state === 'complete' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : step.state === 'blocked' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-500'}`}><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black ring-1 ring-current/20">{index + 1}</span><span className="min-w-0 truncate text-[10px] font-black">{step.label}</span></div>)}</div></div>;
}

export function PgdcnStatePanel({ tone, title, description, action }: { tone: 'loading' | 'empty' | 'error' | 'success'; title: string; description: string; action?: ReactNode }) {
  const Icon = stateIcon[tone];
  return <section className={`flex min-h-36 flex-col items-center justify-center rounded-xl border p-6 text-center ${tone === 'error' ? statusToneClass.critical : tone === 'success' ? statusToneClass.success : tone === 'loading' ? statusToneClass.info : statusToneClass.neutral}`} role={tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined} aria-live={tone === 'error' || tone === 'loading' ? 'polite' : undefined}><Icon size={22} className={tone === 'loading' ? 'animate-spin' : ''} /><h2 className="mt-2 text-xs font-black">{title}</h2><p className="mt-1 max-w-md text-[10px] leading-4">{description}</p>{action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}</section>;
}
