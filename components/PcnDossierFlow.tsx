'use client';

import {
  CheckCircle2,
  ChevronRight,
  CircleDot,
  XCircle,
  ClipboardCheck,
  Clock3,
  FileText,
  Flag,
  GitBranch,
  GitFork,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useRef } from 'react';

import type { PcnDossierNodeWorkProjection } from '../utils/pcnDossierNodeWork';
import type { PcnWorkflowRuntimeNode } from '../utils/pcnWorkflowRuntime';

export interface PcnDossierFlowProps {
  nodes: PcnWorkflowRuntimeNode[];
  projections: Record<string, PcnDossierNodeWorkProjection | undefined>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

type FlowType = 'FILE' | 'ACTION' | 'APPROVAL' | 'DECISION' | 'PARALLEL' | 'END';

type TypeMeta = {
  label: string;
  icon: LucideIcon;
  className: string;
};

type StatusMeta = {
  label: string;
  icon: LucideIcon;
  className: string;
};

const STATUS_LABELS: Record<PcnWorkflowRuntimeNode['status'], string> = {
  LOCKED: 'Chưa mở',
  READY: 'Sẵn sàng',
  IN_PROGRESS: 'Đang xử lý',
  WAITING: 'Đang chờ',
  RETURNED: 'Cần xử lý lại',
  COMPLETED: 'Đã hoàn tất',
  SKIPPED: 'Đã bỏ qua',
  STALE: 'Cần cập nhật',
  CANCELLED: 'Đã hủy',
};

const TYPE_META: Record<FlowType, TypeMeta> = {
  FILE: { label: 'Tài liệu', icon: FileText, className: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  ACTION: { label: 'Thao tác', icon: ClipboardCheck, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  APPROVAL: { label: 'Phê duyệt', icon: ShieldCheck, className: 'border-violet-200 bg-violet-50 text-violet-700' },
  DECISION: { label: 'Quyết định', icon: GitBranch, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  PARALLEL: { label: 'Song song', icon: GitFork, className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  END: { label: 'Kết thúc', icon: Flag, className: 'border-slate-200 bg-slate-100 text-slate-700' },
};

const STATUS_META: Record<PcnWorkflowRuntimeNode['status'], StatusMeta> = {
  LOCKED: { label: STATUS_LABELS.LOCKED, icon: LockKeyhole, className: 'text-slate-500' },
  READY: { label: STATUS_LABELS.READY, icon: CircleDot, className: 'text-blue-700' },
  IN_PROGRESS: { label: STATUS_LABELS.IN_PROGRESS, icon: PlayCircle, className: 'text-emerald-700' },
  WAITING: { label: STATUS_LABELS.WAITING, icon: Clock3, className: 'text-amber-700' },
  RETURNED: { label: STATUS_LABELS.RETURNED, icon: RotateCcw, className: 'text-rose-700' },
  COMPLETED: { label: STATUS_LABELS.COMPLETED, icon: CheckCircle2, className: 'text-emerald-700' },
  SKIPPED: { label: STATUS_LABELS.SKIPPED, icon: CheckCircle2, className: 'text-slate-600' },
  STALE: { label: STATUS_LABELS.STALE, icon: AlertTriangle, className: 'text-violet-700' },
  CANCELLED: { label: STATUS_LABELS.CANCELLED, icon: XCircle, className: 'text-rose-700' },
};

function flowType(node: PcnWorkflowRuntimeNode, projection: PcnDossierNodeWorkProjection | undefined): FlowType {
  if (node.kind === 'DOCUMENT_TASK') return projection?.documents.length ? 'FILE' : 'ACTION';
  if (node.kind === 'APPROVAL_TASK') return 'APPROVAL';
  if (node.kind === 'DECISION') return 'DECISION';
  if (node.kind === 'PARALLEL_SPLIT' || node.kind === 'PARALLEL_JOIN') return 'PARALLEL';
  return 'END';
}

function isSelectable(node: PcnWorkflowRuntimeNode): boolean {
  return node.isActive || node.status === 'COMPLETED';
}

function resolvedCount(projection: PcnDossierNodeWorkProjection | undefined): string {
  if (!projection || projection.documents.length === 0) return 'Không có tài liệu';
  const resolved = projection.documents.filter((item) => item.status === 'PRESENT' || item.status === 'WAIVED').length;
  return `${resolved}/${projection.documents.length} mục`;
}

export function PcnDossierFlow({ nodes, projections, selectedNodeId, onSelectNode }: PcnDossierFlowProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes.find(isSelectable) || nodes[0];
  const selectedProjection = selectedNode ? projections[selectedNode.id] : undefined;
  const selectableIndexes = useMemo(() => nodes.map((node, index) => isSelectable(node) ? index : -1).filter((index) => index >= 0), [nodes]);
  const currentIndex = nodes.findIndex((node) => ['IN_PROGRESS', 'RETURNED', 'READY', 'WAITING'].includes(node.status));
  const selectedIndex = selectedNode ? nodes.findIndex((node) => node.id === selectedNode.id) : -1;
  const currentStatus = currentIndex >= 0 ? STATUS_LABELS[nodes[currentIndex].status] : 'Chưa xác định';
  const resolvedSteps = nodes.filter((node) => node.status === 'COMPLETED' || node.status === 'SKIPPED').length;

  function focusRelative(index: number, direction: 1 | -1) {
    const position = selectableIndexes.indexOf(index);
    if (position < 0 || selectableIndexes.length === 0) return;
    const nextPosition = (position + direction + selectableIndexes.length) % selectableIndexes.length;
    const nextIndex = selectableIndexes[nextPosition];
    const nextNode = nodes[nextIndex];
    onSelectNode(nextNode.id);
    tabRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusRelative(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusRelative(index, -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const nextIndex = event.key === 'Home' ? selectableIndexes[0] : selectableIndexes[selectableIndexes.length - 1];
      const nextNode = nodes[nextIndex];
      if (nextNode) {
        onSelectNode(nextNode.id);
        tabRefs.current[nextIndex]?.focus();
      }
    }
  }

  return (
    <section className="min-w-0 space-y-3" data-testid="pcn-dossier-native-flow" aria-label="Tiến trình hồ sơ PCN">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">PCN · Tiến trình hồ sơ</p>
          <h2 className="mt-1 text-base font-black text-slate-950">Xử lý từng việc theo đúng thứ tự</h2>
        </div>
        <p className="text-sm text-slate-600" aria-live="polite">Đang ở bước {currentIndex >= 0 ? currentIndex + 1 : '—'}/{nodes.length} · {resolvedSteps}/{nodes.length} bước đã xong · {currentStatus}</p>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-200" style={{ width: `${nodes.length ? Math.round((resolvedSteps / nodes.length) * 100) : 0}%` }} />
      </div>

      <div className="mobile-scroll-x min-w-0 overflow-x-auto pb-1" data-testid="pcn-dossier-flow-scroll">
        <div className="flex min-w-max items-stretch gap-2" role="tablist" aria-label="Các bước xử lý hồ sơ">
          {nodes.map((node, index) => {
            const projection = projections[node.id];
            const type = flowType(node, projection);
            const typeMeta = TYPE_META[type];
            const status = STATUS_META[node.status];
            const StatusIcon = status.icon;
            const TypeIcon = typeMeta.icon;
            const disabled = !isSelectable(node);
            const selected = selectedNode?.id === node.id;

            return (
              <div className="flex items-center gap-2" key={node.id}>
                <button
                  ref={(element) => { tabRefs.current[index] = element; }}
                  type="button"
                  role="tab"
                  tabIndex={selected ? 0 : -1}
                  aria-selected={selected}
                  aria-current={node.status === 'IN_PROGRESS' || node.status === 'RETURNED' ? 'step' : undefined}
                  aria-controls={`pcn-node-panel-${node.id}`}
                  aria-describedby={`pcn-step-status-${node.id}`}
                  aria-posinset={index + 1}
                  aria-setsize={nodes.length}
                  disabled={disabled}
                  onClick={() => onSelectNode(node.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`mobile-touch-target group flex min-h-[106px] w-[218px] flex-col justify-between rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${disabled ? 'cursor-not-allowed border-slate-200 bg-slate-100/80 text-slate-400 opacity-70' : selected ? 'border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'}`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${typeMeta.className}`}>{String(index + 1).padStart(2, '0')}</span>
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-bold tracking-wide ${typeMeta.className}`}><TypeIcon size={13} aria-hidden="true" />{typeMeta.label}</span>
                  </span>
                  <span className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900">{node.label}</span>
                  <span className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-500">{resolvedCount(projection)}</span>
                    <span id={`pcn-step-status-${node.id}`} className={`inline-flex shrink-0 items-center gap-1 font-medium ${status.className}`}><StatusIcon size={14} aria-hidden="true" />{status.label}</span>
                  </span>
                </button>
                {index < nodes.length - 1 ? <ChevronRight className="shrink-0 text-slate-300" size={18} aria-hidden="true" /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" aria-label="Chú giải loại bước">
        {(['FILE', 'ACTION', 'APPROVAL', 'DECISION', 'PARALLEL', 'END'] as FlowType[]).map((type) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          return <span key={type} className="inline-flex items-center gap-1.5"><span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ${meta.className}`}><Icon size={12} aria-hidden="true" />{meta.label}</span></span>;
        })}
      </div>

      {selectedNode ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-slate-700" data-testid="pcn-dossier-flow-context">
          <span className="font-semibold text-slate-950">Bước {selectedIndex + 1}: {selectedNode.label}</span>
          {selectedProjection?.blockedReason ? <span className="ml-2 text-amber-800">· Cần xử lý điều kiện của bước</span> : null}
          {selectedProjection?.suggestions.length ? <span className="ml-2 text-slate-600">· {selectedProjection.suggestions[0]}</span> : null}
        </div>
      ) : null}
    </section>
  );
}

export default PcnDossierFlow;
