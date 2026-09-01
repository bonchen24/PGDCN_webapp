'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  CircleDot,
  Clock3,
  GitBranch,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

import type { PcnPipelineStationKey } from '../utils/pcnDossierPipeline';
import type {
  PcnDossierWorkflowMapProjection,
  PcnWorkflowNode,
  PcnWorkflowOverviewProjection,
} from '../utils/pcnWorkflowMap';
import { getPcnDossierStatusLabel } from '../utils/pcnWorkflow';

export type PcnWorkflowMapMode = 'overview' | 'dossier';

export interface PcnWorkflowMapProps {
  projection: PcnWorkflowOverviewProjection | PcnDossierWorkflowMapProjection;
  mode: PcnWorkflowMapMode;
  selectedNodeKey?: PcnPipelineStationKey;
  onSelectNode?: (nodeKey: PcnPipelineStationKey) => void;
  className?: string;
}

function joinClasses(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function isDossierProjection(
  projection: PcnWorkflowMapProps['projection'],
  mode: PcnWorkflowMapMode,
): projection is PcnDossierWorkflowMapProjection {
  return mode === 'dossier';
}

function stateClasses(node: PcnWorkflowNode): string {
  if (node.state === 'EXCEPTION') return 'border-rose-300 bg-rose-50 text-rose-900';
  if (node.state === 'CURRENT') return 'border-indigo-300 bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-200';
  if (node.state === 'COMPLETED') return 'border-emerald-200 bg-emerald-50/70 text-emerald-900';
  return 'border-slate-200 bg-white text-slate-600';
}

function iconClasses(node: PcnWorkflowNode): string {
  if (node.state === 'EXCEPTION') return 'bg-rose-600 text-white';
  if (node.state === 'CURRENT') return 'bg-indigo-600 text-white';
  if (node.state === 'COMPLETED') return 'bg-emerald-600 text-white';
  return 'bg-slate-100 text-slate-400';
}

function NodeIcon({ node }: { node: PcnWorkflowNode }) {
  if (node.blocked) return <Ban size={15} aria-hidden="true" />;
  if (node.returned) return <RotateCcw size={15} aria-hidden="true" />;
  if (node.state === 'COMPLETED') return <CheckCircle2 size={15} aria-hidden="true" />;
  if (node.state === 'EXCEPTION') return <ShieldAlert size={15} aria-hidden="true" />;
  if (node.state === 'CURRENT') return <CircleDot size={15} aria-hidden="true" />;
  return <CircleDot size={15} aria-hidden="true" />;
}

function NodeStatus({ node, mode }: { node: PcnWorkflowNode; mode: PcnWorkflowMapMode }) {
  if (node.overdueCount > 0) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[8px] font-black text-rose-700"><Clock3 size={10} /> {mode === 'overview' ? `${node.overdueCount} quá hạn` : 'Quá hạn'}</span>;
  }
  if (node.blocked) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-black text-amber-700"><Ban size={10} /> Bị chặn</span>;
  }
  if (node.returned) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[8px] font-black text-orange-700"><RotateCcw size={10} /> Đã trả về</span>;
  }
  if (node.state === 'COMPLETED') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white/80 px-1.5 py-0.5 text-[8px] font-black text-emerald-700"><CheckCircle2 size={10} /> Hoàn tất</span>;
  }
  if (node.state === 'EXCEPTION') {
    return <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white/80 px-1.5 py-0.5 text-[8px] font-black text-rose-700"><ShieldAlert size={10} /> Ngoại lệ</span>;
  }
  if (mode === 'overview' && node.count > 0) {
    return <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-white/80 px-1.5 py-0.5 text-[8px] font-black text-indigo-700">{node.count} hồ sơ</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-1.5 py-0.5 text-[8px] font-black text-slate-500">Sắp tới</span>;
}

