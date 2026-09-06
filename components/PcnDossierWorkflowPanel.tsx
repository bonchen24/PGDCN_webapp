'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, CheckCircle2, ChevronDown, CircleDot, GitBranch, RotateCcw, Play, LockKeyhole, FileText } from 'lucide-react';

import type { CertificationDossier, PcnApprovalStep, PcnDossierDocument, PcnDossierDocumentWaiver, PcnDossierWorkflowTask, PcnDocumentRequirement, PcnUserAccount, ReturnedTestResult } from '../types';
import { getPcnWorkflowForDossier } from '../utils/pcnWorkflowTemplate';
import { buildPcnWorkflowConditionContext, projectPcnWorkflowRuntime } from '../utils/pcnWorkflowRuntime';

const statusLabels: Record<PcnDossierWorkflowTask['status'], string> = {
  LOCKED: 'Đang khóa',
  READY: 'Sẵn sàng',
  IN_PROGRESS: 'Đang xử lý',
  WAITING: 'Đang chờ',
  COMPLETED: 'Hoàn tất',
  RETURNED: 'Đã trả lại',
  SKIPPED: 'Bỏ qua',
  STALE: 'Cần làm lại',
  CANCELLED: 'Đã hủy',
};

const kindLabels: Record<string, string> = {
  DOCUMENT_TASK: 'Tài liệu',
  APPROVAL_TASK: 'Phê duyệt',
  DECISION: 'Rẽ nhánh',
  PARALLEL_SPLIT: 'Tách song song',
  PARALLEL_JOIN: 'Gom song song',
  END: 'Kết thúc',
};

