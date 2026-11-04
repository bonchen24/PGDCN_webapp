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
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  purple: 'border-purple-200 bg-purple-50 text-purple-800',
  orange: 'border-orange-200 bg-orange-50 text-orange-800',
  teal: 'border-teal-200 bg-teal-50 text-teal-800',
};

const statusIcon: Record<StateTone, LucideIcon> = {
  neutral: Circle,
  info: CircleDot,
  success: CheckCircle2,
  warning: Clock3,
  critical: AlertTriangle,
  cyan: CircleDot,
  indigo: CircleDot,
  purple: Clock3,
  orange: Clock3,
  teal: CheckCircle2,
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
  const isPcn = (eyebrow || '').includes('PCN') || (title || '').includes('PCN');
  const isPgd = (eyebrow || '').includes('PGD') || (title || '').includes('PGD');

  return (
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
          isPcn
            ? 'border-emerald-200/90 bg-emerald-50 text-emerald-800'
            : isPgd
            ? 'border-blue-200/90 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-100 text-slate-700'
        }`}>
          {eyebrow || 'PGDCN'}
        </span>
        <h1 className="text-sm md:text-base font-black tracking-tight text-slate-900">{title}</h1>
        {description && (
          <span className="hidden xl:inline text-xs font-medium text-slate-400 truncate max-w-xl" title={description}>
            • {description}
          </span>
        )}
      </div>
      {actions && <div className="flex min-w-0 shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
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
export interface PgdcnWorkflowStepItem {
  id: string;
  label: string;
  state: 'complete' | 'current' | 'upcoming' | 'blocked';
  badge?: string;
  checklistCount?: { completed: number; total: number };
  onClick?: () => void;
}

export function PgdcnWorkflowRail({ steps, className = '', onSelectStep }: { steps: readonly { id: string; label: string; state: 'complete' | 'current' | 'upcoming' | 'blocked'; badge?: string; checklistCount?: { completed: number; total: number }; onClick?: () => void }[]; className?: string; onSelectStep?: (id: string) => void }) {
  return (
    <div className={`mobile-scroll-x min-w-0 overflow-x-auto scroll-smooth touch-pan-x pb-1 ${className}`} role="list" aria-label="Các bước hồ sơ">
      <div className="flex min-w-max items-center gap-1.5">
        {steps.map((step, index) => {
          const isCurrent = step.state === 'current';
          const isComplete = step.state === 'complete';
          const isBlocked = step.state === 'blocked';
          const badgeText = step.badge || (step.checklistCount ? `${step.checklistCount.completed}/${step.checklistCount.total} việc` : undefined);
          const handleClick = step.onClick || (onSelectStep ? () => onSelectStep(step.id) : undefined);

          return (
            <div
              key={step.id}
              role="listitem"
              aria-current={step.state === 'current' ? 'step' : undefined}
              onClick={handleClick}
              className={`mobile-touch-target flex min-w-[9.5rem] sm:min-w-[10.5rem] items-center gap-2 rounded-lg border px-2.5 py-2 text-left shadow-xs transition ${handleClick ? 'cursor-pointer' : ''} ${
                isCurrent
                  ? 'border-indigo-400 bg-indigo-50/90 text-indigo-950 font-black shadow-md ring-2 ring-indigo-500 ring-offset-1'
                  : isComplete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : isBlocked
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : isComplete
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-current/20'
                }`}
              >
                {index + 1}
              </span>
              <span className="min-w-0 truncate text-[11px] font-black">{step.label}</span>
              {badgeText && (
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  isCurrent
                    ? 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {badgeText.startsWith('(') ? badgeText : `(${badgeText})`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PgdcnStatePanel({ tone, title, description, action }: { tone: 'loading' | 'empty' | 'error' | 'success'; title: string; description: string; action?: ReactNode }) {
  const Icon = stateIcon[tone];
  return <section className={`${surfaceClass} flex min-h-36 flex-col items-center justify-center p-6 text-center ${statePanelToneClass[tone]}`} role={tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined} aria-live={tone === 'error' || tone === 'loading' ? 'polite' : undefined}><Icon size={22} className={tone === 'loading' ? 'animate-spin' : ''} /><h2 className="mt-2 text-xs font-black">{title}</h2><p className="mt-1 max-w-md text-[11px] leading-4">{description}</p>{action && <div className="mt-3 flex flex-wrap justify-center gap-2">{action}</div>}</section>;
}
