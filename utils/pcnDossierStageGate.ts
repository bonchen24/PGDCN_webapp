// Author: Codex
// OS support: Browser/Node
// Description: Sequential five-stage completion and transition policy for PCN dossiers.

import type {
  CertificationDossier,
  PcnDossierDocument,
  PcnDossierDocumentWaiver,
  PcnDossierStatus,
  PcnDocumentRequirement,
} from '../types.ts';
import { getPcnDocumentRequirements } from './pcnDossierDocuments.ts';
import {
  PCN_WORKFLOW_STAGES,
  getPcnWorkflowStage,
  getPcnWorkflowStageIndex,
  type PcnWorkflowStage,
} from './pcnWorkflowStages.ts';
import { getPcnDossierReopenStatus } from './pcnDossierStepAccess.ts';
import { isPcnDocumentWaiverValid } from './pcnDocumentWaivers.ts';

function hasCurrentDocument(document: PcnDossierDocument | undefined): boolean {
  if (!document || document.status !== 'PRESENT' || !document.currentVersionId) return false;
  return document.versions.some((version) => version.assetId === document.currentVersionId);
}

function requirementBelongsToStage(requirement: PcnDocumentRequirement, stage: PcnWorkflowStage): boolean {
  if (requirement.stationKeys?.length) {
    return requirement.stationKeys.some((key) => stage.detailedStationKeys.includes(key));
  }
  return requirement.stages.some((item) => stage.requirementStages.includes(item));
}

const POST_APPROVAL_STATUSES = new Set<PcnDossierStatus>(['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED']);

/** Returns the compact workflow step that owns a checklist requirement. */
export function getPcnRequirementWorkflowStageIndex(requirement: PcnDocumentRequirement): number {
  return PCN_WORKFLOW_STAGES.findIndex((stage) => requirementBelongsToStage(requirement, stage));
}

/** Return the first actionable status for the compact step owning a requirement. */
export function getPcnRequirementReopenStatus(requirement: PcnDocumentRequirement): PcnDossierStatus | undefined {
  const stageIndex = getPcnRequirementWorkflowStageIndex(requirement);
  const stage = stageIndex >= 0 ? PCN_WORKFLOW_STAGES[stageIndex] : undefined;
  return stage ? getPcnDossierReopenStatus(stage.key) : undefined;
}

/**
 * A dossier may repair the current or an earlier step, but must not upload or
 * confirm a document belonging to a future step before crossing its gate.
 * Exception lanes keep the previous behaviour so operators can repair a held
 * dossier before returning it to the normal lifecycle.
 */
export function canProcessPcnDossierRequirement(
  dossier: CertificationDossier,
  requirement: PcnDocumentRequirement,
): boolean {
  const currentStage = getPcnWorkflowStage(dossier.status);
  if (!currentStage) return true;
  if (POST_APPROVAL_STATUSES.has(dossier.status)) return false;
  const requirementStageIndex = getPcnRequirementWorkflowStageIndex(requirement);
  if (requirementStageIndex < 0) return true;
  return requirementStageIndex <= getPcnWorkflowStageIndex(currentStage.key);
}

export interface PcnDossierStageGate {
  currentStageKey?: PcnWorkflowStage['key'];
  currentStageTitle?: string;
  complete: boolean;
  requiredTotal: number;
  resolvedRequiredCount: number;
  missingRequirementIds: string[];
  waivedRequirementIds: string[];
  waivedCount: number;
  documentWaivers: Record<string, PcnDossierDocumentWaiver>;
}

export function buildPcnDossierStageGate(input: {
  dossier: CertificationDossier;
  requirements?: PcnDocumentRequirement[];
  documents?: PcnDossierDocument[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver>;
  /** Resolution supplied by a dedicated boundary, e.g. a confirmed PTN scan in ReturnedTestResult. */
  resolvedRequirementIds?: string[];
}): PcnDossierStageGate {
  const stage = getPcnWorkflowStage(input.dossier.status);
  if (!stage) {
    return {
      complete: true,
      requiredTotal: 0,
      resolvedRequiredCount: 0,
      missingRequirementIds: [],
      waivedRequirementIds: [],
      waivedCount: 0,
      documentWaivers: input.documentWaivers || {},
    };
  }

  const requirements = getPcnDocumentRequirements(input.dossier.fieldCodes, input.requirements)
    .filter((requirement) => requirementBelongsToStage(requirement, stage));
  const documentsByRequirement = new Map(
    (input.documents || [])
      .filter((document) => document.dossierId === input.dossier.id)
      .map((document) => [document.requirementId, document]),
  );
  const missingRequirementIds: string[] = [];
  const waivedRequirementIds: string[] = [];
  const resolvedRequirementIds = new Set(input.resolvedRequirementIds || []);
  for (const requirement of requirements.filter((item) => item.required)) {
    if (hasCurrentDocument(documentsByRequirement.get(requirement.id)) || resolvedRequirementIds.has(requirement.id)) continue;
    const waiver = input.documentWaivers?.[requirement.id];
    if (isPcnDocumentWaiverValid(waiver)) {
      waivedRequirementIds.push(requirement.id);
    } else {
      missingRequirementIds.push(requirement.id);
    }
  }
  const requiredTotal = requirements.filter((item) => item.required).length;
  return {
    currentStageKey: stage.key,
    currentStageTitle: stage.title,
    complete: missingRequirementIds.length === 0,
    requiredTotal,
    resolvedRequiredCount: requiredTotal - missingRequirementIds.length,
    missingRequirementIds,
    waivedRequirementIds,
    waivedCount: waivedRequirementIds.length,
    documentWaivers: input.documentWaivers || {},
  };
}

export function getPcnDossierStageGateDenial(input: {
  dossier: CertificationDossier;
  nextStatus: PcnDossierStatus;
  requirements?: PcnDocumentRequirement[];
  documents?: PcnDossierDocument[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver>;
  /** Resolution supplied by a dedicated boundary, e.g. a confirmed PTN scan in ReturnedTestResult. */
  resolvedRequirementIds?: string[];
}): string | null {
  const currentStage = getPcnWorkflowStage(input.dossier.status);
  const nextStage = getPcnWorkflowStage(input.nextStatus);
  if (!currentStage || !nextStage || currentStage.key === nextStage.key) return null;

  const currentIndex = getPcnWorkflowStageIndex(currentStage.key);
  const nextIndex = getPcnWorkflowStageIndex(nextStage.key);
  if (nextIndex < currentIndex) return null;
  if (nextIndex !== currentIndex + 1) {
    return `Không thể nhảy từ bước ${currentStage.number} sang bước ${nextStage.number}; phải hoàn tất bước ${currentStage.number + 1} trước.`;
  }

  const gate = buildPcnDossierStageGate(input);
  if (gate.complete) return null;
  return `Chưa hoàn tất bước ${currentStage.title}. Còn ${gate.missingRequirementIds.length} tài liệu bắt buộc chưa có hoặc chưa được đánh dấu bỏ qua có lý do.`;
}

export function canAdvancePcnDossierStage(input: Parameters<typeof getPcnDossierStageGateDenial>[0]): boolean {
  return getPcnDossierStageGateDenial(input) === null;
}

// --- End of pcnDossierStageGate.ts ---
