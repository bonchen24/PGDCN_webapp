'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { CertificationDossier, IssuancePackage, OutboundLabRequest, PcnApprovalStep, PcnDossierDocument, PcnDossierDocumentWaiver, PcnDossierWorkflowTask, PcnDocumentRequirement, PcnSampleLot, PcnSampleRoute, PcnUserAccount, ReturnedTestResult } from '../types';
import { usePcnStore } from '../store-pcn';
import { buildPcnDossierNodeBusinessFacts, buildPcnDossierNodeWorkProjection, type PcnDossierNodeBusinessFact, type PcnDossierNodeDocumentItem, type PcnDossierNodeWorkProjection } from '../utils/pcnDossierNodeWork';
import { buildPcnWorkflowConditionContext, projectPcnWorkflowRuntime } from '../utils/pcnWorkflowRuntime';
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

export function PcnDossierWorkflowPanel({ dossier, requirements, documents, documentWaivers, results = [], approvalSteps = [], sampleLots = [], sampleRoutes = [], labRequests = [], issuancePackages = [], workflowTasks, users: _users = [], currentUser, canEdit, onStartTask, onCompleteTask, onReturnTask, onOpenDocuments, onUploadDocument, onCreateFromForm, onOpenDrafting, onGenerateAndAttach, onConfirmDocument, onRemoveCurrent, onWaiveDocument, onClearDocumentWaiver, onOpenBusiness, initialNodeId }: PcnDossierWorkflowPanelProps) {
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
  })])) as Record<string, PcnDossierNodeWorkProjection | undefined>, [approvalSteps, dossier.id, dossier.ownerUsername, dossier.status, documentWaivers, documents, issuancePackages, labRequests, requirements, results, runtime.nodes, sampleLots, sampleRoutes]);

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
  const returnTargets = useMemo(() => {
    if (!selectedNode) return [];
    const selectedIndex = runtime.nodes.findIndex((node) => node.id === selectedNode.id);
    return runtime.nodes.slice(0, selectedIndex).filter((node) => node.status !== 'LOCKED' && (node.isActive || node.status === 'COMPLETED')).map((node) => ({ id: node.id, label: node.label }));
  }, [runtime.nodes, selectedNode]);

  return (
    <div className="min-w-0 min-h-0" data-testid="pcn-dossier-workflow-first">
      <section
        data-testid="pcn-workflow-step-card"
        aria-labelledby="pcn-workflow-step-title"
        className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"
      >
        <div className="flex min-h-10 items-center justify-between gap-3">
          <h2 id="pcn-workflow-step-title" className="text-sm font-black text-slate-950">Bước xử lý</h2>
        </div>
        <div className="mt-2">
          <PcnDossierFlow nodes={runtime.nodes} projections={projections} selectedNodeId={selectedNodeId} onSelectNode={selectNode} />
        </div>

        <div className="mt-3 border-t border-slate-200 pt-3">
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
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600" id={selectedNode ? `pcn-node-panel-${selectedNode.id}` : undefined} role="tabpanel">
              Chọn một bước đang mở để xem công việc cần xử lý.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default PcnDossierWorkflowPanel;
