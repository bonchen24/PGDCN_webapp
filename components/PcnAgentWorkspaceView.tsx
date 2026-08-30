'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileSearch,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';

import type { CertificationDossier, PcnUserAccount } from '../types.ts';
import {
  cancelPcnAgentAction,
  confirmPcnAgentAction,
  fetchLatestPcnAgentConversation,
  fetchPcnAgentWorkspace,
  sendPcnAgentMessage,
} from '../utils/pcnAgentApi.ts';
import type { PcnAgentConversationMessage } from '../utils/pcnAgentApi.ts';
import type {
  PcnAgentAction,
  PcnAgentRecommendation,
  PcnAgentResponseBlock,
  PcnAgentWorkItem,
  PcnAgentWorkspace,
} from '../utils/pcnAgentTypes.ts';
import { isPcnAgentTaskOverdue } from '../utils/pcnAgentWorkspace.ts';

type ChatEntry = PcnAgentConversationMessage;

function roleLabel(user: PcnAgentWorkspace['user']): string {
  const labels: Record<string, string> = {
    LEADERSHIP: 'Lãnh đạo phòng',
    CERTIFICATION_EXPERT: 'Chuyên viên chứng nhận',
    TECHNICAL_REVIEWER: 'Chuyên gia thẩm xét',
    SAMPLE_COORDINATOR: 'Điều phối mẫu',
    DOCUMENT_CLERK: 'Văn thư hồ sơ',
    UNASSIGNED: 'Chưa gán chức vụ',
  };
  return labels[user.departmentRoleCode] || user.position || 'Nhân sự PCN';
}

function priorityLabel(priority: PcnAgentWorkItem['priority']): string {
  return priority === 'OVERDUE' ? 'Quá hạn' : priority === 'DUE_SOON' ? 'Sắp đến hạn' : 'Theo dõi';
}

function priorityClass(priority: PcnAgentWorkItem['priority']): string {
  return priority === 'OVERDUE'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : priority === 'DUE_SOON'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-600';
}

function formatDate(value?: string): string {
  if (!value) return 'Chưa có hạn';
  return value.slice(0, 10);
}

