'use client';

import { Maximize2, Minus, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

type ModalAccent = 'emerald' | 'blue';

const accentClasses: Record<ModalAccent, { eyebrow: string; icon: string; ring: string; button: string; launcher: string }> = {
  emerald: {
    eyebrow: 'text-emerald-600',
    icon: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    ring: 'focus-visible:ring-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-500',
    launcher: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  },
  blue: {
    eyebrow: 'text-blue-600',
    icon: 'border-blue-200 bg-blue-50 text-blue-700',
    ring: 'focus-visible:ring-blue-500',
    button: 'bg-blue-600 hover:bg-blue-500',
    launcher: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
  },
};

export type PgdcnWindowsWorkflowModalProps = {
  open: boolean;
  minimized?: boolean;
  title: string;
  eyebrow: string;
  description?: string;
  contextLabel?: string;
  accent?: ModalAccent;
  testId: string;
  bodyTestId?: string;
  footerTestId?: string;
  titleId: string;
  onClose: () => void;
  onMinimize: () => void;
  onRestore: () => void;
  busy?: boolean;
  children: ReactNode;
  footer: ReactNode;
};

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>([
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(','))).filter((element) => element.getAttribute('aria-hidden') !== 'true');
}

export function PgdcnWindowsWorkflowModal({
  open,
  minimized = false,
  title,
  eyebrow,
  description,
  contextLabel,
  accent = 'blue',
  testId,
  bodyTestId,
  footerTestId,
  titleId,
  onClose,
  onMinimize,
  onRestore,
  busy = false,
  children,
  footer,
}: PgdcnWindowsWorkflowModalProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const minimizedRef = useRef(minimized);
  const busyRef = useRef(busy);
  const colors = accentClasses[accent];
  onCloseRef.current = onClose;
  minimizedRef.current = minimized;
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return undefined;
    const active = document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement ? active : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current && !minimizedRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || minimizedRef.current || !panelRef.current) return;
      const items = focusableElements(panelRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      if (!minimizedRef.current) window.requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [open]);

  if (!open) return null;

  const panel = (
    <section
      ref={panelRef}
      data-testid={testId}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? `${titleId}-description` : undefined}
      aria-busy={busy || undefined}
      className={`relative flex min-h-0 max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-300 bg-slate-50 shadow-2xl transition sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl ${minimized ? 'pointer-events-none invisible opacity-0' : 'opacity-100'}`}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2.5 md:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colors.icon}`} aria-hidden="true"><span className="text-sm font-black">▣</span></span>
          <div className="min-w-0">
            <div className={`min-w-0 break-words text-[9px] font-black uppercase tracking-[0.16em] ${colors.eyebrow}`}>{eyebrow}</div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <h2 id={titleId} className="min-w-0 w-full break-words text-sm font-black text-slate-900 sm:w-auto">{title}</h2>
              {contextLabel && <span className="max-w-[18rem] truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500" title={contextLabel}>{contextLabel}</span>}
            </div>
            {description && <p id={`${titleId}-description`} className="mt-0.5 max-w-3xl text-[10px] leading-4 text-slate-500">{description}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={onMinimize} disabled={busy} aria-label="Thu nhỏ cửa sổ" title="Thu nhỏ cửa sổ" className={`mobile-touch-target inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${colors.ring} disabled:cursor-wait disabled:opacity-40`}>
            <Minus size={17} aria-hidden="true" />
          </button>
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={busy} aria-label="Đóng cửa sổ" title="Đóng cửa sổ" className={`mobile-touch-target inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${colors.ring} disabled:cursor-wait disabled:opacity-40`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div data-testid={bodyTestId || `${testId}-body`} className="mobile-scroll-y min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>
      <footer data-testid={footerTestId || `${testId}-footer`} className="mobile-safe-bottom flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2.5 md:px-4">{footer}</footer>
    </section>
  );

  return (
    <>
      <div className={`fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/60 p-2 backdrop-blur-[1px] sm:items-center sm:p-4 ${minimized ? 'pointer-events-none' : ''}`} aria-hidden={minimized || undefined}>
        {panel}
      </div>
      {minimized && <button type="button" data-testid="pgdcn-workflow-modal-launcher" onClick={onRestore} aria-label="Khôi phục cửa sổ" title={`Khôi phục ${title}`} className={`mobile-touch-target fixed bottom-4 right-4 z-[110] inline-flex min-h-11 max-w-[min(22rem,calc(100vw-2rem))] items-center gap-2 rounded-xl border px-3 py-2 text-left text-[10px] font-black shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${colors.launcher} ${colors.ring}`}>
        <Maximize2 size={14} aria-hidden="true" /> <span className="truncate">Khôi phục: {title}</span>
      </button>}
    </>
  );
}

export default PgdcnWindowsWorkflowModal;
