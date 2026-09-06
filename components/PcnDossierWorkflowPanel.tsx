'use client';

import React, { useMemo } from 'react';

import type { CertificationDossier, PcnApprovalStep, PcnDossierDocument, PcnDossierDocumentWaiver, PcnDossierWorkflowTask, PcnDocumentRequirement, PcnUserAccount, ReturnedTestResult } from '../types';
import { getPcnWorkflowForDossier } from '../utils/pcnWorkflowTemplate';
import PcnArchifyWorkflowEmbed from './PcnArchifyWorkflowEmbed';

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

export function PcnDossierWorkflowPanel({ dossier, workflowTasks, canEdit, onStartTask, onCompleteTask, onReturnTask, initialNodeId }: PcnDossierWorkflowPanelProps) {
  const workflow = useMemo(() => getPcnWorkflowForDossier(dossier), [dossier]);
  const nodes = useMemo(() => workflow.nodes.filter((node) => node.active !== false).map((node) => ({ id: node.id, label: node.label, kind: node.kind })), [workflow.nodes]);
  return <PcnArchifyWorkflowEmbed domain="pcn" recordId={dossier.id} recordCode={dossier.dossierCode} initialNodeId={initialNodeId} nodes={nodes} workflowTasks={workflowTasks} canEdit={canEdit} onStartTask={onStartTask} onCompleteTask={onCompleteTask} onReturnTask={onReturnTask} />;
}

export default PcnDossierWorkflowPanel;
