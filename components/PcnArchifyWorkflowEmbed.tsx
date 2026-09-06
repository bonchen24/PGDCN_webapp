'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Play, RotateCcw, X } from 'lucide-react';

import type { PcnDossierWorkflowTask } from '../types';
import { ARCHIFY_DIAGRAM_TYPES, type ArchifyDiagramType } from '../utils/archifyDiagram';

export type ArchifyEmbedDomain = 'pcn' | 'pgd';

export interface PcnArchifyEmbedNode { id: string; label: string; kind?: string; }

export interface PcnArchifyWorkflowEmbedProps {
  domain: ArchifyEmbedDomain;
  recordId: string;
  recordCode: string;
  initialNodeId?: string;
  nodes?: readonly PcnArchifyEmbedNode[];
  edgeIds?: readonly string[];
  workflowTasks?: readonly PcnDossierWorkflowTask[];
  canEdit?: boolean;
  onStartTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string) => Promise<void>;
  onReturnTask?: (taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
  onOpenDocuments?: (nodeId: string) => void;
}

type ArchifyFocusMessage = { source?: string; domain?: ArchifyEmbedDomain; recordId?: string; nodeId?: string; edgeId?: string };
type FrameState = 'loading' | 'ready' | 'unavailable' | 'error';

const DIAGRAM_LABELS: Record<ArchifyDiagramType, string> = { workflow: 'Lưu trình', lifecycle: 'Vòng đời', dataflow: 'Luồng dữ liệu', sequence: 'Chuỗi thao tác', architecture: 'Kiến trúc' };

function taskStatus(task: PcnDossierWorkflowTask | undefined): string { return task?.status || 'LOCKED'; }

function isArchifyDiagramType(value: string | null): value is ArchifyDiagramType {
  return Boolean(value && ARCHIFY_DIAGRAM_TYPES.includes(value as ArchifyDiagramType));
}

function initialDiagramType(): ArchifyDiagramType {
  if (typeof window === 'undefined') return 'workflow';
  const requested = new URLSearchParams(window.location.search).get('diagram');
  return isArchifyDiagramType(requested) ? requested : 'workflow';
}

function boundedText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 240) : fallback;
}

