import type { CertificationDossier, CertificationProposal, PcnDossierWorkflowTask, PcnWorkflowTemplate } from '../types.ts';
import { buildPcnWorkflowTaskSeed } from './pcnWorkflowRuntime.ts';
import { selectPcnPublishedWorkflowTemplate, snapshotPcnWorkflowTemplate } from './pcnWorkflowTemplate.ts';

export interface PcnWorkflowBackfillPlan {
  dossierId: string;
  dossier: CertificationDossier;
  tasks: PcnDossierWorkflowTask[];
}

export interface PcnWorkflowBackfillSkippedItem {
  dossierId: string;
  reason: string;
}

export interface PcnWorkflowBackfillResult {
  plans: PcnWorkflowBackfillPlan[];
  skipped: PcnWorkflowBackfillSkippedItem[];
}

export interface PcnWorkflowBackfillInput {
  dossiers: readonly CertificationDossier[];
  proposals: readonly Pick<CertificationProposal, 'id' | 'fieldCodes'>[];
  templates: readonly PcnWorkflowTemplate[];
  now: string;
  actor: string;
}

export function buildPcnWorkflowBackfillPlan(input: PcnWorkflowBackfillInput): PcnWorkflowBackfillResult {
  const proposalsById = new Map(input.proposals.map((proposal) => [proposal.id, proposal]));
  const plans: PcnWorkflowBackfillPlan[] = [];
  const skipped: PcnWorkflowBackfillSkippedItem[] = [];

  for (const dossier of input.dossiers) {
    if (dossier.workflowSnapshot) {
      skipped.push({ dossierId: dossier.id, reason: 'Hồ sơ đã có snapshot workflow.' });
      continue;
    }

    const proposal = proposalsById.get(dossier.proposalId);
    const fieldCodes = dossier.fieldCodes.length > 0 ? dossier.fieldCodes : (proposal?.fieldCodes || []);
    const template = selectPcnPublishedWorkflowTemplate(input.templates, {
      fieldCodes,
      method: dossier.method,
      dossierType: dossier.dossierType,
    });
    if (!template) {
      skipped.push({ dossierId: dossier.id, reason: 'Không tìm thấy template PUBLISHED phù hợp.' });
      continue;
    }

    const workflowSnapshot = snapshotPcnWorkflowTemplate(template, {
      capturedAt: input.now,
      capturedBy: input.actor,
    });
    const dossierFieldSet = new Set(fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean));
    workflowSnapshot.nodes = workflowSnapshot.nodes.map((node) => ({
      ...node,
      requirementIds: node.requirementIds.filter((requirementId) => {
        const prefix = String(requirementId).split('-')[0].toUpperCase();
        return !['QC4', 'QC9'].includes(prefix) || dossierFieldSet.has(prefix);
      }),
    }));
    const nextDossier: CertificationDossier = {
      ...dossier,
      ...(fieldCodes.length > 0 ? { fieldCodes } : {}),
      workflowTemplateId: template.id,
      workflowTemplateVersion: template.version,
      workflowSnapshot,
      updatedAt: input.now,
    };
    plans.push({
      dossierId: dossier.id,
      dossier: nextDossier,
      tasks: buildPcnWorkflowTaskSeed(workflowSnapshot, dossier.id, input.actor, input.now),
    });
  }

  return { plans, skipped };
}

// --- End of pcnWorkflowBackfill.ts ---
