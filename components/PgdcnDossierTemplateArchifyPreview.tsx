'use client';

import { useEffect, useRef, useState } from 'react';
import type { DossierTemplateDomain, DossierTemplateEditorModel } from '../utils/pgdcnDossierTemplate.ts';

export interface PgdcnDossierTemplateArchifyPreviewProps {
  domain: DossierTemplateDomain;
  model: DossierTemplateEditorModel;
  onSelectNode?: (nodeId: string | null) => void;
}

export default function PgdcnDossierTemplateArchifyPreview({ domain, model, onSelectNode }: PgdcnDossierTemplateArchifyPreviewProps) {
  const [iframeSrc, setIframeSrc] = useState<string>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const serializedModel = JSON.stringify(model);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError('');
    setIframeSrc(undefined);
    void fetch(`/api/${domain === 'PCN' ? 'pcn' : 'pgd'}/workflow-templates/preview`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: serializedModel, signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'Không thể tạo bản xem trước Archify.');
        if (!active) return;
        const nextUrl = URL.createObjectURL(new Blob([String(payload?.html || '')], { type: 'text/html' }));
        setIframeSrc((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
        setLoading(false);
      })
      .catch((reason: any) => { if (active && reason?.name !== 'AbortError') { setError(reason?.message || 'Không thể tạo bản xem trước Archify.'); setLoading(false); } });
    return () => { active = false; controller.abort(); setIframeSrc((previous) => { if (previous) URL.revokeObjectURL(previous); return undefined; }); };
  }, [domain, serializedModel]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<{ source?: string; domain?: string; nodeId?: string }>) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.source === 'pcn-archify' && event.data.domain === domain.toLowerCase()) onSelectNode?.(event.data.nodeId || null);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [domain, onSelectNode]);

  return <section data-testid="pgdcn-dossier-template-archify-preview" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"><div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"><div><span className="rounded-md bg-cyan-100 px-2 py-1 text-[10px] font-black text-cyan-700">XEM TRƯỚC LƯU TRÌNH</span><p className="mt-1 text-xs text-slate-500">Bộ đọc chỉ xem cấu trúc, nút và số loại tài liệu được gán.</p></div>{loading && <span className="text-xs font-medium text-slate-500">Đang tạo bản xem trước…</span>}</div>{error ? <div className="p-6 text-sm text-rose-700">{error}</div> : iframeSrc ? <iframe ref={iframeRef} data-testid="pgdcn-dossier-template-archify-reader" title={`Xem trước lưu trình ${model.name}`} src={iframeSrc} sandbox="allow-scripts allow-same-origin" className="h-[min(72dvh,720px)] min-h-[480px] w-full bg-white" /> : <div data-testid="pgdcn-dossier-template-archify-reader" className="flex min-h-[480px] items-center justify-center text-sm text-slate-500">Đang chuẩn bị bộ đọc lưu trình…</div>}</section>;
}
