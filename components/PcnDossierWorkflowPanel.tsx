'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import type { CertificationDossier, IssuancePackage, OutboundLabRequest, PcnApprovalStep, PcnDossierDocument, PcnDossierDocumentWaiver, PcnDossierWorkflowTask, PcnDocumentRequirement, PcnSampleLot, PcnSampleRoute, PcnUserAccount, ReturnedTestResult } from '../types';
import { usePcnStore } from '../store-pcn';
import { buildPcnDossierNodeBusinessFacts, buildPcnDossierNodeWorkProjection } from '../utils/pcnDossierNodeWork';
import { buildPcnWorkflowConditionContext, projectPcnWorkflowRuntime } from '../utils/pcnWorkflowRuntime';
import { getPcnWorkflowForDossier } from '../utils/pcnWorkflowTemplate';
import PcnArchifyWorkflowEmbed from './PcnArchifyWorkflowEmbed';
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
  canEdit: boolean;
  onStartTask?: (taskId: string) => Promise<void>;
  onCompleteTask?: (taskId: string, expectedCycleNo?: number) => Promise<void>;
  onReturnTask?: (taskId: string, input: { targetNodeId: string; reason: string }) => Promise<void>;
  onOpenDocuments?: (nodeId: string) => void;
  onUploadDocument?: (requirementId: string, file: File) => Promise<void>;
  onCreateFromForm?: (requirementId: string) => void;
  onOpenDrafting?: (item: import('../utils/pcnDossierNodeWork').PcnDossierNodeDocumentItem, nodeId: string) => string | undefined;
  onGenerateAndAttach?: (nodeId: string, requirementId: string) => Promise<void>;
  onRemoveCurrent?: (requirementId: string) => Promise<void>;
  onWaiveDocument?: (requirementId: string, reason: string) => Promise<void>;
  onClearDocumentWaiver?: (requirementId: string) => Promise<void>;
  onOpenBusiness?: (fact: import('../utils/pcnDossierNodeWork').PcnDossierNodeBusinessFact) => void;
}

export function PcnDossierWorkflowPanel({ dossier, requirements, documents, documentWaivers, results = [], approvalSteps = [], sampleLots = [], sampleRoutes = [], labRequests = [], issuancePackages = [], workflowTasks, users = [], canEdit, onStartTask, onCompleteTask, onReturnTask, onOpenDocuments, onUploadDocument, onCreateFromForm, onOpenDrafting, onGenerateAndAttach, onRemoveCurrent, onWaiveDocument, onClearDocumentWaiver, onOpenBusiness, initialNodeId }: PcnDossierWorkflowPanelProps) {
  const workflow = useMemo(() => getPcnWorkflowForDossier(dossier), [dossier]);
  const nodes = useMemo(() => workflow.nodes.filter((node) => node.active !== false).map((node) => ({ id: node.id, label: node.label, kind: node.kind })), [workflow.nodes]);
  const edgeIds = useMemo(() => {
    const activeNodeIds = new Set(workflow.nodes.filter((node) => node.active !== false).map((node) => node.id));
    return workflow.transitions.filter((transition) => activeNodeIds.has(transition.fromNodeId) && activeNodeIds.has(transition.toNodeId)).map((transition) => transition.id);
  }, [workflow.nodes, workflow.transitions]);
  const dossierTasks = useMemo(() => workflowTasks.filter((task) => task.dossierId === dossier.id), [dossier.id, workflowTasks]);
  const conditionContext = useMemo(() => buildPcnWorkflowConditionContext({ workflow, documents, documentWaivers, results, approvalSteps, fieldCodes: dossier.fieldCodes, method: dossier.method }), [approvalSteps, dossier.fieldCodes, dossier.method, documentWaivers, documents, results, workflow]);
  const runtime = useMemo(() => projectPcnWorkflowRuntime({ workflow, tasks: dossierTasks, documents, documentWaivers, conditionContext }), [conditionContext, dossierTasks, documentWaivers, documents, workflow]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodeId || null);

  useEffect(() => {
    setSelectedNodeId(initialNodeId || null);
  }, [dossier.id, initialNodeId]);

  const selectNode = useCallback((nodeId: string | null) => {
    if (!nodeId) {
      setSelectedNodeId(null);
      return;
    }
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
  const selectedProjection = selectedNode ? buildPcnDossierNodeWorkProjection({
    node: selectedNode,
    runtimeNode: selectedNode,
    requirements,
    documents,
    documentWaivers,
    businessFacts: buildPcnDossierNodeBusinessFacts({
      actionKey: selectedNode.actionKey,
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
  }) : undefined;

  return <div className="grid min-w-0 min-h-0 gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]" data-testid="pcn-dossier-workflow-first">
    <PcnArchifyWorkflowEmbed domain="pcn" recordId={dossier.id} recordCode={dossier.dossierCode} initialNodeId={initialNodeId} nodes={nodes} edgeIds={edgeIds} workflowTasks={dossierTasks} canEdit={canEdit} onStartTask={onStartTask} onCompleteTask={onCompleteTask} onReturnTask={onReturnTask} onOpenDocuments={onOpenDocuments} onSelectNode={selectNode} />
    {selectedProjection?.isSelectable ? <PcnDossierNodeWorkPanel projection={selectedProjection} taskId={selectedTask?.id} documents={documents} canEdit={canEdit} onStartTask={onStartTask} onCompleteTask={onCompleteTask} onUploadDocument={onUploadDocument} onCreateFromForm={onCreateFromForm} onOpenDrafting={onOpenDrafting ? (item) => onOpenDrafting(item, selectedProjection.nodeId) : undefined} onGenerateAndAttach={(requirementId) => generateAndAttach(selectedProjection.nodeId, requirementId)} onRemoveCurrent={onRemoveCurrent || ((requirementId) => usePcnStore.getState().removeCurrentDossierDocument(dossier.id, requirementId))} onWaive={onWaiveDocument} onClearWaiver={onClearDocumentWaiver} onOpenBusiness={onOpenBusiness} onClose={() => selectNode(null)} /> : null}
    {selectedProjection && !selectedProjection.isSelectable ? <div className="hidden" aria-hidden="true">{users.length + issuancePackages.length}</div> : null}
  </div>;
}

export default PcnDossierWorkflowPanel;