function WorkflowNodeButton({ node, mode, selected, current, onSelectNode }: {
  node: PcnWorkflowNode;
  mode: PcnWorkflowMapMode;
  selected: boolean;
  current: boolean;
  onSelectNode?: (nodeKey: PcnPipelineStationKey) => void;
}) {
  const statusLabel = node.currentStatus ? getPcnDossierStatusLabel(node.currentStatus) : undefined;
  const nodeDescription = [
    node.title,
    statusLabel,
    mode === 'overview' ? `${node.count} hồ sơ` : current ? 'Bước hiện tại' : undefined,
    node.overdueCount > 0 ? 'quá hạn' : undefined,
    node.blocked ? 'bị chặn' : undefined,
    node.returned ? 'đã trả về' : undefined,
  ].filter(Boolean).join(', ');
  return (
    <button
      type="button"
      onClick={() => onSelectNode?.(node.key)}
      aria-label={`Mở bước ${nodeDescription}`}
      aria-current={current ? 'step' : undefined}
      aria-pressed={selected}
      className={joinClasses(
        'group flex min-h-11 min-w-[154px] max-w-[188px] flex-1 flex-col rounded-xl border p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1',
        stateClasses(node),
        selected && 'ring-2 ring-indigo-500 ring-offset-1',
      )}
    >
      <div className="flex items-start gap-2">
        <span className={joinClasses('relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', iconClasses(node), current && 'motion-safe:animate-pulse')}>
          {node.number ? <span className="absolute -right-1 -top-1 rounded-full bg-white px-1 text-[8px] font-black text-slate-500 shadow-sm">{node.number}</span> : null}
          <NodeIcon node={node} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block line-clamp-2 text-[10px] font-black leading-4">{node.title}</span>
          {statusLabel && <span className="mt-0.5 block truncate text-[8px] font-bold text-indigo-700">{statusLabel}</span>}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <NodeStatus node={node} mode={mode} />
        {node.missingDocumentCount > 0 && <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-black text-amber-700"><AlertTriangle size={10} /> {node.missingDocumentCount} thiếu</span>}
      </div>
    </button>
  );
}

export function PcnWorkflowMap({ projection, mode, selectedNodeKey, onSelectNode, className }: PcnWorkflowMapProps) {
  const mainNodes = projection.nodes.filter((node) => node.key !== 'EXCEPTIONS');
  const exceptionNode = projection.nodes.find((node) => node.key === 'EXCEPTIONS');
  const currentNodeKey = isDossierProjection(projection, mode) ? projection.currentNodeKey : undefined;
  const activeNodeKey = selectedNodeKey || currentNodeKey;

  return (
    <section className={joinClasses('rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 md:p-3', className)} data-testid="pcn-graphic-workflow" aria-label="Bản đồ quy trình hồ sơ PCN">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700"><GitBranch size={16} aria-hidden="true" /></span>
          <div>
            <h2 className="text-xs font-black text-slate-900">Bản đồ quy trình</h2>
            <p className="mt-0.5 text-[9px] leading-4 text-slate-500">{mode === 'overview' ? `${projection.totalDossierCount} hồ sơ trong phạm vi đang xem` : 'Bấm một bước để mở đúng vùng dữ liệu của hồ sơ'}</p>
          </div>
        </div>
        {projection.hasReturned && <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[9px] font-black text-orange-700"><RotateCcw size={11} /> Có luồng trả về/khắc phục</span>}
      </div>

      <div className="mt-3 mobile-scroll-x overflow-x-auto pb-1" role="list" aria-label="Các bước quy trình chính">
        <div className="flex min-w-max items-stretch gap-1.5">
          {mainNodes.map((node, index) => (
            <React.Fragment key={node.key}>
              <div className="flex min-w-[154px] max-w-[188px] flex-1" role="listitem">
                <WorkflowNodeButton node={node} mode={mode} selected={activeNodeKey === node.key} current={currentNodeKey === node.key} onSelectNode={onSelectNode} />
              </div>
              {index < mainNodes.length - 1 && <span className="flex shrink-0 items-center self-center text-slate-300" aria-hidden="true"><ArrowRight size={14} /></span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {exceptionNode && <div className="mt-2 border-t border-dashed border-rose-200 pt-2" data-testid="pcn-workflow-exception-branch">
        <div className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wide text-rose-700"><GitBranch size={11} /> Nhánh ngoại lệ</div>
        <div className="max-w-[250px]">
          <WorkflowNodeButton node={exceptionNode} mode={mode} selected={activeNodeKey === exceptionNode.key} current={currentNodeKey === exceptionNode.key} onSelectNode={onSelectNode} />
        </div>
      </div>}
    </section>
  );
}

export default PcnWorkflowMap;

// --- End of PcnWorkflowMap.tsx ---
