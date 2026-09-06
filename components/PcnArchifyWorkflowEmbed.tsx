'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Play, RotateCcw, X } from 'lucide-react';

import type { PcnDossierWorkflowTask } from '../types';

export type ArchifyEmbedDomain = 'pcn' | 'pgd';

export interface PcnArchifyEmbedNode {
  id: string;
  label: string;
  kind?: string;
}

export interface PcnArchifyWorkflowEmbedProps {
  domain: ArchifyEmbedDomain;
  recordId: string;
  recordCode: string;
  initialNodeId?: string;
  nodes?: readonly PcnArchifyEmbedNode[];
  workflowTasks?: readonly PcnDossierWorkflowTask[];
  canEdit?: boolean;
  onStartTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string) => Promise<void>;
  onReturnTask?: (taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
  onOpenDocuments?: (nodeId: string) => void;
}

type ArchifyFocusMessage = {
  source?: string;
  domain?: ArchifyEmbedDomain;
  recordId?: string;
  nodeId?: string;
  edgeId?: string;
};

function taskStatus(task: PcnDossierWorkflowTask | undefined): string {
  return task?.status || 'LOCKED';
}

export default function PcnArchifyWorkflowEmbed({ domain, recordId, recordCode, initialNodeId, nodes = [], workflowTasks = [], canEdit = false, onStartTask, onCompleteTask, onReturnTask, onOpenDocuments }: PcnArchifyWorkflowEmbedProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [frameState, setFrameState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnTargetNodeId, setReturnTargetNodeId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const taskByNodeId = useMemo(() => new Map(workflowTasks.filter((task) => task.dossierId === recordId).map((task) => [task.nodeId, task])), [recordId, workflowTasks]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);
  const selectedTask = selectedNodeId ? taskByNodeId.get(selectedNodeId) : undefined;
  const selectedStatus = taskStatus(selectedTask);

  useEffect(() => {
    const onMessage = (event: MessageEvent<ArchifyFocusMessage>) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data;
      if (!message || message.source !== 'pcn-archify' || message.domain !== domain || message.recordId !== recordId) return;
      if (message.nodeId && nodes.some((node) => node.id === message.nodeId)) {
        setSelectedNodeId(message.nodeId);
        setReturnOpen(false);
      }
      if (message.edgeId) setSelectedEdgeId(message.edgeId);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [domain, nodes, recordId]);

  const runTaskAction = async (taskId: string, action: () => Promise<void>) => {
    if (busyTaskId) return;
    setBusyTaskId(taskId);
    try { await action(); } finally { setBusyTaskId(null); }
  };

  const submitReturn = async () => {
    if (!selectedTask || !returnTargetNodeId || !returnReason.trim() || !onReturnTask) return;
    await runTaskAction(selectedTask.id, async () => {
      await onReturnTask(selectedTask.id, { targetNodeId: returnTargetNodeId, reason: returnReason.trim() });
      setReturnOpen(false);
      setReturnTargetNodeId('');
      setReturnReason('');
    });
  };

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm" data-testid={`${domain}-archify-workflow-embed`} aria-label={`Sơ đồ Archify lưu trình ${recordCode}`}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900 px-3 py-2 text-white">
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-md bg-cyan-400/15 px-1.5 py-0.5 font-mono text-[9px] font-black text-cyan-200">ARCHIFY</span><span className="truncate text-[10px] font-black">Sơ đồ lưu trình {domain.toUpperCase()}</span></div><p className="mt-0.5 truncate text-[9px] text-slate-400">Mở node trong reader để xem Passport, nhánh, route, reach và export.</p></div><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-bold text-slate-300">{nodes.length || '—'} node</span>
    </div>
    <div className="relative bg-slate-950 p-2">
      {frameState === 'loading' && <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center"><span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-slate-900/90 px-2.5 py-1 text-[9px] font-bold text-cyan-200"><Loader2 size={11} className="animate-spin" /> Đang nạp reader Archify…</span></div>}
      {frameState === 'error' && <div className="absolute inset-4 z-10 flex items-center justify-center rounded-xl border border-rose-300/30 bg-slate-900/95 p-4 text-center text-[10px] font-bold text-rose-200">Không tải được reader Archify của hồ sơ này.</div>}
      <iframe title={`Reader Archify hồ sơ ${recordCode}`} src={`/api/${domain === 'pcn' ? 'pcn/dossiers' : 'pgd/requests'}/${encodeURIComponent(recordId)}/archify?embed=1${initialNodeId ? `#focus=${encodeURIComponent(initialNodeId)}` : ''}`} onLoad={() => setFrameState('ready')} onError={() => setFrameState('error')} className="h-[min(78dvh,760px)] min-h-[560px] w-full rounded-xl border border-white/10 bg-slate-900" />
    </div>
    {selectedNode && domain === 'pcn' && <div className="border-t border-white/10 bg-slate-900 px-3 py-2 text-white" data-testid="pcn-archify-action-dock">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-1.5 text-[10px] font-black"><span className="truncate">{selectedNode.label}</span><span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[8px] text-cyan-200">{selectedStatus}</span></div><p className="mt-0.5 text-[9px] text-slate-400">Node đã chọn · thao tác vẫn qua quyền PCN hiện hành.</p></div><button type="button" aria-label="Đóng vùng thao tác node Archify" onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); setReturnOpen(false); }} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X size={14} /></button></div>
      {selectedTask && canEdit && selectedStatus !== 'COMPLETED' && selectedStatus !== 'CANCELLED' && <div className="mt-2 flex flex-wrap gap-1.5"><div className="flex flex-wrap gap-1.5">{['READY', 'RETURNED'].includes(selectedStatus) && onStartTask && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => void runTaskAction(selectedTask.id, () => onStartTask(selectedTask.id))} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-indigo-500 px-2.5 text-[9px] font-black text-white disabled:opacity-50"><Play size={11} /> Bắt đầu node</button>}{['READY', 'IN_PROGRESS'].includes(selectedStatus) && onCompleteTask && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => void runTaskAction(selectedTask.id, () => onCompleteTask(selectedTask.id))} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-emerald-500 px-2.5 text-[9px] font-black text-white disabled:opacity-50"><CheckCircle2 size={11} /> Hoàn tất node</button>}{['READY', 'IN_PROGRESS', 'WAITING'].includes(selectedStatus) && onReturnTask && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => { setReturnOpen((current) => !current); setReturnTargetNodeId(''); setReturnReason(''); }} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-orange-300/40 bg-orange-400/10 px-2.5 text-[9px] font-black text-orange-200 disabled:opacity-50"><RotateCcw size={11} /> Trả về node</button>}{onOpenDocuments && <button type="button" onClick={() => onOpenDocuments(selectedNode.id)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-white/15 px-2.5 text-[9px] font-black text-slate-200 hover:bg-white/10"><FileText size={11} /> Tài liệu node</button>}</div></div>}
      {returnOpen && selectedTask && onReturnTask && <div className="mt-2 grid gap-1.5 rounded-lg border border-orange-300/30 bg-orange-400/10 p-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"><select aria-label="Node nhận lại hồ sơ" value={returnTargetNodeId} onChange={(event) => setReturnTargetNodeId(event.target.value)} className="rounded-md border border-orange-200/30 bg-slate-900 px-2 py-1.5 text-[9px] text-white"><option value="">Chọn node nhận lại…</option>{nodes.filter((node) => node.id !== selectedNode.id && node.kind !== 'END').map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select><input aria-label="Lý do trả hồ sơ" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Lý do trả lại bắt buộc…" maxLength={1000} className="rounded-md border border-orange-200/30 bg-slate-900 px-2 py-1.5 text-[9px] text-white placeholder:text-slate-500" /><button type="button" disabled={!returnTargetNodeId || !returnReason.trim() || Boolean(busyTaskId)} onClick={() => void submitReturn()} className="inline-flex min-h-8 items-center justify-center rounded-md bg-orange-500 px-2.5 text-[9px] font-black text-white disabled:opacity-50">Xác nhận</button></div>}
      {selectedEdgeId && <p className="mt-1 text-[9px] text-slate-500">Quan hệ đang chọn: <span className="font-mono text-cyan-200">{selectedEdgeId}</span></p>}
    </div>}
  </section>;
}
