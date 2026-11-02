'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { CertificationDossier, IssuancePackage, OutboundLabRequest, PcnApprovalStep, PcnDossierDocument, PcnDossierDocumentWaiver, PcnDossierWorkflowTask, PcnDocumentRequirement, PcnDraftWorkspace, PcnSampleLot, PcnSampleRoute, PcnUserAccount, ReturnedTestResult } from '../types';
import { usePcnStore } from '../store-pcn';
import { buildPcnDossierNodeBusinessFacts, buildPcnDossierNodeWorkProjection, type PcnDossierNodeBusinessFact, type PcnDossierNodeDocumentItem, type PcnDossierNodeWorkProjection } from '../utils/pcnDossierNodeWork';
import { buildPcnWorkflowConditionContext, projectPcnWorkflowRuntime, type PcnWorkflowRuntimeNode } from '../utils/pcnWorkflowRuntime';
import { getPcnWorkflowForDossier } from '../utils/pcnWorkflowTemplate';
import PcnDossierFlow from './PcnDossierFlow';
import PcnDossierNodeWorkPanel from './PcnDossierNodeWorkPanel';

export interface PcnDossierWorkflowPanelProps {
  dossier: CertificationDossier;
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver | undefined>;
  results?: ReturnedTestResult[];
  approvalSteps?: PcnApprovalStep[];
  sampleLots?: PcnSampleLot[];
  sampleRoutes?: PcnSampleRoute[];
  labRequests?: OutboundLabRequest[];
  issuancePackages?: IssuancePackage[];
  draftWorkspaces?: PcnDraftWorkspace[];
  initialNodeId?: string;
  workflowTasks: PcnDossierWorkflowTask[];
  users?: PcnUserAccount[];
  currentUser?: import('../types').UserAccount;
  canEdit: boolean;
  onStartTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string, expectedCycleNo?: number) => Promise<void>;
  onReturnTask?: (taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
  onOpenDocuments?: (nodeId: string) => void;
  onUploadDocument?: (requirementId: string, file: File) => Promise<void>;
  onCreateFromForm?: (requirementId: string) => void;
  onOpenDrafting?: (item: PcnDossierNodeDocumentItem, nodeId: string) => string | undefined;
  onGenerateAndAttach?: (nodeId: string, requirementId: string) => Promise<void>;
  onConfirmDocument?: (requirementId: string) => Promise<void>;
  onRemoveCurrent?: (requirementId: string) => Promise<void>;
  onWaiveDocument?: (requirementId: string, reason: string) => Promise<void>;
  onClearDocumentWaiver?: (requirementId: string) => Promise<void>;
  onOpenBusiness?: (fact: PcnDossierNodeBusinessFact) => void;
}

