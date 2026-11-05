'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type PreviewState = { url: string; text?: string; error?: string };

/** Reads an authenticated DOCX response in the browser and renders plain text only. */
export function PgdcnDocxPreview({ url, fileName }: { url: string; fileName: string }) {
  const [state, setState] = useState<PreviewState>({ url });

  useEffect(() => {
    const controller = new AbortController();
    setState({ url });
    void fetch(url, { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Không thể tải tài liệu (HTTP ${response.status}).`);
        return response.arrayBuffer();
      })
      .then(async (arrayBuffer) => {
        if (controller.signal.aborted) return;
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (!controller.signal.aborted) setState({ url, text: result.value });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ url, error: error instanceof Error ? error.message : 'Không thể xem trước DOCX.' });
      });
    return () => controller.abort();
  }, [url]);

  if (state.url !== url || (!state.text && !state.error)) {
    return <div role="status" className="flex min-h-[18rem] items-center justify-center gap-2 text-xs text-slate-500"><RefreshCw size={14} className="animate-spin" aria-hidden="true" />Đang đọc tài liệu DOCX…</div>;
  }

  if (state.error) {
    return <div role="alert" className="flex min-h-[18rem] flex-col items-center justify-center gap-2 px-4 text-center text-xs text-amber-900"><p>{state.error}</p><p className="text-slate-600">Tài liệu gốc vẫn được giữ nguyên; có thể tải xuống để mở bằng ứng dụng phù hợp.</p></div>;
  }

  return <article aria-label={`Bản xem chỉ đọc: ${fileName}`} className="mx-auto min-h-[18rem] max-w-4xl rounded-md border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 shadow-sm sm:p-8">
    <p className="mb-3 text-[11px] font-bold text-slate-500">Bản xem văn bản · chỉ đọc</p>
    <pre className="whitespace-pre-wrap break-words font-sans">{state.text || 'Tài liệu không có văn bản để hiển thị.'}</pre>
  </article>;
}