function Kpi({ label, value, hint, icon: Icon, tone }: { label: string; value: number; hint: string; icon: React.ElementType; tone: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 text-2xl font-black leading-none text-slate-900">{value}</div><div className="mt-1 text-[10px] text-slate-500">{hint}</div></div><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}><Icon size={17} /></span></div></div>;
}

function WorkCard({ item, onOpen, onAsk }: { item: PcnAgentWorkItem; onOpen: (item: PcnAgentWorkItem) => void; onAsk: (item: PcnAgentWorkItem) => void }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-[11px] font-black text-slate-900">{item.dossierCode}</span><span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-black ${priorityClass(item.priority)}`}>{priorityLabel(item.priority)}</span></div><div className="mt-1 truncate text-[11px] font-bold text-slate-700">{item.customerName} · {item.productName}</div></div><span className="rounded-md bg-emerald-50 px-1.5 py-1 text-[10px] font-black text-emerald-700">{item.priorityScore}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500"><span>Bước: <b className="text-slate-700">{item.stationTitle}</b></span><span>Hạn: <b className="text-slate-700">{formatDate(item.targetDate)}</b></span><span>Hoàn thiện: <b className="text-slate-700">{item.completenessScore}%</b></span><span>Thiếu: <b className={item.missingRequiredCount > 0 ? 'text-rose-700' : 'text-emerald-700'}>{item.missingRequiredCount}</b></span></div><div className="mt-2 text-[10px] font-bold leading-4 text-slate-600">{item.stepLabel}</div><div className="mt-2 flex flex-wrap gap-1.5"><button type="button" onClick={() => onOpen(item)} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-[10px] font-black text-white hover:bg-emerald-500"><ArrowUpRight size={12} /> Mở hồ sơ</button><button type="button" onClick={() => onAsk(item)} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700"><MessageCircle size={12} /> Hỏi AI</button></div></article>;
}

function RecommendationCard({ recommendation, dossier, onOpen }: { recommendation: PcnAgentRecommendation; dossier?: CertificationDossier; onOpen: (dossier: CertificationDossier) => void }) {
  const content = <><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${recommendation.priority === 'OVERDUE' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}><AlertTriangle size={11} /></span><span className="min-w-0"><b className="block text-[10px] text-slate-800">{recommendation.title}</b><span className="block text-[9px] leading-4 text-slate-500">{recommendation.description}</span></span></>;
  if (!dossier) return <div className="flex w-full items-start gap-2 rounded-lg border border-slate-100 p-2">{content}</div>;
  return <button type="button" onClick={() => onOpen(dossier)} className="flex w-full items-start gap-2 rounded-lg border border-slate-100 p-2 text-left hover:border-indigo-200">{content}</button>;
}

interface AssignmentWorkloadEvidence {
  dossierCount: number;
  overdueCount: number;
  dueSoonCount: number;
  risk: 'NORMAL' | 'HIGH';
}

function getAssignmentWorkload(action: PcnAgentAction): AssignmentWorkloadEvidence | null {
  const raw = action.payload.assigneeWorkload;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const numberValue = (key: string): number => {
    const parsed = Number(value[key]);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };
  return {
    dossierCount: numberValue('dossierCount'),
    overdueCount: numberValue('overdueCount'),
    dueSoonCount: numberValue('dueSoonCount'),
    risk: value.risk === 'HIGH' ? 'HIGH' : 'NORMAL',
  };
}

function actionStatusLabel(status: PcnAgentAction['status']): string {
  if (status === 'EXECUTED') return 'Đã tạo task';
  if (status === 'CANCELLED') return 'Đã hủy đề xuất';
  if (status === 'REJECTED') return 'Đề xuất bị từ chối';
  if (status === 'FAILED') return 'Thực hiện thất bại';
  if (status === 'CONFIRMED') return 'Đang thực hiện';
  return 'Đề xuất đang chờ xác nhận';
}

function ResponseBlocks({ blocks, asOf, onOpenRecord, onConfirmAction, onCancelAction, pendingActionId, resolvedActions }: { blocks: PcnAgentResponseBlock[]; asOf: string; onOpenRecord: (dossierId: string) => void; onConfirmAction: (action: PcnAgentAction) => Promise<void>; onCancelAction: (action: PcnAgentAction) => Promise<void>; pendingActionId: string | null; resolvedActions: Record<string, PcnAgentAction['status']> }) {
  return <div className="space-y-2">{blocks.map((block, index) => {
    if (block.type === 'message') return <div key={`message-${index}`} className="whitespace-pre-line rounded-lg bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-700">{block.text}</div>;
    if (block.type === 'work_summary') return <div key={`summary-${index}`} className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 text-[10px] text-emerald-900"><b>{block.title}</b><div className="mt-1 flex flex-wrap gap-3"><span>Hôm nay: <b>{block.metrics.today}</b></span><span>Quá hạn: <b>{block.metrics.overdue}</b></span><span>Task mở: <b>{block.metrics.openTasks}</b></span><span>Đang xử lý: <b>{block.metrics.activeDossiers}</b></span></div></div>;
    if (block.type === 'record_list') return <div key={`records-${index}`}><div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{block.title}</div><div className="space-y-1.5">{block.records.map((record) => <div key={record.dossierId} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2"><div className="min-w-0"><div className="font-mono text-[10px] font-black text-slate-800">{record.dossierCode}</div><div className="truncate text-[10px] text-slate-500">{record.customerName} · {record.stationTitle}</div></div><button type="button" onClick={() => onOpenRecord(record.dossierId)} className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[9px] font-black text-emerald-700">Mở</button></div>)}</div></div>;
    if (block.type === 'task_list') return <div key={`tasks-${index}`}><div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">{block.title}</div><div className="space-y-1.5">{block.tasks.map((task) => { const overdue = isPcnAgentTaskOverdue(task, asOf); return <div key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2"><div className="min-w-0"><div className="text-[10px] font-black text-slate-800">{task.title}</div><div className="truncate text-[10px] text-slate-500">{task.dossierCode || 'Không gắn hồ sơ'} · {task.dueAt ? `Hạn ${formatDate(task.dueAt)}` : 'Chưa có hạn'}</div></div><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black ${overdue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{overdue ? 'Quá hạn' : 'Đang mở'}</span></div>; })}</div></div>;
    if (block.type === 'warning') return <div key={`warning-${index}`} className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[10px] text-rose-800"><div className="flex items-center gap-1 font-black"><AlertTriangle size={13} /> {block.title}</div><div className="mt-1">{block.text}</div></div>;
    if (block.type === 'recommendation') return <div key={`recommendation-${index}`} className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2.5"><div className="text-[10px] font-black text-indigo-900">{block.title}</div><div className="mt-1 space-y-1 text-[10px] text-indigo-800">{block.recommendations.map((item) => <div key={item.id}>• {item.title}: {item.description}</div>)}</div></div>;
    if (block.type === 'draft') return <div key={`draft-${index}`} className="rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 text-[10px] text-blue-900"><b>{block.title}</b><div className="mt-1 whitespace-pre-line">{block.text}</div></div>;
    if (block.type === 'proposed_action') {
      const actionStatus = resolvedActions[block.action.id] || block.action.status;
      const isAssignmentDraft = block.action.actionType === 'PROPOSE_ASSIGNMENT';
      const isPending = pendingActionId === block.action.id;
      const assigneeWorkload = isAssignmentDraft ? getAssignmentWorkload(block.action) : null;
      return <div key={`action-${block.action.id}`} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <div className="flex items-center gap-1 text-[10px] font-black text-amber-900"><ShieldAlert size={13} /> {block.action.title}</div>
        <div className="mt-1 text-[10px] leading-4 text-amber-800">{block.action.description}</div>
        {assigneeWorkload && <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-md border border-amber-200 bg-white/70 p-2 text-[9px] text-amber-900"><span>Ứng viên: <b>{String(block.action.payload.assigneeName || block.action.payload.assigneeUsername || 'Chưa xác định')}</b></span><span>Rủi ro: <b>{assigneeWorkload.risk === 'HIGH' ? 'Cao' : 'Bình thường'}</b></span><span>Đang có: <b>{assigneeWorkload.dossierCount}</b> hồ sơ</span><span>Quá hạn: <b>{assigneeWorkload.overdueCount}</b> · Deadline gần: <b>{assigneeWorkload.dueSoonCount}</b></span></div>}
        {actionStatus !== 'PROPOSED' ? <div className="mt-2 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-bold text-emerald-800"><CheckCircle2 size={13} /> {actionStatusLabel(actionStatus)}</div> : isAssignmentDraft ? <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-white/60 px-2 py-1.5"><span className="text-[10px] font-bold text-amber-800">Đề xuất nháp — chưa thay đổi chủ hồ sơ.</span><button type="button" onClick={() => void onCancelAction(block.action)} disabled={pendingActionId !== null} aria-busy={isPending} className="rounded-md border border-amber-300 px-2 py-1 text-[10px] font-bold text-amber-800 disabled:cursor-wait disabled:opacity-60">{isPending ? 'Đang hủy…' : 'Hủy'}</button></div> : <div className="mt-2 flex gap-1.5"><button type="button" onClick={() => void onConfirmAction(block.action)} disabled={pendingActionId !== null} aria-busy={isPending} className="rounded-md bg-amber-600 px-2 py-1.5 text-[10px] font-black text-white disabled:cursor-wait disabled:opacity-60">{isPending ? 'Đang xác nhận…' : 'Xác nhận tạo task'}</button><button type="button" onClick={() => void onCancelAction(block.action)} disabled={pendingActionId !== null} aria-busy={isPending} className="rounded-md border border-amber-300 px-2 py-1.5 text-[10px] font-bold text-amber-800 disabled:cursor-wait disabled:opacity-60">{isPending ? 'Đang hủy…' : 'Hủy'}</button></div>}
      </div>;
    }
    if (block.type === 'chart_data') return <div key={`chart-${index}`} className="rounded-lg border border-slate-200 bg-white p-2.5"><div className="mb-1 text-[10px] font-black text-slate-700">{block.title}</div><div className="space-y-1">{block.rows.map((row, rowIndex) => <div key={`${String(row.name)}-${rowIndex}`} className="flex items-center justify-between text-[10px] text-slate-600"><span>{String(row.name)}</span><span className="font-black">{String(row.hồ_sơ ?? 0)} hồ sơ · {String(row.quá_hạn ?? 0)} quá hạn</span></div>)}</div></div>;
    return null;
  })}</div>;
}

export function PcnAgentWorkspaceView({ currentUser, dossiers, onOpenDossier }: { currentUser: Pick<PcnUserAccount, 'username'>; dossiers: CertificationDossier[]; onOpenDossier: (dossier: CertificationDossier) => void }) {
  const [workspace, setWorkspace] = useState<PcnAgentWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const pendingActionIdRef = useRef<string | null>(null);
  const [resolvedActions, setResolvedActions] = useState<Record<string, PcnAgentAction['status']>>({});
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [chat, setChat] = useState<ChatEntry[]>([]);

  const loadWorkspace = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const next = await fetchPcnAgentWorkspace();
      setWorkspace(next);
      setError(null);
    } catch (loadError: any) {
      setError(loadError?.message || 'Không thể tải workspace AI Trợ lý.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadConversation = useCallback(async () => fetchLatestPcnAgentConversation(), []);

  useEffect(() => {
    let cancelled = false;
    setConversationId(undefined);
    setChat([]);
    pendingActionIdRef.current = null;
    setPendingActionId(null);
    setResolvedActions({});
    void loadWorkspace();
    void loadConversation()
      .then((next) => {
        if (cancelled) return;
        setConversationId(next.conversationId);
        setChat(next.messages);
      })
      .catch((loadError: any) => {
        if (!cancelled) console.warn('Không thể khôi phục hội thoại AI gần nhất:', loadError?.message || loadError);
      });
    return () => { cancelled = true; };
  }, [currentUser.username, loadConversation, loadWorkspace]);

  const openRecord = useCallback((item: PcnAgentWorkItem) => {
    const dossier = dossiers.find((candidate) => candidate.id === item.dossierId);
    if (dossier) onOpenDossier(dossier);
    else toast.error('Hồ sơ không còn trong snapshot hiện tại.');
  }, [dossiers, onOpenDossier]);

  const askAbout = useCallback((item: PcnAgentWorkItem) => {
    setMessage(`Phân tích hồ sơ ${item.dossierCode}`);
  }, []);

  const send = useCallback(async (preset?: string) => {
    const text = String(preset || message).trim();
    if (!text || sending) return;
    setMessage('');
    setSending(true);
    setChat((items) => [...items, { id: `user-${Date.now()}`, role: 'user', text }]);
    try {
      const result = await sendPcnAgentMessage({ message: text, conversationId });
      setConversationId(result.conversationId);
      setChat((items) => [...items, { id: `assistant-${Date.now()}`, role: 'assistant', blocks: result.blocks }]);
    } catch (sendError: any) {
      toast.error(sendError?.message || 'Không thể gửi câu hỏi AI.');
    } finally {
      setSending(false);
    }
  }, [conversationId, message, sending]);

  const confirmAction = useCallback(async (action: PcnAgentAction) => {
    if (action.status !== 'PROPOSED' || pendingActionIdRef.current !== null) return;
    pendingActionIdRef.current = action.id;
    setPendingActionId(action.id);
    try {
      const result = await confirmPcnAgentAction(action.id);
      setResolvedActions((items) => ({ ...items, [action.id]: result.action.status }));
      toast.success('Đã tạo task theo xác nhận của bạn.');
      await loadWorkspace(true);
    } catch (actionError: any) {
      toast.error(actionError?.message || 'Không thể xác nhận action AI.');
    } finally {
      pendingActionIdRef.current = null;
      setPendingActionId(null);
    }
  }, [loadWorkspace]);

  const cancelAction = useCallback(async (action: PcnAgentAction) => {
    if (action.status !== 'PROPOSED' || pendingActionIdRef.current !== null) return;
    pendingActionIdRef.current = action.id;
    setPendingActionId(action.id);
    try {
      const result = await cancelPcnAgentAction(action.id);
      setResolvedActions((items) => ({ ...items, [action.id]: result.action.status }));
      toast.success('Đã hủy đề xuất.');
    } catch (actionError: any) {
      toast.error(actionError?.message || 'Không thể hủy đề xuất AI.');
    } finally {
      pendingActionIdRef.current = null;
      setPendingActionId(null);
    }
  }, []);

  const topWork = useMemo(() => workspace?.myWork.slice(0, 6) || [], [workspace]);
  const departmentTopWork = useMemo(() => workspace?.allWork?.filter((item) => item.priority !== 'NORMAL' || item.missingRequiredCount > 0).slice(0, 6) || [], [workspace]);
  if (loading) return <div className="flex h-full items-center justify-center gap-2 bg-slate-50 text-xs font-bold text-slate-500"><Loader2 className="animate-spin" size={16} /> Đang dựng context công việc...</div>;
  if (error || !workspace) return <div className="flex h-full items-center justify-center bg-slate-50 p-5"><div className="max-w-md rounded-xl border border-rose-200 bg-white p-5 text-center shadow-sm"><AlertTriangle className="mx-auto text-rose-500" size={22} /><div className="mt-2 text-sm font-black text-slate-800">Không tải được AI Workspace</div><div className="mt-1 text-[11px] text-slate-500">{error || 'Không có dữ liệu workspace.'}</div><button type="button" onClick={() => void loadWorkspace()} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white">Thử lại</button></div></div>;

  return <div className="h-full overflow-y-auto bg-slate-50/70 p-3 md:p-5 mobile-safe-bottom"><div className="mx-auto max-w-[1500px] space-y-4"><header className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600"><Bot size={15} /> AI Workspace PCN</div><h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 md:text-2xl">Xin chào, {workspace.user.name}</h1><p className="mt-1 text-[11px] text-slate-500">{roleLabel(workspace.user)} · Phạm vi {workspace.user.fieldCodes.length ? workspace.user.fieldCodes.join(', ') : 'toàn phòng theo quyền'}</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><UserRound size={15} /></span><div><div className="text-[10px] font-black text-slate-800">{workspace.user.name}</div><div className="text-[9px] text-slate-500">{workspace.user.position || roleLabel(workspace.user)}</div></div><button type="button" aria-label="Làm mới AI Workspace" onClick={() => void loadWorkspace(true)} className="ml-1 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-emerald-700">{refreshing ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}</button></div></header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-5"><Kpi label="Việc hôm nay" value={workspace.metrics.today} hint="Hồ sơ/task có hạn hôm nay" icon={CheckCircle2} tone="bg-emerald-50 text-emerald-600" /><Kpi label="Quá hạn" value={workspace.metrics.overdue} hint="Hồ sơ/task cần xử lý trước" icon={AlertTriangle} tone="bg-rose-50 text-rose-600" /><Kpi label="Đang xử lý" value={workspace.metrics.activeDossiers} hint={`Hồ sơ chưa hoàn tất · ${workspace.metrics.openTasks} task mở`} icon={FileSearch} tone="bg-blue-50 text-blue-600" /><Kpi label="Chờ khách hàng" value={workspace.metrics.waitingCustomer} hint="Đang chờ bổ sung/khắc phục" icon={Clock3} tone="bg-amber-50 text-amber-600" /><Kpi label="Deadline gần" value={workspace.metrics.upcomingDeadlines} hint="Trong 3 ngày tới" icon={CalendarClock} tone="bg-indigo-50 text-indigo-600" /></section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600"><CheckCircle2 size={14} className="text-emerald-600" /> Hoạt động nghiệp vụ</div><div className="mt-2 grid gap-2 md:grid-cols-4">{workspace.activity.map((item) => <div key={item.id} className="rounded-lg bg-slate-50 p-2"><div className="flex items-center gap-1 text-[10px] font-bold text-slate-700"><CheckCircle2 size={12} className="text-emerald-600" /> {item.label}</div><div className="mt-1 text-[9px] leading-4 text-slate-500">{item.detail}</div></div>)}</div></section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]"><div className="space-y-4"><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-900">{workspace.allWork ? 'Hồ sơ ưu tiên toàn phòng' : 'Công việc ưu tiên'}</h2><p className="mt-0.5 text-[10px] text-slate-500">Xếp theo deadline, trạng thái block và mức độ thiếu dữ liệu.</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-500">{workspace.allWork ? workspace.allWork.length : workspace.myWork.length} hồ sơ</span></div>{(workspace.allWork ? departmentTopWork : topWork).length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-[11px] text-slate-500">{workspace.allWork ? 'Chưa có hồ sơ cần chú ý trong toàn phòng.' : 'Chưa có hồ sơ được giao trực tiếp.'}</div> : <div className="grid gap-2 md:grid-cols-2">{(workspace.allWork ? departmentTopWork : topWork).map((item) => <WorkCard key={item.dossierId} item={item} onOpen={openRecord} onAsk={askAbout} />)}</div>}</div></div><div className="space-y-4"><div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 shadow-sm"><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-indigo-800"><Sparkles size={14} /> AI briefing</div><p className="mt-2 whitespace-pre-line text-[11px] leading-5 text-indigo-950">{workspace.briefing}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600"><CalendarClock size={14} /> Deadline sắp tới</div>{workspace.upcomingDeadlines.length === 0 ? <p className="mt-2 text-[10px] text-slate-500">Chưa có deadline trong phạm vi của bạn.</p> : <div className="mt-2 space-y-1.5">{workspace.upcomingDeadlines.slice(0, 5).map((deadline) => <button type="button" key={deadline.id} onClick={() => { const dossier = dossiers.find((candidate) => candidate.id === deadline.dossierId); if (dossier) onOpenDossier(dossier); }} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-100 p-2 text-left hover:border-emerald-200"><span className="min-w-0"><b className="block font-mono text-[10px] text-slate-800">{deadline.dossierCode}</b><span className="block truncate text-[9px] text-slate-500">{deadline.label}</span></span><span className={`shrink-0 text-[9px] font-black ${deadline.overdue ? 'text-rose-700' : 'text-slate-600'}`}>{deadline.overdue ? `Quá ${Math.abs(deadline.daysRemaining)} ngày` : deadline.daysRemaining === 0 ? 'Hôm nay' : `Còn ${deadline.daysRemaining} ngày`}</span></button>)}</div>}</div></div></section>

      {workspace.tasks.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-900">Task của tôi</h2><p className="mt-0.5 text-[10px] text-slate-500">Các việc đang mở được giao trực tiếp cho bạn.</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">{workspace.metrics.openTasks} đang mở</span></div><div className="grid gap-2 md:grid-cols-2">{workspace.tasks.slice(0, 8).map((task) => <div key={task.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="min-w-0"><div className="truncate text-[10px] font-black text-slate-800">{task.title}</div><div className="mt-0.5 truncate text-[9px] text-slate-500">{task.dossierCode || 'Task nội bộ'} · {task.dueAt ? `Hạn ${formatDate(task.dueAt)}` : 'Chưa có hạn'}</div></div><CheckCircle2 size={14} className="shrink-0 text-emerald-600" /></div>)}</div></section>}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-900">AI đề xuất</h2><p className="mt-0.5 text-[10px] text-slate-500">Phát hiện từ trạng thái, checklist, task, phân công và workload hiện tại.</p></div><Sparkles className="text-indigo-500" size={16} /></div>{workspace.recommendations.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[10px] text-slate-500">Hiện chưa có đề xuất cần chú ý.</div> : <div className="space-y-1.5">{workspace.recommendations.slice(0, 8).map((recommendation) => <RecommendationCard key={recommendation.id} recommendation={recommendation} dossier={dossiers.find((candidate) => candidate.id === recommendation.dossierId)} onOpen={onOpenDossier} />)}</div>}</div><div className="space-y-4">{workspace.departmentWorkload && <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600"><UsersRound size={14} /> Tình hình phòng</div><div className="space-y-1.5">{workspace.departmentWorkload.slice(0, 8).map((row) => <div key={row.username} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2"><span className="min-w-0 truncate text-[10px] font-bold text-slate-700">{row.name}</span><span className="shrink-0 text-[9px] text-slate-500">{row.dossierCount} hồ sơ {row.risk === 'HIGH' && <b className="text-rose-700">· Cao</b>}</span></div>)}</div></div>}<div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-600"><Sparkles size={14} /> Quick Actions</div><div className="mt-2 flex flex-wrap gap-1.5">{workspace.quickActions.map((action) => <button type="button" key={action.id} onClick={() => void send(action.query)} className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[9px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700">{action.label}</button>)}</div></div></div></section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-3 py-3"><div className="flex items-center gap-1.5 text-sm font-black text-slate-900"><Bot size={17} className="text-emerald-600" /> Hỏi AI Trợ lý</div><p className="mt-0.5 text-[10px] text-slate-500">AI chỉ sử dụng dữ liệu PCN bạn được phép xem; thao tác thay đổi dữ liệu luôn cần xác nhận.</p></div><div className="max-h-[420px] space-y-3 overflow-y-auto p-3">{chat.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-[11px] text-slate-500">Hãy hỏi về việc hôm nay, hồ sơ bị chậm, tài liệu còn thiếu hoặc bước tiếp theo.</div>}{chat.map((entry) => <div key={entry.id} className={entry.role === 'user' ? 'ml-auto max-w-[85%] rounded-xl bg-emerald-600 p-2.5 text-[11px] text-white' : 'max-w-[92%]'}>{entry.role === 'user' ? entry.text : <ResponseBlocks blocks={entry.blocks || []} asOf={workspace.asOf} onOpenRecord={(dossierId) => { const dossier = dossiers.find((candidate) => candidate.id === dossierId); if (dossier) onOpenDossier(dossier); }} onConfirmAction={confirmAction} onCancelAction={cancelAction} pendingActionId={pendingActionId} resolvedActions={resolvedActions} />}</div>)}{sending && <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400"><Loader2 className="animate-spin" size={13} /> Đang lấy công việc, kiểm tra deadline và hồ sơ liên quan...</div>}</div><form onSubmit={(event) => { event.preventDefault(); void send(); }} className="flex gap-2 border-t border-slate-100 p-3"><input value={message} onChange={(event) => setMessage(event.target.value)} disabled={sending} placeholder="Ví dụ: Hồ sơ nào của tôi đang bị chậm?" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] outline-none focus:border-emerald-400 disabled:bg-slate-50" /><button type="submit" disabled={sending || !message.trim()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={13} /> Gửi</button></form></section>
    </div></div>;
}