function taskStatusClass(status: PcnDossierWorkflowTask['status']): string {
  if (status === 'COMPLETED' || status === 'SKIPPED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'RETURNED' || status === 'STALE') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (status === 'IN_PROGRESS') return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  if (status === 'READY') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  return 'border-slate-200 bg-slate-50 text-slate-500';
}

function displayUser(username: string | undefined, users: PcnUserAccount[]): string {
  if (!username) return 'Chưa gán';
  return users.find((user) => user.username === username)?.name || username;
}

export interface PcnDossierWorkflowPanelProps {
  dossier: CertificationDossier;
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver | undefined>;
  results?: ReturnedTestResult[];
  approvalSteps?: PcnApprovalStep[];
  initialNodeId?: string;
  workflowTasks: PcnDossierWorkflowTask[];
  users?: PcnUserAccount[];
  canEdit: boolean;
  onStartTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string) => Promise<void>;
  onReturnTask?: (taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
}

export function PcnDossierWorkflowPanel({ dossier, requirements, documents, documentWaivers, results = [], approvalSteps = [], workflowTasks, users = [], canEdit, initialNodeId, onStartTask, onCompleteTask, onReturnTask }: PcnDossierWorkflowPanelProps) {
  const workflow = useMemo(() => getPcnWorkflowForDossier(dossier), [dossier]);
  const conditionContext = useMemo(() => buildPcnWorkflowConditionContext({ workflow, documents, documentWaivers, results: results.filter((result) => result.dossierId === dossier.id), approvalSteps: approvalSteps.filter((step) => step.dossierId === dossier.id), fieldCodes: dossier.fieldCodes, method: dossier.method }), [approvalSteps, dossier.fieldCodes, dossier.id, dossier.method, documentWaivers, documents, results, workflow]);
  const projection = useMemo(() => projectPcnWorkflowRuntime({ workflow, tasks: workflowTasks.filter((task) => task.dossierId === dossier.id), documents, documentWaivers, conditionContext }), [conditionContext, dossier.id, documentWaivers, documents, workflow, workflowTasks]);
  const requirementById = useMemo(() => new Map(requirements.map((requirement) => [requirement.id, requirement])), [requirements]);
  const defaultOpenNodeIds = useMemo(() => new Set(projection.nodes.filter((node) => node.isActive || node.returnReason || node.kind === 'END' || node.id === initialNodeId).map((node) => node.id)), [initialNodeId, projection.nodes]);
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setOpenNodeIds((current) => {
      const next = current.size > 0 ? new Set(current) : new Set<string>();
      defaultOpenNodeIds.forEach((nodeId) => next.add(nodeId));
      return next;
    });
  }, [defaultOpenNodeIds]);
  const [returningTaskId, setReturningTaskId] = useState<string | null>(null);
  const [returnTargetNodeId, setReturnTargetNodeId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  const runTaskAction = async (taskId: string, action: () => Promise<void>) => {
    if (busyTaskId) return;
    setBusyTaskId(taskId);
    try { await action(); } finally { setBusyTaskId(null); }
  };

  const submitReturn = async (taskId: string) => {
    if (!returnTargetNodeId || !returnReason.trim() || !onReturnTask) return;
    await runTaskAction(taskId, async () => {
      await onReturnTask(taskId, { targetNodeId: returnTargetNodeId, reason: returnReason.trim() });
      setReturningTaskId(null);
      setReturnTargetNodeId('');
      setReturnReason('');
    });
  };

  return <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3" data-testid="pcn-dossier-dynamic-workflow" aria-label="Lưu trình riêng của hồ sơ PCN">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white"><GitBranch size={16} aria-hidden="true" /></span><div><h2 className="text-xs font-black text-slate-900">Lưu trình riêng của hồ sơ</h2><p className="mt-0.5 text-[9px] leading-4 text-slate-600">{workflow.templateCode} · phiên bản {workflow.templateVersion} · topology được chốt lúc tiếp nhận, không bị đổi theo template mới.</p></div></div>
      <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-black"><span className="rounded-full border border-indigo-200 bg-white px-2 py-1 text-indigo-700">{projection.nodes.length} node</span>{projection.hasReturned && <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-orange-700">Có vòng trả lại</span>}</div>
    </div>

    <div className="mt-3 space-y-1.5" role="list" aria-label="Các node lưu trình hồ sơ">
      {workflow.nodes.map((node, index) => {
        const runtimeNode = projection.byNodeId[node.id];
        const task = workflowTasks.find((item) => item.dossierId === dossier.id && item.nodeId === node.id);
        const isOpen = openNodeIds.has(node.id);
        const nodeRequirements = node.requirementIds.map((id) => requirementById.get(id)).filter((requirement): requirement is PcnDocumentRequirement => Boolean(requirement));
        const isBusy = busyTaskId === task?.id;
        const effectiveTaskStatus = runtimeNode?.status || task?.status;
        return <React.Fragment key={node.id}>
          <details open={isOpen} onToggle={(event) => { const nextOpen = event.currentTarget.open; setOpenNodeIds((current) => { const next = new Set(current); if (nextOpen) next.add(node.id); else next.delete(node.id); return next; }); }} className="group rounded-lg border border-white bg-white/90 shadow-sm" role="listitem">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2.5 text-[10px] font-black text-slate-800" aria-expanded={isOpen}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${runtimeNode?.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : runtimeNode?.isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                {runtimeNode?.status === 'COMPLETED' ? <CheckCircle2 size={14} /> : node.kind === 'PARALLEL_SPLIT' || node.kind === 'PARALLEL_JOIN' ? <GitBranch size={14} /> : runtimeNode?.status === 'LOCKED' ? <LockKeyhole size={14} /> : <CircleDot size={14} />}
              </span>
              <span className="min-w-0 flex-1"><span className="block truncate">{index + 1}. {node.label}</span><span className="mt-0.5 block truncate text-[8px] font-bold text-slate-400">{kindLabels[node.kind] || node.kind}{node.description ? ` · ${node.description}` : ''}</span></span>
              {runtimeNode && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-black ${taskStatusClass(runtimeNode.status)}`}>{statusLabels[runtimeNode.status]}</span>}
              <ChevronDown size={13} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2">
              <div className="grid gap-1.5 text-[9px] sm:grid-cols-2"><div className="rounded-md bg-indigo-50 px-2 py-1.5"><span className="font-bold text-indigo-500">Hồ sơ</span><div className="mt-0.5 truncate font-black text-indigo-900">{dossier.dossierCode}</div></div><div className="rounded-md bg-indigo-50 px-2 py-1.5"><span className="font-bold text-indigo-500">Khách hàng</span><div className="mt-0.5 truncate font-black text-indigo-900">{dossier.customerSnapshot?.name || 'Theo thông tin Đề nghị'}</div></div></div>
              <div className="grid gap-1.5 text-[9px] sm:grid-cols-3"><div className="rounded-md bg-slate-50 px-2 py-1.5"><span className="font-bold text-slate-400">Người xử lý</span><div className="mt-0.5 font-black text-slate-700">{displayUser(runtimeNode?.assignedUsername, users)}</div></div><div className="rounded-md bg-slate-50 px-2 py-1.5"><span className="font-bold text-slate-400">Vòng xử lý</span><div className="mt-0.5 font-black text-slate-700">#{runtimeNode?.cycleNo || task?.cycleNo || 1}</div></div><div className="rounded-md bg-slate-50 px-2 py-1.5"><span className="font-bold text-slate-400">Node kế tiếp</span><div className="mt-0.5 font-black text-slate-700">{projection.edges.filter((edge) => edge.fromNodeId === node.id).map((edge) => projection.byNodeId[edge.toNodeId]?.label).filter(Boolean).join(' · ') || 'Kết thúc'}</div></div></div>
              {nodeRequirements.length > 0 && <div className="mt-2 rounded-md border border-slate-100 bg-white px-2 py-1.5"><div className="flex items-center gap-1 text-[9px] font-black text-slate-600"><FileText size={12} className="text-indigo-500" /> Tài liệu cần thực hiện</div><div className="mt-1 flex flex-wrap gap-1">{nodeRequirements.map((requirement) => { const document = documents.find((item) => item.requirementId === requirement.id); const waived = documentWaivers?.[requirement.id]?.reason?.trim(); return <span key={requirement.id} className={`rounded-full border px-1.5 py-0.5 text-[8px] font-bold ${document?.status === 'PRESENT' || waived ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{requirement.name}{document?.status === 'PRESENT' ? ' · đã có' : waived ? ' · bỏ qua' : ' · cần bổ sung'}</span>; })}</div></div>}
              {runtimeNode?.blockedReason && <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[9px] font-bold text-amber-800">Chưa thể hoàn tất: {runtimeNode.blockedReason === 'MISSING_DOCUMENT' ? 'còn tài liệu bắt buộc.' : runtimeNode.blockedReason === 'JOIN_POLICY' ? 'chưa đủ các nhánh song song.' : runtimeNode.blockedReason === 'CONDITION' ? 'điều kiện rẽ nhánh chưa đạt.' : 'node trước chưa hoàn tất.'}</p>}
              {runtimeNode?.returnReason && <p className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-2 py-1.5 text-[9px] font-bold text-orange-800"><RotateCcw size={11} className="mr-1 inline" /> Lý do trả lại: {runtimeNode.returnReason}{runtimeNode.returnTargetNodeId ? ` · về ${projection.byNodeId[runtimeNode.returnTargetNodeId]?.label || runtimeNode.returnTargetNodeId}` : ''}</p>}
              {task && canEdit && effectiveTaskStatus !== 'COMPLETED' && effectiveTaskStatus !== 'CANCELLED' && <div className="mt-2 flex flex-wrap items-center gap-1.5"><div className="flex flex-wrap gap-1.5">{['READY', 'RETURNED'].includes(effectiveTaskStatus || '') && onStartTask && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => void runTaskAction(task.id, () => onStartTask(task.id))} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-indigo-600 px-2.5 text-[9px] font-black text-white disabled:opacity-50"><Play size={11} /> {isBusy ? 'Đang xử lý...' : 'Bắt đầu node'}</button>}{['READY', 'IN_PROGRESS'].includes(effectiveTaskStatus || '') && onCompleteTask && !runtimeNode?.blockedReason && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => void runTaskAction(task.id, () => onCompleteTask(task.id))} className="inline-flex min-h-8 items-center gap-1 rounded-md bg-emerald-600 px-2.5 text-[9px] font-black text-white disabled:opacity-50"><CheckCircle2 size={11} /> Hoàn tất node</button>}{['READY', 'IN_PROGRESS', 'WAITING'].includes(effectiveTaskStatus || '') && onReturnTask && <button type="button" disabled={Boolean(busyTaskId)} onClick={() => { setReturningTaskId(returningTaskId === task.id ? null : task.id); setReturnTargetNodeId(''); setReturnReason(''); }} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2.5 text-[9px] font-black text-orange-700 disabled:opacity-50"><RotateCcw size={11} /> Trả về node</button>}</div></div>}
              {returningTaskId === task?.id && onReturnTask && <div className="mt-2 grid gap-1.5 rounded-md border border-orange-200 bg-orange-50/60 p-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]"><select aria-label="Node nhận lại hồ sơ" value={returnTargetNodeId} onChange={(event) => setReturnTargetNodeId(event.target.value)} className="rounded-md border border-orange-200 bg-white px-2 py-1.5 text-[9px]"><option value="">Chọn node nhận lại...</option>{workflow.nodes.filter((candidate) => candidate.id !== node.id && candidate.kind !== 'END').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</select><input aria-label="Lý do trả hồ sơ" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Lý do trả lại bắt buộc..." className="rounded-md border border-orange-200 bg-white px-2 py-1.5 text-[9px]" maxLength={1000} /><button type="button" disabled={!returnTargetNodeId || !returnReason.trim() || Boolean(busyTaskId)} onClick={() => void submitReturn(task.id)} className="inline-flex min-h-8 items-center justify-center rounded-md bg-orange-600 px-2.5 text-[9px] font-black text-white disabled:opacity-50">Xác nhận</button></div>}
            </div>
          </details>
          {index < workflow.nodes.length - 1 && <div className="flex justify-center text-indigo-300" aria-hidden="true"><ArrowDown size={13} /></div>}
        </React.Fragment>;
      })}
    </div>
    {workflow.transitions.some((transition) => transition.condition && transition.condition !== 'ALWAYS') && <p className="mt-2 text-[9px] text-indigo-700">Các cạnh có điều kiện được đánh giá theo dữ liệu hồ sơ đã lưu; người dùng không thể nhập biểu thức tùy ý.</p>}
  </section>;
}

export default PcnDossierWorkflowPanel;

// --- End of PcnDossierWorkflowPanel.tsx ---