const CURRENT_NODE_STATUS_LABELS: Record<PcnWorkflowRuntimeNode['status'], string> = {
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

export function PcnDossierWorkflowPanel({ dossier, requirements, documents, documentWaivers, results = [], approvalSteps = [], sampleLots = [], sampleRoutes = [], labRequests = [], issuancePackages = [], draftWorkspaces = [], workflowTasks, users: _users = [], currentUser, canEdit, onStartTask, onCompleteTask, onReturnTask, onOpenDocuments, onUploadDocument, onCreateFromForm, onOpenDrafting, onGenerateAndAttach, onConfirmDocument, onRemoveCurrent, onWaiveDocument, onClearDocumentWaiver, onOpenBusiness, initialNodeId }: PcnDossierWorkflowPanelProps) {
  const workflow = useMemo(() => getPcnWorkflowForDossier(dossier), [dossier]);
  const dossierTasks = useMemo(() => workflowTasks.filter((task) => task.dossierId === dossier.id), [dossier.id, workflowTasks]);
  const requiredRequirementIds = useMemo(() => {
    const activeRequirementIds = workflow.nodes
      .filter((node) => node.active !== false)
      .flatMap((node) => node.requirementIds);
    return Array.from(new Set(activeRequirementIds.filter((requirementId) => requirements.find((requirement) => requirement.id === requirementId)?.required !== false)));
  }, [requirements, workflow]);
  const conditionContext = useMemo(() => buildPcnWorkflowConditionContext({ workflow, requiredRequirementIds, documents, documentWaivers, results, approvalSteps, fieldCodes: dossier.fieldCodes, method: dossier.method }), [approvalSteps, dossier.fieldCodes, dossier.method, documentWaivers, documents, requiredRequirementIds, results, workflow]);
  const runtime = useMemo(() => projectPcnWorkflowRuntime({ workflow, tasks: dossierTasks, documents, documentWaivers, requiredRequirementIds, conditionContext }), [conditionContext, dossierTasks, documentWaivers, documents, requiredRequirementIds, workflow]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId || null);

  const projections = useMemo<Record<string, PcnDossierNodeWorkProjection | undefined>>(() => Object.fromEntries(runtime.nodes.map((node) => [node.id, buildPcnDossierNodeWorkProjection({
    node,
    runtimeNode: node,
    requirements,
    documents,
    documentWaivers,
    draftWorkspaces,
    businessFacts: buildPcnDossierNodeBusinessFacts({
      actionKey: node.actionKey,
      dossierId: dossier.id,
      dossierStatus: dossier.status,
      ownerUsername: dossier.ownerUsername,
      sampleLots,
      sampleRoutes,
      labRequests,
      results,
      approvalSteps,
      issuancePackages,
    }),
  })])) as Record<string, PcnDossierNodeWorkProjection | undefined>, [approvalSteps, dossier.id, dossier.ownerUsername, dossier.status, documentWaivers, documents, draftWorkspaces, issuancePackages, labRequests, requirements, results, runtime.nodes, sampleLots, sampleRoutes]);

  useEffect(() => {
    const requested = initialNodeId ? runtime.byNodeId[initialNodeId] : undefined;
    setSelectedNodeId((current) => {
      const currentNode = current ? runtime.byNodeId[current] : undefined;
      if (currentNode && (currentNode.isActive || currentNode.status === 'COMPLETED')) return current;
      if (requested && (requested.isActive || requested.status === 'COMPLETED')) return requested.id;
      return runtime.nodes.find((node) => node.isActive || node.status === 'COMPLETED')?.id || runtime.nodes[0]?.id || null;
    });
  }, [dossier.id, initialNodeId, runtime.byNodeId, runtime.nodes]);

  const selectNode = useCallback((nodeId: string) => {
    const node = runtime.byNodeId[nodeId];
    if (!node || (!node.isActive && node.status !== 'COMPLETED')) return;
    setSelectedNodeId(nodeId);
  }, [runtime.byNodeId]);

  const generateAndAttach = useCallback((nodeId: string, requirementId: string) => {
    if (onGenerateAndAttach) return onGenerateAndAttach(nodeId, requirementId);
    return usePcnStore.getState().generateAndAttachDossierNodeDocument(dossier.id, nodeId, requirementId);
  }, [dossier.id, onGenerateAndAttach]);

  const selectedNode = selectedNodeId ? runtime.byNodeId[selectedNodeId] : undefined;
  const selectedTask = selectedNodeId ? dossierTasks.find((task) => task.nodeId === selectedNodeId) : undefined;
  const selectedProjection = selectedNode ? projections[selectedNode.id] : undefined;
  const currentNode = runtime.nodes.find((node) => node.isActive || ['IN_PROGRESS', 'RETURNED', 'READY', 'WAITING'].includes(node.status)) || runtime.nodes[0];
  const currentProjection = currentNode ? projections[currentNode.id] : undefined;
  const currentMissingCount = currentProjection?.unresolvedRequiredCount || 0;
  const currentStatusLabel = currentNode ? CURRENT_NODE_STATUS_LABELS[currentNode.status] : 'Chưa xác định';
  const currentAction = currentProjection?.blockedReason
    || currentProjection?.suggestions[0]
    || (currentMissingCount > 0 ? `Bổ sung ${currentMissingCount} tài liệu bắt buộc` : 'Mở việc bên dưới để kiểm tra và hoàn tất');
  const completedNodeCount = runtime.nodes.filter((node) => node.status === 'COMPLETED' || node.status === 'SKIPPED').length;
  const returnTargets = useMemo(() => {
    if (!selectedNode) return [];
    const selectedIndex = runtime.nodes.findIndex((node) => node.id === selectedNode.id);
    return runtime.nodes.slice(0, selectedIndex).filter((node) => node.status !== 'LOCKED' && (node.isActive || node.status === 'COMPLETED')).map((node) => ({ id: node.id, label: node.label }));
  }, [runtime.nodes, selectedNode]);

  return (
    <div className="min-w-0 min-h-0 space-y-4" data-testid="pcn-dossier-workflow-first">
      {/* 1. Hành động kế tiếp */}
      <section data-testid="pcn-current-step-summary" className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700">Bước cần xử lý</p>
          <h2 className="mt-1 truncate text-base font-black text-slate-950">{currentNode?.label || 'Chưa xác định bước hiện tại'}</h2>
          <p className="mt-1 max-w-3xl text-xs text-emerald-950/75"><span className="font-black">Việc cần làm:</span> {currentAction}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[10px] font-black">
          <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-emerald-700">{currentStatusLabel}</span>
          <span className={`rounded-full border px-2 py-1 ${currentMissingCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-white text-emerald-700'}`}>{currentMissingCount > 0 ? `Còn ${currentMissingCount} mục bắt buộc` : 'Đủ tài liệu bắt buộc'}</span>
          {currentNode && currentNode.id !== selectedNodeId ? <button type="button" onClick={() => selectNode(currentNode.id)} className="mobile-touch-target min-h-11 rounded-md bg-emerald-700 px-3 py-2 text-[11px] font-black text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2">Mở bước này</button> : <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-emerald-700">Đang mở</span>}

        </div>
      </section>

      {/* 2. Workflow rail ngang tự nhiên */}
      <section data-testid="pcn-workflow-map" className="rounded-xl border border-slate-200 bg-slate-50 p-3" aria-labelledby="pcn-workflow-map-title">
        <div className="mb-2 flex min-h-11 items-center justify-between gap-3 border-b border-slate-200 pb-2">
          <h2 id="pcn-workflow-map-title" className="text-xs font-black text-slate-900">Tiến trình hồ sơ PCN</h2>
          <span className="shrink-0 text-[10px] font-bold text-slate-500">{completedNodeCount}/{runtime.nodes.length} bước đã xong</span>
        </div>
        <PcnDossierFlow nodes={runtime.nodes} projections={projections} selectedNodeId={selectedNodeId} onSelectNode={selectNode} />
      </section>

      {/* 3. Nội dung node đang chọn / checklist */}
      {selectedProjection?.isSelectable ? (
        <PcnDossierNodeWorkPanel
          panelId={`pcn-node-panel-${selectedProjection.nodeId}`}
          projection={selectedProjection}
          taskId={selectedTask?.id}
          documents={documents}
          currentUser={currentUser}
          canEdit={canEdit}
          onStartTask={onStartTask}
          onCompleteTask={onCompleteTask}
          onReturnTask={onReturnTask}
          returnTargets={returnTargets}
          onOpenDocuments={onOpenDocuments ? () => onOpenDocuments(selectedProjection.nodeId) : undefined}
          onUploadDocument={onUploadDocument}
          onCreateFromForm={onCreateFromForm}
          onOpenDrafting={onOpenDrafting ? (item) => onOpenDrafting(item, selectedProjection.nodeId) : undefined}
          onGenerateAndAttach={(requirementId) => generateAndAttach(selectedProjection.nodeId, requirementId)}
          onConfirmDocument={onConfirmDocument || ((requirementId) => usePcnStore.getState().confirmDossierDocument(dossier.id, requirementId))}
          onRemoveCurrent={onRemoveCurrent || ((requirementId) => usePcnStore.getState().removeCurrentDossierDocument(dossier.id, requirementId))}
          onWaive={onWaiveDocument}
          onClearWaiver={onClearDocumentWaiver}
          onOpenBusiness={onOpenBusiness}
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600" id={selectedNode ? `pcn-node-panel-${selectedNode.id}` : undefined} role="tabpanel">Chọn một bước đang mở để xem công việc cần xử lý.</div>
      )}
    </div>
  );
}

export default PcnDossierWorkflowPanel;
