'use client';

import { AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useId } from 'react';

export type PgdcnDraftAiSuggestionPanelProps = {
  domain: 'PCN' | 'PGD';
  fieldLabel: string;
  currentValue: string;
  isBusy: boolean;
  suggestion: string | null;
  explanation: string | null;
  warnings: string[];
  error: string | null;
  onRequest: () => void;
  onApply: (suggestion: string) => void;
  onDismiss: () => void;
};

const DOMAIN_ACCENTS = {
  PCN: {
    border: 'border-emerald-200',
    badge: 'bg-emerald-50 text-emerald-800',
    button: 'bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-600',
    ring: 'focus-visible:ring-emerald-600',
  },
  PGD: {
    border: 'border-blue-200',
    badge: 'bg-blue-50 text-blue-800',
    button: 'bg-blue-700 hover:bg-blue-800 focus-visible:ring-blue-600',
    ring: 'focus-visible:ring-blue-600',
  },
} as const;

export default function PgdcnDraftAiSuggestionPanel({
  domain,
  fieldLabel,
  currentValue,
  isBusy,
  suggestion,
  explanation,
  warnings,
  error,
  onRequest,
  onApply,
  onDismiss,
}: PgdcnDraftAiSuggestionPanelProps) {
  const panelId = useId();
  const accent = DOMAIN_ACCENTS[domain];
  const hasSuggestion = suggestion !== null && suggestion.trim().length > 0;
  const disclosureId = `${panelId}-ai-disclosure`;

  return (
    <section
      aria-labelledby={`${panelId}-title`}
      className={`min-w-0 rounded-xl border ${accent.border} bg-white p-4 shadow-sm`}
    >
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-bold ${accent.badge}`}>
            Gợi ý AI · {domain}
          </span>
          <h2 id={`${panelId}-title`} className="mt-2 break-words text-base font-bold text-slate-950">
            Hỗ trợ trường: {fieldLabel}
          </h2>
        </div>
        <Sparkles aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-violet-700" />
      </header>

      <p id={disclosureId} className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-5 text-slate-700">
        Khi bạn chọn “Yêu cầu gợi ý AI”, nội dung hiện tại của trường “{fieldLabel}” sẽ được gửi tới AI.
        Nội dung gốc được giữ nguyên cho đến khi bạn chọn áp dụng đề xuất.
      </p>

      <button
        type="button"
        onClick={onRequest}
        disabled={isBusy}
        aria-describedby={disclosureId}
        className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto ${accent.button}`}
      >
        {isBusy ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
            Đang yêu cầu gợi ý…
          </>
        ) : (
          <>
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Yêu cầu gợi ý AI
          </>
        )}
      </button>

      {isBusy ? (
        <p role="status" aria-live="polite" className="mt-3 flex items-center gap-2 text-sm text-blue-800">
          <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          Đang tạo đề xuất cho trường “{fieldLabel}”.
        </p>
      ) : null}

      {error ? (
        <p role="alert" aria-live="assertive" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-900">
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}

      {!isBusy && !error ? (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-600">
          {hasSuggestion ? 'Đã có đề xuất để bạn xem xét.' : 'Chưa có đề xuất. Bạn có thể yêu cầu AI gợi ý khi sẵn sàng.'}
        </p>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        <article aria-labelledby={`${panelId}-current-title`} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <h3 id={`${panelId}-current-title`} className="text-sm font-bold text-slate-800">
            Văn bản hiện tại
          </h3>
          <p className="mt-2 min-h-12 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
            {currentValue.length > 0 ? currentValue : <span className="italic text-slate-500">Trường đang để trống.</span>}
          </p>
        </article>

        <article aria-labelledby={`${panelId}-suggestion-title`} className="min-w-0 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
          <h3 id={`${panelId}-suggestion-title`} className="text-sm font-bold text-violet-950">
            Đề xuất AI
          </h3>
          <p className="mt-2 min-h-12 whitespace-pre-wrap break-words text-sm leading-6 text-slate-900">
            {hasSuggestion ? suggestion : <span className="italic text-slate-600">Chưa có nội dung đề xuất.</span>}
          </p>
        </article>
      </div>

      {explanation ? (
        <div className="mt-3 rounded-lg border border-slate-200 p-3">
          <h3 className="text-sm font-bold text-slate-800">Giải thích đề xuất</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{explanation}</p>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
          <h3 className="text-sm font-bold">Cảnh báo cần xem lại</h3>
          <ul aria-label="Cảnh báo về đề xuất AI" className="mt-1 list-inside list-disc space-y-1 text-sm leading-5">
            {warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-slate-600">
        Áp dụng chỉ thay nội dung trường này; việc lưu hồ sơ vẫn do bạn thực hiện.
      </p>

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className={`min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${accent.ring}`}
        >
          Giữ nguyên
        </button>
        <button
          type="button"
          onClick={() => { if (hasSuggestion && suggestion !== null) onApply(suggestion); }}
          disabled={!hasSuggestion || isBusy}
          className={`min-h-11 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 ${accent.button}`}
        >
          Áp dụng đề xuất
        </button>
      </div>
    </section>
  );
}