export default function PcnArchifyWorkflowEmbed({ domain, recordId, recordCode, initialNodeId, nodes = [], edgeIds = [], workflowTasks = [], canEdit = false, onStartTask, onCompleteTask, onReturnTask, onOpenDocuments }: PcnArchifyWorkflowEmbedProps) {
  const [diagramType, setDiagramType] = useState<ArchifyDiagramType>(initialDiagramType);
  const [retryNonce, setRetryNonce] = useState(0);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const [frameState, setFrameState] = useState<FrameState>('loading');
  const [unavailableReason, setUnavailableReason] = useState('Sơ đồ này chưa khả dụng cho hồ sơ.');
  const [errorMessage, setErrorMessage] = useState('Không tải được reader Archify của hồ sơ này.');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnTargetNodeId, setReturnTargetNodeId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const taskByNodeId = useMemo(() => new Map(workflowTasks.filter((task) => task.dossierId === recordId).map((task) => [task.nodeId, task])), [recordId, workflowTasks]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedTask = selectedNodeId ? taskByNodeId.get(selectedNodeId) : undefined;
  const selectedStatus = taskStatus(selectedTask);
  const canRenderMutationDock = diagramType === 'workflow' && domain === 'pcn' && selectedTask && canEdit;

  const buildReaderUrl = useCallback((type: ArchifyDiagramType) => {
    const routePrefix = `/api/${domain === 'pcn' ? 'pcn/dossiers' : 'pgd/requests'}`;
    const url = new URL(`${routePrefix}/${encodeURIComponent(recordId)}/archify?embed=1&theme=light&diagram=${encodeURIComponent(type)}`, window.location.origin);
    const initialFocus = initialNodeId || new URLSearchParams(window.location.hash.replace(/^#/, '')).get('focus');
    if (type === 'workflow' && initialNodeId) url.hash = `#focus=${encodeURIComponent(initialNodeId)}`;
    else if (type === 'workflow' && initialFocus) url.hash = `#focus=${encodeURIComponent(initialFocus)}`;
    return url;
  }, [domain, initialNodeId, recordId]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const requestUrl = buildReaderUrl(diagramType);
    setFrameState('loading');
    setIframeSrc(null);
    setUnavailableReason('Sơ đồ này chưa khả dụng cho hồ sơ.');
    setErrorMessage('Không tải được reader Archify của hồ sơ này.');
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setReturnOpen(false);
    void fetch(requestUrl.toString(), { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!active || controller.signal.aborted) return;
        if (response.status === 409 || response.status === 422) {
          let payload: Record<string, unknown> = {};
          try { const parsed = await response.json() as unknown; if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>; } catch { /* safe fallback */ }
          if (!active) return;
          setUnavailableReason(boundedText(payload.reason, 'Sơ đồ này chưa khả dụng cho hồ sơ.'));
          setFrameState('unavailable');
          return;
        }
        if (!response.ok) throw new Error(`Archify preflight failed: ${response.status}`);
        if (!active) return;
        setIframeSrc(requestUrl.toString());
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setErrorMessage(error instanceof Error && error.message !== 'Failed to fetch' ? error.message.slice(0, 240) : 'Không tải được reader Archify của hồ sơ này.');
        setFrameState('error');
      });
    return () => { active = false; controller.abort(); };
  }, [buildReaderUrl, diagramType, retryNonce]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<ArchifyFocusMessage>) => {
      if (event.origin !== window.location.origin) return;
      const sameWindow = event.source === window;
      const fromIframe = event.source === iframeRef.current?.contentWindow;
      if (!sameWindow && !fromIframe) return;
      const message = event.data;
      if (!message || message.source !== 'pcn-archify' || message.domain !== domain || message.recordId !== recordId) return;
      if (message.nodeId && nodes.some((node) => node.id === message.nodeId)) { setSelectedNodeId(message.nodeId); setReturnOpen(false); }
      if (message.edgeId && (edgeIds.length === 0 || edgeIds.includes(message.edgeId))) setSelectedEdgeId(message.edgeId);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [domain, edgeIds, nodes, recordId]);

  const runTaskAction = async (taskId: string, action: () => Promise<void>) => {
    if (busyTaskId) return;
    setBusyTaskId(taskId);
    try { await action(); } finally { setBusyTaskId(null); }
  };

  const submitReturn = async () => {
    if (!selectedTask || !returnTargetNodeId || !returnReason.trim() || !onReturnTask) return;
    await runTaskAction(selectedTask.id, async () => {
      await onReturnTask(selectedTask.id, { targetNodeId: returnTargetNodeId, reason: returnReason.trim() });
      setReturnOpen(false); setReturnTargetNodeId(''); setReturnReason('');
    });
  };

  const retry = () => { setFrameState('loading'); setRetryNonce((current) => current + 1); };

  return <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm" data-testid={`${domain}-archify-workflow-embed`} aria-label={`Sơ đồ Archify lưu trình ${recordCode}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-slate-800"><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-md bg-cyan-100 px-1.5 py-0.5 font-mono text-[9px] font-black text-cyan-700">ARCHIFY</span><span className="truncate text-[10px] font-black">Sơ đồ lưu trình {domain.toUpperCase()}</span></div><p className="mt-0.5 truncate text-[9px] text-slate-500">Mở node trong reader để xem Passport, nhánh, route, reach và export.</p></div><label className="flex shrink-0 items-center gap-1.5 text-[9px] font-bold text-slate-500">Chế độ<select data-testid="archify-diagram-selector" aria-label="Chọn chế độ sơ đồ Archify" value={diagramType} onChange={(event) => { if (isArchifyDiagramType(event.target.value)) setDiagramType(event.target.value); }} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-700">{ARCHIFY_DIAGRAM_TYPES.map((type) => <option key={type} value={type}>{DIAGRAM_LABELS[type]}</option>)}</select></label></div>
    <div className="mobile-scroll-y relative min-h-0 overflow-y-auto bg-slate-100 p-2">{frameState === 'loading' && <div className="absolute inset-x-0 top-2 z-10 flex justify-center"><span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-white/95 px-2.5 py-1 text-[9px] font-bold text-cyan-700 shadow-sm"><Loader2 size={11} className="animate-spin" /> Đang nạp reader Archify…</span></div>}{frameState === 'unavailable' && <div className="absolute inset-4 z-10 flex items-center justify-center rounded-xl border border-amber-200 bg-white p-4 text-center text-[10px] text-slate-700 shadow-sm"><div><p className="font-black text-amber-700">Không khả dụng</p><p className="mt-1">{unavailableReason}</p><span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[8px] font-bold text-amber-700">{DIAGRAM_LABELS[diagramType]}</span></div></div>}{frameState === 'error' && <div className="absolute inset-4 z-10 flex items-center justify-center rounded-xl border border-rose-200 bg-white p-4 text-center text-[10px] text-slate-700 shadow-sm"><div><p className="font-black text-rose-700">Reader chưa tải được</p><p className="mt-1">{errorMessage}</p><button type="button" onClick={retry} className="mt-2 min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[9px] font-black text-slate-700 hover:bg-slate-50">Thử lại</button></div></div>}{iframeSrc && <iframe ref={iframeRef} title={`Reader Archify hồ sơ ${recordCode}`} src={iframeSrc} onLoad={() => setFrameState('ready')} onError={() => { setErrorMessage('Không tải được reader Archify của hồ sơ này.'); setFrameState('error'); }} className="h-[min(72dvh,680px)] min-h-[420px] w-full rounded-xl border border-slate-200 bg-slate-50 sm:h-[min(78dvh,760px)] sm:min-h-[560px]" />}</div>
    {canRenderMutationDock && selectedNode && <div className="border-t border-slate-200 bg-white px-3 py-2 text-slate-800" data-testid="pcn-archify-action-dock"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-1.5 text-[10px] font-black"><span className="truncate">{selectedNode.label}</span><span className="rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[8px] text-cyan-700">{selectedStatus}</span></div><p className="mt-0.5 text-[9px] text-slate-500">Node đã chọn · thao tác vẫn qua quyền PCN hiện hành.</p></div><button type="button" aria-label="Đóng vùng thao tác node Archify" onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); setReturnOpen(false); }} className="min-h-10 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={14} /></button></div>{selectedStatus !== 'COMPLETED' && selectedStatus !== 'CANCELLED' && <div className="mt-2 flex flex-wrap gap-1.5">{['READY', 'RETURNED'].includes(selectedStatus) && onStartTask && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => void runTaskAction(selectedTask.id, () => onStartTask(selectedTask.id))} className="inline-flex min-h-10 items-center gap-1 rounded-md bg-indigo-500 px-2.5 text-[9px] font-black text-white disabled:opacity-50"><Play size={11} /> Bắt đầu node</button>}{['READY', 'IN_PROGRESS'].includes(selectedStatus) && onCompleteTask && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => void runTaskAction(selectedTask.id, () => onCompleteTask(selectedTask.id))} className="inline-flex min-h-10 items-center gap-1 rounded-md bg-emerald-500 px-2.5 text-[9px] font-black text-white disabled:opacity-50"><CheckCircle2 size={11} /> Hoàn tất node</button>}{['READY', 'IN_PROGRESS', 'WAITING'].includes(selectedStatus) && onReturnTask && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => { setReturnOpen((current) => !current); setReturnTargetNodeId(''); setReturnReason(''); }} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-orange-300 bg-orange-50 px-2.5 text-[9px] font-black text-orange-700 disabled:opacity-50"><RotateCcw size={11} /> Trả về node</button>}{onOpenDocuments && <button type="button" onClick={() => onOpenDocuments(selectedNode.id)} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-slate-200 px-2.5 text-[9px] font-black text-slate-700 hover:bg-slate-50"><FileText size={11} /> Tài liệu node</button>}</div>}{returnOpen && selectedTask && onReturnTask && <div className="mt-2 grid gap-1.5 rounded-lg border border-orange-200 bg-orange-50 p-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"><select aria-label="Node nhận lại hồ sơ" value={returnTargetNodeId} onChange={(event) => setReturnTargetNodeId(event.target.value)} className="rounded-md border border-orange-200 bg-white px-2 py-1.5 text-[9px] text-slate-800"><option value="">Chọn node nhận lại…</option>{nodes.filter((node) => node.id !== selectedNode.id && node.kind !== 'END').map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select><input aria-label="Lý do trả hồ sơ" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Lý do trả lại bắt buộc…" maxLength={1000} className="rounded-md border border-orange-200 bg-white px-2 py-1.5 text-[9px] text-slate-800 placeholder:text-slate-400" /><button type="button" disabled={!returnTargetNodeId || !returnReason.trim() || Boolean(busyTaskId)} onClick={() => void submitReturn()} className="inline-flex min-h-10 items-center justify-center rounded-md bg-orange-500 px-2.5 text-[9px] font-black text-white disabled:opacity-50">Xác nhận</button></div>}{selectedEdgeId && <p className="mt-1 text-[9px] text-slate-500">Quan hệ đang chọn: <span className="font-mono text-cyan-700">{selectedEdgeId}</span></p>}</div>}
  </section>;
}
