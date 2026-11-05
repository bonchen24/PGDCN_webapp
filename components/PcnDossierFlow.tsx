'use client';

import {
  AlertTriangle,
  CheckCircle2,
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

export function PcnDossierFlow({ nodes, selectedNodeId, onSelectNode }: PcnDossierFlowProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || nodes.find(isSelectable) || nodes[0];

  const stagesWithNodes = useMemo(() => PCN_DOSSIER_FLOW_STAGES.map((stage) => {
    const matchedNodes = nodes.filter((node) => getPcnStageForNode(node) === stage.id);
    const status = stageStatus(matchedNodes);
    return {
      ...stage,
      nodes: matchedNodes,
      status,
      isSelectable: matchedNodes.length > 0 && (matchedNodes.some(isSelectable) || status !== 'LOCKED'),
    };
  }), [nodes]);

  const activeStageIndex = useMemo(() => {
    const index = stagesWithNodes.findIndex((stage) => ['IN_PROGRESS', 'RETURNED', 'READY', 'WAITING'].includes(stage.status));
    return index >= 0 ? index : stagesWithNodes.length - 1;
  }, [stagesWithNodes]);
  const selectedStageId = selectedNode ? getPcnStageForNode(selectedNode) : stagesWithNodes[activeStageIndex]?.id;
  const selectedStageIndex = stagesWithNodes.findIndex((stage) => stage.id === selectedStageId);
  const selectedStage = stagesWithNodes[selectedStageIndex >= 0 ? selectedStageIndex : 0];
  const selectableStageIndexes = useMemo(
    () => stagesWithNodes.map((stage, index) => stage.isSelectable ? index : -1).filter((index) => index >= 0),
    [stagesWithNodes],
  );

  const selectStage = (stageIndex: number) => {
    const stage = stagesWithNodes[stageIndex];
    if (!stage?.isSelectable) return;
    const node = stage.nodes.find((candidate) => candidate.isActive || ['IN_PROGRESS', 'RETURNED', 'READY'].includes(candidate.status))
      || stage.nodes.find(isSelectable)
      || stage.nodes[0];
    if (node) onSelectNode(node.id);
  };

  function focusRelative(index: number, direction: 1 | -1) {
    const position = selectableStageIndexes.indexOf(index);
    if (position < 0 || selectableStageIndexes.length === 0) return;
    const nextIndex = selectableStageIndexes[(position + direction + selectableStageIndexes.length) % selectableStageIndexes.length];
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
    <div className="min-w-0 space-y-2" data-testid="pcn-dossier-native-flow">
      <div className="grid grid-cols-7 gap-1" data-testid="pcn-dossier-flow-scroll" role="tablist" aria-label="Các bước xử lý hồ sơ">
        {stagesWithNodes.map((stage, index) => {
          const isSelected = selectedStage?.id === stage.id;
          const disabled = !stage.isSelectable;
          const stageNumber = String(index + 1).padStart(2, '0');
          return (
            <button
              ref={(element) => { tabRefs.current[index] = element; }}
              key={stage.id}
              id={`pcn-dossier-stage-tab-${stage.id}`}
              data-testid="pcn-stage-tab"
              type="button"
              role="tab"
              tabIndex={isSelected ? 0 : -1}
              aria-label={`${stageNumber} · ${stage.label} · ${STATUS_LABELS[stage.status]}`}
              aria-selected={isSelected}
              aria-current={stage.status === 'IN_PROGRESS' || stage.status === 'RETURNED' ? 'step' : undefined}
              aria-controls={`pcn-stage-panel-${stage.id}`}
              aria-posinset={index + 1}
              aria-setsize={PCN_DOSSIER_FLOW_STAGES.length}
              disabled={disabled}
              title={stage.label}
              onClick={() => selectStage(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`mobile-touch-target flex min-h-10 min-w-0 items-center justify-center rounded-md border px-1 text-[11px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
                disabled
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-70'
                  : isSelected
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                    : stage.status === 'COMPLETED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              {stageNumber}
            </button>
          );
        })}
      </div>

      {selectedStage ? (
        <div
          id={`pcn-stage-panel-${selectedStage.id}`}
          role="tabpanel"
          aria-labelledby={`pcn-dossier-stage-tab-${selectedStage.id}`}
          className="min-w-0"
        >
          {selectedStage.nodes.length > 1 ? (
            <div className="flex min-w-0 flex-wrap gap-1.5" role="group" aria-label={`Công việc thuộc giai đoạn ${selectedStage.label}`}>
              {selectedStage.nodes.map((node, index) => {
                const isNodeSelected = selectedNode?.id === node.id;
                const nodeDisabled = !isSelectable(node);
                return (
                  <button
                    key={node.id}
                    type="button"
                    disabled={nodeDisabled}
                    onClick={() => onSelectNode(node.id)}
                    aria-pressed={isNodeSelected}
                    aria-label={`${node.label} · ${STATUS_LABELS[node.status]}`}
                    title={node.label}
                    className={`mobile-touch-target inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      nodeDisabled
                        ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                        : isNodeSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-slate-50'
                    }`}
                  >
                    <span aria-hidden="true" className="shrink-0 font-mono text-[10px] text-slate-500">{index + 1}</span>
                    <span className="truncate">{node.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default PcnDossierFlow;
