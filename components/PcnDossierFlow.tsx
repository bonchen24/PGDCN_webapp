'use client';

import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
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
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import React, { useMemo, useRef, useState, useEffect } from 'react';

import type { PcnDossierNodeWorkProjection } from '../utils/pcnDossierNodeWork';
import type { PcnWorkflowRuntimeNode } from '../utils/pcnWorkflowRuntime';

export interface PcnDossierFlowProps {
  nodes: PcnWorkflowRuntimeNode[];
  projections: Record<string, PcnDossierNodeWorkProjection | undefined>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export type FlowType = 'FILE' | 'ACTION' | 'APPROVAL' | 'DECISION' | 'PARALLEL' | 'END';

export type TypeMeta = {
  label: string;
  icon: LucideIcon;
  className: string;
};

export type StatusMeta = {
  label: string;
  icon: LucideIcon;
  className: string;
};

export const STATUS_LABELS: Record<PcnWorkflowRuntimeNode['status'], string> = {
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

export const TYPE_META: Record<FlowType, TypeMeta> = {
  FILE: { label: 'Tài liệu', icon: FileText, className: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  ACTION: { label: 'Thao tác', icon: ClipboardCheck, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  APPROVAL: { label: 'Phê duyệt', icon: ShieldCheck, className: 'border-violet-200 bg-violet-50 text-violet-700' },
  DECISION: { label: 'Quyết định', icon: GitBranch, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  PARALLEL: { label: 'Song song', icon: GitFork, className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  END: { label: 'Kết thúc', icon: Flag, className: 'border-slate-200 bg-slate-100 text-slate-700' },
};

export const STATUS_META: Record<PcnWorkflowRuntimeNode['status'], StatusMeta> = {
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

export function flowType(node: PcnWorkflowRuntimeNode, projection: PcnDossierNodeWorkProjection | undefined): FlowType {
  if (node.kind === 'DOCUMENT_TASK') return projection?.documents.length ? 'FILE' : 'ACTION';
  if (node.kind === 'APPROVAL_TASK') return 'APPROVAL';
  if (node.kind === 'DECISION') return 'DECISION';
  if (node.kind === 'PARALLEL_SPLIT' || node.kind === 'PARALLEL_JOIN') return 'PARALLEL';
  return 'END';
}

export function isSelectable(node: PcnWorkflowRuntimeNode): boolean {
  return node.isActive || node.status === 'COMPLETED';
}

function resolvedCount(projection: PcnDossierNodeWorkProjection | undefined): string {
  if (!projection || projection.documents.length === 0) return 'Không có tài liệu';
  const resolved = projection.documents.filter((item) => item.status === 'PRESENT' || item.status === 'WAIVED').length;
  return `${resolved}/${projection.documents.length} mục`;
}

/**
 * 7 giai đoạn chuẩn hóa thống nhất toàn bộ quy trình hồ sơ chứng nhận PCN:
 * 1. intake: Tiếp nhận hồ sơ (Đề nghị, hợp đồng thương mại)
 * 2. review-assignment: Xem xét & phân công (Phân công chuyên gia chứng nhận)
 * 3. plan: Lập kế hoạch (Kế hoạch đánh giá chứng nhận)
 * 4. execution: Thực hiện đánh giá & lấy mẫu (Hiện trường, PYC, mã hóa, giao mẫu)
 * 5. results-evaluation: Xử lý & đánh giá kết quả (Tiếp nhận KQTN, rà soát kết quả)
 * 6. reporting-approval: Báo cáo & phê duyệt (Dự thảo chứng thư, quyết định, phê duyệt)
 * 7. issuance-archive: Phát hành & lưu trữ (Giao khách hàng, lưu trữ hồ sơ)
 */
export type PcnDossierFlowStageId =
  | 'intake'
  | 'review-assignment'
  | 'plan'
  | 'execution'
  | 'results-evaluation'
  | 'reporting-approval'
  | 'issuance-archive';

export interface PcnStageDefinition {
  id: PcnDossierFlowStageId;
  label: string;
  description: string;
  defaultType: FlowType;
  nodeIds: readonly string[];
}

export const PCN_DOSSIER_FLOW_STAGES: readonly PcnStageDefinition[] = [
  {
    id: 'intake',
    label: 'Tiếp nhận hồ sơ',
    description: 'Tiếp nhận Đề nghị chứng nhận và hồ sơ thương mại/hợp đồng.',
    defaultType: 'FILE',
    nodeIds: ['proposal', 'commercial', 'intake', 'documents'],
  },
  {
    id: 'review-assignment',
    label: 'Xem xét & Phân công',
    description: 'Kiểm tra năng lực và phân công chuyên gia chứng nhận.',
    defaultType: 'APPROVAL',
    nodeIds: ['assignment'],
  },
  {
    id: 'plan',
    label: 'Lập kế hoạch',
    description: 'Lập kế hoạch đánh giá chứng nhận sản phẩm.',
    defaultType: 'FILE',
    nodeIds: ['evaluation-plan', 'evaluation'],
  },
  {
    id: 'execution',
    label: 'Thực hiện đánh giá & lấy mẫu',
    description: 'Kiểm tra hiện trường, lập PYC PTN, mã hóa niêm phong và bàn giao mẫu.',
    defaultType: 'ACTION',
    nodeIds: ['field-inspection', 'pyc', 'sample-coding', 'sample-handover', 'sample-return', 'split', 'sampling', 'sampling_lab'],
  },
  {
    id: 'results-evaluation',
    label: 'Xử lý & Đánh giá kết quả',
    description: 'Tiếp nhận kết quả thử nghiệm từ PTN và hoàn thiện kết quả đánh giá.',
    defaultType: 'APPROVAL',
    nodeIds: ['receive-test-result', 'complete-result', 'review', 'join', 'results', 'technical_review'],
  },
  {
    id: 'reporting-approval',
    label: 'Báo cáo & Phê duyệt',
    description: 'Dự thảo chứng thư, quyết định và phê duyệt lãnh đạo.',
    defaultType: 'APPROVAL',
    nodeIds: ['certificate', 'decision', 'approval'],
  },
  {
    id: 'issuance-archive',
    label: 'Phát hành & Lưu trữ',
    description: 'Bàn giao hồ sơ cho khách hàng và hoàn tất lưu trữ.',
    defaultType: 'END',
    nodeIds: ['deliver', 'archive', 'delivery', 'delivery_archive'],
  },
] as const;

export function getPcnStageForNode(node: PcnWorkflowRuntimeNode): PcnDossierFlowStageId {
  const normId = node.id.toLowerCase();
  for (const stage of PCN_DOSSIER_FLOW_STAGES) {
    if (stage.nodeIds.includes(normId)) return stage.id;
  }
  const actionKey = node.actionKey?.toUpperCase();
  if (normId.includes('propos') || normId.includes('commerc') || actionKey === 'INTAKE') return 'intake';
  if (normId.includes('assign') || actionKey === 'ASSIGNMENT') return 'review-assignment';
  if (normId.includes('plan') || (normId.includes('evaluat') && !normId.includes('field'))) return 'plan';
  if (normId.includes('field') || normId.includes('pyc') || normId.includes('sample') || actionKey === 'SAMPLING_LAB' || actionKey === 'SAMPLE_CODING' || actionKey === 'SAMPLE_HANDOVER') return 'execution';
  if (normId.includes('result') || normId.includes('test') || actionKey === 'TEST_REPORT' || actionKey === 'TECHNICAL_REVIEW') return 'results-evaluation';
  if (normId.includes('cert') || normId.includes('decis') || normId.includes('approv') || actionKey === 'APPROVAL') return 'reporting-approval';
  if (normId.includes('deliv') || normId.includes('arch') || actionKey === 'DELIVERY' || actionKey === 'ARCHIVE' || actionKey === 'DELIVERY_ARCHIVE' || node.kind === 'END') return 'issuance-archive';
  return 'intake';
}

function stageStatus(stageNodes: PcnWorkflowRuntimeNode[]): PcnWorkflowRuntimeNode['status'] {
  if (stageNodes.length === 0) return 'READY';
  if (stageNodes.every((n) => n.status === 'COMPLETED' || n.status === 'SKIPPED')) return 'COMPLETED';
  if (stageNodes.some((n) => n.status === 'IN_PROGRESS')) return 'IN_PROGRESS';
  if (stageNodes.some((n) => n.status === 'RETURNED')) return 'RETURNED';
  if (stageNodes.some((n) => n.status === 'WAITING')) return 'WAITING';
  if (stageNodes.some((n) => n.status === 'READY')) return 'READY';
  if (stageNodes.some((n) => n.isActive)) return 'IN_PROGRESS';
  return 'LOCKED';
}

export function PcnDossierFlow({ nodes, projections, selectedNodeId, onSelectNode }: PcnDossierFlowProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes.find(isSelectable) || nodes[0];
  const selectedProjection = selectedNode ? projections[selectedNode.id] : undefined;

  // Group nodes by 7 canonical stages
  const stagesWithNodes = useMemo(() => {
    return PCN_DOSSIER_FLOW_STAGES.map((stage) => {
      const matchedNodes = nodes.filter((node) => getPcnStageForNode(node) === stage.id);
      const status = stageStatus(matchedNodes);
      return {
        ...stage,
        nodes: matchedNodes,
        status,
        isSelectable: matchedNodes.some(isSelectable) || status !== 'LOCKED',
      };
    });
  }, [nodes]);

  // Determine current active stage (1 to 7)
  const activeStageIndex = useMemo(() => {
    const idx = stagesWithNodes.findIndex((s) => ['IN_PROGRESS', 'RETURNED', 'READY', 'WAITING'].includes(s.status));
    return idx >= 0 ? idx : stagesWithNodes.length - 1;
  }, [stagesWithNodes]);

  // Determine stage of the currently selected node
  const selectedStageId = selectedNode ? getPcnStageForNode(selectedNode) : stagesWithNodes[activeStageIndex]?.id;
  const selectedStageIndex = stagesWithNodes.findIndex((s) => s.id === selectedStageId);
  const selectedStage = stagesWithNodes[selectedStageIndex >= 0 ? selectedStageIndex : 0];

  const currentStatusLabel = STATUS_LABELS[stagesWithNodes[activeStageIndex]?.status] || 'Sẵn sàng';
  const resolvedStages = stagesWithNodes.filter((s) => s.status === 'COMPLETED').length;
  const selectableStageIndexes = useMemo(() => stagesWithNodes.map((s, idx) => s.isSelectable ? idx : -1).filter((idx) => idx >= 0), [stagesWithNodes]);

  const selectStage = (stageIdx: number) => {
    const stage = stagesWithNodes[stageIdx];
    if (!stage || !stage.isSelectable) return;
    if (stage.nodes.length > 0) {
      const activeInStage = stage.nodes.find((n) => n.isActive || ['IN_PROGRESS', 'RETURNED', 'READY'].includes(n.status))
        || stage.nodes.find(isSelectable)
        || stage.nodes[0];
      if (activeInStage) {
        onSelectNode(activeInStage.id);
      }
    }
  };

  function focusRelative(index: number, direction: 1 | -1) {
    const position = selectableStageIndexes.indexOf(index);
    if (position < 0 || selectableStageIndexes.length === 0) return;
    const nextPosition = (position + direction + selectableStageIndexes.length) % selectableStageIndexes.length;
    const nextIndex = selectableStageIndexes[nextPosition];
    selectStage(nextIndex);
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
      const nextIndex = event.key === 'Home' ? selectableStageIndexes[0] : selectableStageIndexes[selectableStageIndexes.length - 1];
      if (nextIndex !== undefined) {
        selectStage(nextIndex);
        tabRefs.current[nextIndex]?.focus();
      }
    }
  }

  return (
    <section className="min-w-0 space-y-3" data-testid="pcn-dossier-native-flow" aria-label="Tiến trình hồ sơ PCN">
      {/* 7-Stage Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-600">PCN · Tiến trình hồ sơ</p>
          <h2 className="mt-1 text-base font-black text-slate-950">Quy trình hồ sơ chứng nhận chuẩn hóa (7 giai đoạn)</h2>
        </div>
        <p className="text-sm text-slate-600" aria-live="polite">
          Đang ở giai đoạn {activeStageIndex + 1}/{PCN_DOSSIER_FLOW_STAGES.length} · {resolvedStages}/{PCN_DOSSIER_FLOW_STAGES.length} giai đoạn đã xong · {currentStatusLabel}
        </p>
      </div>

      {/* Progress Bar for 7 Stages */}
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div
          className="h-full rounded-full bg-emerald-600 transition-[width] duration-200"
          style={{ width: `${Math.round((resolvedStages / PCN_DOSSIER_FLOW_STAGES.length) * 100)}%` }}
        />
      </div>

      {/* Exactly 7 Stage Rail */}
      <div className="mobile-scroll-x min-w-0 overflow-x-auto pb-1" data-testid="pcn-dossier-flow-scroll">
        <div className="flex min-w-max items-stretch gap-2" role="tablist" aria-label="Các bước xử lý hồ sơ">
          {stagesWithNodes.map((stage, index) => {
            const isSelected = selectedStage?.id === stage.id;
            const status = STATUS_META[stage.status];
            const StatusIcon = status.icon;
            const typeMeta = TYPE_META[stage.defaultType];
            const TypeIcon = typeMeta.icon;
            const disabled = !stage.isSelectable;
            const completedCount = stage.nodes.filter((n) => n.status === 'COMPLETED' || n.status === 'SKIPPED').length;
            const subTaskSummary = stage.nodes.length > 0 ? `${completedCount}/${stage.nodes.length} việc` : 'Không có việc';

            return (
              <div className="flex items-center gap-2" key={stage.id}>
                <button
                  ref={(element) => { tabRefs.current[index] = element; }}
                  id={`pcn-dossier-stage-tab-${stage.id}`}
                  type="button"
                  role="tab"
                  tabIndex={isSelected ? 0 : -1}
                  aria-selected={isSelected}
                  aria-current={stage.status === 'IN_PROGRESS' || stage.status === 'RETURNED' ? 'step' : undefined}
                  aria-controls={`pcn-stage-panel-${stage.id}`}
                  aria-describedby={`pcn-stage-status-${stage.id}`}
                  aria-posinset={index + 1}
                  aria-setsize={PCN_DOSSIER_FLOW_STAGES.length}
                  disabled={disabled}
                  onClick={() => selectStage(index)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={`mobile-touch-target group flex min-h-[106px] w-[218px] flex-col justify-between rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                    disabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100/80 text-slate-400 opacity-70'
                      : isSelected
                      ? 'border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-100'
                      : stage.status === 'COMPLETED'
                      ? 'border-emerald-200 bg-emerald-50/40 text-emerald-800'
                      : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'
                  }`}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : stage.status === 'COMPLETED'
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : typeMeta.className
                      }`}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-bold tracking-wide ${typeMeta.className}`}>
                      <TypeIcon size={13} aria-hidden="true" />
                      {typeMeta.label}
                    </span>
                  </span>
                  <span className="mt-2 line-clamp-2 text-sm font-bold text-slate-900">{stage.label}</span>
                  <span className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-500">{subTaskSummary}</span>
                    <span id={`pcn-stage-status-${stage.id}`} className={`inline-flex shrink-0 items-center gap-1 font-medium ${status.className}`}>
                      <StatusIcon size={14} aria-hidden="true" />
                      {status.label}
                    </span>
                  </span>
                </button>
                {index < PCN_DOSSIER_FLOW_STAGES.length - 1 ? (
                  <ChevronRight className="shrink-0 text-slate-300" size={18} aria-hidden="true" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sub-Task Bar: Work items inside the selected stage */}
      {selectedStage && selectedStage.nodes.length > 0 ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2" data-testid="pcn-stage-subtasks">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black text-emerald-950 uppercase tracking-wide">
              Công việc trong giai đoạn {selectedStageIndex + 1}: {selectedStage.label} ({selectedStage.nodes.length} việc)
            </p>
            <p className="text-[11px] text-slate-500">{selectedStage.description}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Công việc thuộc giai đoạn ${selectedStage.label}`}>
            {selectedStage.nodes.map((node, nodeIdx) => {
              const nodeProjection = projections[node.id];
              const nodeFlowType = flowType(node, nodeProjection);
              const nodeTypeMeta = TYPE_META[nodeFlowType];
              const nodeStatusMeta = STATUS_META[node.status];
              const NodeStatusIcon = nodeStatusMeta.icon;
              const isNodeSelected = selectedNode?.id === node.id;
              const nodeDisabled = !isSelectable(node);

              return (
                <button
                  key={node.id}
                  type="button"
                  disabled={nodeDisabled}
                  onClick={() => onSelectNode(node.id)}
                  aria-pressed={isNodeSelected}
                  className={`mobile-touch-target inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    nodeDisabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                      : isNodeSelected
                      ? 'border-emerald-600 bg-white text-emerald-900 shadow-sm ring-2 ring-emerald-500/20'
                      : node.status === 'COMPLETED'
                      ? 'border-emerald-200 bg-white text-emerald-800 hover:border-emerald-300'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-black bg-slate-100 text-slate-600">
                    {nodeIdx + 1}
                  </span>
                  <span className="truncate max-w-[180px]">{node.label}</span>
                  <span className={`inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium ${nodeStatusMeta.className}`}>
                    <NodeStatusIcon size={12} aria-hidden="true" />
                    {nodeStatusMeta.label}
                  </span>
                  <span className="text-[10px] text-slate-400">· {resolvedCount(nodeProjection)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Legend for Flow Types */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600" aria-label="Chú giải loại bước">
        {(['FILE', 'ACTION', 'APPROVAL', 'DECISION', 'PARALLEL', 'END'] as FlowType[]).map((type) => {
          const meta = TYPE_META[type];
          const Icon = meta.icon;
          return (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold ${meta.className}`}>
                <Icon size={12} aria-hidden="true" />
                {meta.label}
              </span>
            </span>
          );
        })}
      </div>

      {/* Selected Node / Context Summary */}
      {selectedNode ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-sm text-slate-700" data-testid="pcn-dossier-flow-context">
          <span className="font-semibold text-slate-950">
            Giai đoạn {selectedStageIndex + 1} · Việc: {selectedNode.label}
          </span>
          {selectedProjection?.blockedReason ? <span className="ml-2 text-amber-800">· Cần xử lý điều kiện của bước</span> : null}
          {selectedProjection?.suggestions.length ? <span className="ml-2 text-slate-600">· {selectedProjection.suggestions[0]}</span> : null}
        </div>
      ) : null}
    </section>
  );
}

export default PcnDossierFlow;
