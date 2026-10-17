'use client';

import { AlertCircle, CheckCircle2, ChevronDown, CircleDashed, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export type DraftingDomain = 'PCN' | 'PGD';
export type DraftingAccent = 'emerald' | 'blue' | 'indigo';
export type DraftingState = 'EMPTY' | 'EDITING' | 'SAVED' | 'GENERATING' | 'READY' | 'CONFIRMED' | 'ATTACHED' | 'BLOCKED' | 'ERROR';

export const DRAFTING_WORKFLOW_STEPS = [
  'Chọn tài liệu',
  'Kiểm tra dữ liệu',
  'Sinh & soát',
  'Gắn hồ sơ',
] as const;

const ACCENT_CLASSES: Record<DraftingAccent, { label: string; border: string; soft: string; text: string; ring: string }> = {
  emerald: { label: 'text-emerald-700', border: 'border-emerald-200', soft: 'bg-emerald-50', text: 'text-emerald-800', ring: 'focus-visible:ring-emerald-500' },
  blue: { label: 'text-blue-700', border: 'border-blue-200', soft: 'bg-blue-50', text: 'text-blue-800', ring: 'focus-visible:ring-blue-500' },
  indigo: { label: 'text-indigo-700', border: 'border-indigo-200', soft: 'bg-indigo-50', text: 'text-indigo-800', ring: 'focus-visible:ring-indigo-500' },
};

const STATE_TONES: Record<DraftingState, { border: string; background: string; text: string }> = {
  EMPTY: { border: 'border-slate-200', background: 'bg-white', text: 'text-slate-800' },
  EDITING: { border: 'border-blue-200', background: 'bg-blue-50/60', text: 'text-blue-900' },
  SAVED: { border: 'border-slate-200', background: 'bg-white', text: 'text-slate-800' },
  GENERATING: { border: 'border-indigo-200', background: 'bg-indigo-50', text: 'text-indigo-900' },
  READY: { border: 'border-emerald-200', background: 'bg-emerald-50', text: 'text-emerald-800' },
  CONFIRMED: { border: 'border-teal-200', background: 'bg-teal-50', text: 'text-teal-900' },
  ATTACHED: { border: 'border-emerald-300', background: 'bg-emerald-100', text: 'text-emerald-950' },
  BLOCKED: { border: 'border-amber-200', background: 'bg-amber-50', text: 'text-amber-900' },
  ERROR: { border: 'border-rose-200', background: 'bg-rose-50', text: 'text-rose-900' },
};

const STATE_ICONS: Record<DraftingState, typeof AlertCircle> = {
  EMPTY: CircleDashed,
  EDITING: CircleDashed,
  SAVED: CheckCircle2,
  GENERATING: Loader2,
  READY: CheckCircle2,
  CONFIRMED: CheckCircle2,
  ATTACHED: CheckCircle2,
  BLOCKED: AlertCircle,
  ERROR: AlertCircle,
};

export type DraftingReadinessIssue = {
  key: string;
  label: string;
  message: string;
};

export function DraftingHeader({
  domain,
  title,
  description,
  actions,
  testId,
}: {
  domain: DraftingDomain;
  title: string;
  description: string;
  actions?: ReactNode;
  testId?: string;
}) {
  const accent = ACCENT_CLASSES[domain === 'PCN' ? 'emerald' : 'blue'];
  return (
    <header data-testid={testId} className="flex min-w-0 flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-[12px] font-black uppercase tracking-[0.14em] ${accent.label}`}>Soạn thảo tài liệu · {domain}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">{title}</h1>
        <p className="mt-1 max-w-3xl text-[13px] leading-5 text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function DraftingWorkflowOrientation({
  activeStep = 1,
  completedThrough = 0,
  accent = 'emerald',
  testId,
}: {
  activeStep?: 1 | 2 | 3 | 4;
  completedThrough?: 0 | 1 | 2 | 3 | 4;
  accent?: DraftingAccent;
  testId?: string;
}) {
  const colors = ACCENT_CLASSES[accent];
  return (
    <nav data-testid={testId} aria-label="Tiến trình soạn thảo tài liệu" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-black text-slate-900">Tiến trình soạn thảo</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-600">Theo dõi việc cần làm từ chọn mẫu đến đưa tài liệu vào hồ sơ.</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${colors.border} ${colors.soft} ${colors.text}`}>Bước {activeStep}/4</span>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {DRAFTING_WORKFLOW_STEPS.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3 | 4;
          const completed = step <= completedThrough;
          const active = step === activeStep;
          return (
            <li key={label} aria-current={active ? 'step' : undefined} className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 ${active ? `${colors.border} ${colors.soft}` : completed ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-black ${active ? `${colors.text} ${colors.soft}` : completed ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-500'}`}>{completed ? <CheckCircle2 size={15} aria-hidden="true" /> : step}</span>
              <span className={`min-w-0 text-[12px] font-bold ${active ? 'text-slate-950' : 'text-slate-600'}`}>{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function DraftingContextStatusBar({
  domain,
  sourceLabel,
  documentLabel,
  statusLabel,
  description,
  metadata,
  advancedMetadata,
  testId,
}: {
  domain: DraftingDomain;
  sourceLabel: string;
  documentLabel: string;
  statusLabel?: string;
  description?: string;
  metadata?: ReactNode;
  advancedMetadata?: ReactNode;
  testId?: string;
}) {
  const accent = ACCENT_CLASSES[domain === 'PCN' ? 'emerald' : 'blue'];
  return (
    <section data-testid={testId} aria-label={`Bối cảnh soạn thảo ${domain}`} className={`rounded-xl border ${accent.border} ${accent.soft} p-3`}>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[12px] font-black ${accent.text}`}>Bối cảnh hồ sơ</p>
          <p className="mt-0.5 break-words text-[13px] font-bold text-slate-900">{sourceLabel}</p>
          {description ? <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-600">{description}</p> : null}
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center justify-start gap-1.5 text-xs font-bold sm:justify-end">
          <span className="max-w-full break-words rounded-md border border-white/80 bg-white/80 px-2 py-1 text-slate-700">Tài liệu: {documentLabel}</span>
          {statusLabel ? <span className={`max-w-full break-words rounded-md border ${accent.border} bg-white/80 px-2 py-1 ${accent.text}`}>{statusLabel}</span> : null}
          {metadata}
        </div>
      </div>
      {advancedMetadata ? <details className="mt-2 border-t border-white/80 pt-2 text-xs text-slate-600"><summary className={`flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md px-1 py-1 font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 ${accent.ring} focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden`}><ChevronDown size={14} aria-hidden="true" /> Thông tin nâng cao</summary><div className="mt-2 grid gap-1.5 sm:grid-cols-2">{advancedMetadata}</div></details> : null}
    </section>
  );
}

export function DraftingReadinessPanel({
  state,
  stateLabel,
  message,
  issueCount = 0,
  issues = [],
  onIssueClick,
  metadata,
  testId,
  stateTestId,
}: {
  state: DraftingState;
  stateLabel: string;
  message: string;
  issueCount?: number;
  issues?: DraftingReadinessIssue[];
  onIssueClick?: (issue: DraftingReadinessIssue) => void;
  metadata?: ReactNode;
  testId?: string;
  stateTestId?: string;
}) {
  const tone = STATE_TONES[state];
  const Icon = STATE_ICONS[state];
  return (
    <section data-testid={testId} className={`rounded-xl border p-3 ${tone.border} ${tone.background} ${tone.text}`} aria-label="Mức sẵn sàng của bản soạn thảo">
      <div className="flex items-start gap-2.5">
        <Icon size={18} aria-hidden="true" className={state === 'GENERATING' ? 'mt-0.5 animate-spin' : 'mt-0.5'} />
        <div className="min-w-0 flex-1">
          <div data-testid={stateTestId} role={state === 'ERROR' ? 'alert' : 'status'} className="text-sm font-black">{stateLabel}</div>
          <p className="mt-1 text-sm leading-5">{message}</p>
          <div className="mt-2 flex min-w-0 flex-wrap gap-1.5 text-xs font-bold">{metadata}{issueCount > 0 ? <span className="max-w-full break-words rounded-md border border-amber-200 bg-white/80 px-2 py-1 text-amber-800">Còn {issueCount} mục cần kiểm tra</span> : null}</div>
          {issues.length > 0 ? <ul data-testid={testId ? `${testId}-issues` : undefined} aria-label="Các trường cần kiểm tra" className="mt-2 space-y-1.5">{issues.map((item) => <li key={`${item.key}-${item.label}`}>{onIssueClick ? <button type="button" onClick={() => onIssueClick(item)} className="flex min-h-11 w-full min-w-0 flex-col items-start gap-1 rounded-md border border-amber-200/80 bg-white/80 px-2.5 py-2 text-left text-xs font-semibold text-amber-950 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 sm:flex-row sm:items-start sm:justify-between"><span className="min-w-0 break-words"><span>{item.label}</span><span className="mx-1 text-amber-600">·</span>{item.message}</span><span className="max-w-full self-end text-xs font-black text-amber-800 sm:shrink-0">Đi tới trường</span></button> : <div className="min-w-0 break-words rounded-md border border-amber-200/80 bg-white/80 px-2.5 py-2 text-xs font-semibold text-amber-950"><span>{item.label}</span><span className="mx-1 text-amber-600">·</span>{item.message}</div>}</li>)}</ul> : null}
        </div>
      </div>
    </section>
  );
}

export function DraftingFieldSection({
  title,
  description,
  children,
  testId,
  className = '',
  collapsible = false,
  defaultOpen = true,
  missingCount = 0,
  accent = 'emerald',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  testId?: string;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  missingCount?: number;
  accent?: DraftingAccent;
}) {
  const colors = ACCENT_CLASSES[accent];
  if (collapsible) {
    return <details data-testid={testId} open={defaultOpen} className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 ${className}`}>
      <summary className={`flex min-h-11 flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-md px-1 py-1 text-left text-sm font-black text-slate-900 focus-visible:outline-none focus-visible:ring-2 ${colors.ring} focus-visible:ring-offset-2 sm:flex-nowrap sm:items-center [&::-webkit-details-marker]:hidden`}>
        <span className="min-w-0 flex-1 break-words">{title}</span>
        <span className="flex min-w-0 max-w-full items-center gap-2 text-xs font-bold text-slate-600"><span className="break-words">{missingCount > 0 ? `Còn ${missingCount} mục thiếu` : 'Đã đủ dữ liệu'}</span><ChevronDown size={15} aria-hidden="true" className="shrink-0" /></span>
      </summary>
      <div className="mt-2">{description ? <p className="mb-2 text-xs leading-5 text-slate-600">{description}</p> : null}{children}</div>
    </details>;
  }
  return (
    <fieldset data-testid={testId} className={`min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3 ${className}`}>
      <legend className="px-1 text-[13px] font-black text-slate-900">{title}</legend>
      {description ? <p className="mb-2 text-xs leading-5 text-slate-600">{description}</p> : null}
      {children}
    </fieldset>
  );
}

export function DraftingStickyActionBar({
  children,
  metadata,
  accent = 'emerald',
  testId,
}: {
  children: ReactNode;
  metadata?: ReactNode;
  accent?: DraftingAccent;
  testId?: string;
}) {
  const colors = ACCENT_CLASSES[accent];
  return (
    <div data-testid={testId} role="region" aria-label="Thanh thao tác soạn thảo" className={`mobile-safe-bottom drafting-sticky-action-bar sticky bottom-0 z-10 flex min-w-0 flex-col items-stretch justify-between gap-3 border-t ${colors.border} bg-white/95 py-3 backdrop-blur sm:flex-row sm:items-center`}>
      <div className="min-w-0 text-xs leading-5 text-slate-600">{metadata}</div>
      <div className="flex min-w-0 w-full flex-wrap justify-start gap-2 sm:w-auto sm:justify-end [&>*]:max-w-full">{children}</div>
    </div>
  );
}

export function DraftingOutputReviewShell({
  title = 'Soát xét & kết quả',
  description,
  children,
  empty,
  testId,
  accent = 'emerald',
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
  empty?: ReactNode;
  testId?: string;
  accent?: DraftingAccent;
}) {
  const colors = ACCENT_CLASSES[accent];
  return (
    <section data-testid={testId} aria-label={title} className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-4 xl:self-start">
      <header className="border-b border-slate-100 pb-2">
        <h2 className="text-[15px] font-black text-slate-950">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p> : null}
      </header>
      {children || empty ? <div className={`min-w-0 ${colors.text}`}>{children || empty}</div> : null}
    </section>
  );
}
