// Author: Codex
// OS support: Browser/Node
// Description: Shared edit-lock policy for the five actionable PCN dossier steps.

import type { CertificationDossier, PcnDossierStatus } from '../types.ts';
import {
  getPcnWorkflowStage,
  getPcnWorkflowStageByKey,
  getPcnWorkflowStageIndex,
} from './pcnWorkflowStages.ts';
import type { PcnPipelineStationKey } from './pcnDossierPipeline.ts';

const POST_APPROVAL_STATUSES = new Set<PcnDossierStatus>([
  'APPROVED',
  'ISSUED',
  'DELIVERED',
  'ARCHIVED',
]);

const REOPEN_STATUS_BY_STAGE: Partial<Record<PcnPipelineStationKey, PcnDossierStatus>> = {
  INTAKE: 'INTAKE_REVIEW',
  SAMPLING_LAB: 'AWAITING_SAMPLING',
  RESULTS: 'AWAITING_RESULTS',
  TECHNICAL_REVIEW: 'TECHNICAL_REVIEW',
  APPROVAL: 'WAITING_APPROVAL',
};

function normalizeUsername(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function isPcnDossierPostApprovalLocked(status: PcnDossierStatus): boolean {
  return POST_APPROVAL_STATUSES.has(status);
}

export interface PcnDossierStepAccess {
  editable: boolean;
  locked: boolean;
  requiresWithdrawal: boolean;
  reason?: string;
}

/**
 * Resolve whether an actor may edit one of the five compact workflow steps.
 * An unassigned dossier remains claimable; once an owner exists, general
 * step work belongs to that owner. Leadership/specialist actions retain their
 * own role-specific server policies.
 */
export function getPcnDossierStepAccess(input: {
  dossier: Pick<CertificationDossier, 'status' | 'ownerUsername'>;
  targetStageKey: PcnPipelineStationKey;
  actorUsername?: string;
  actorIsSystemManager?: boolean;
}): PcnDossierStepAccess {
  if (input.targetStageKey === 'EXCEPTIONS') {
    return { editable: true, locked: false, requiresWithdrawal: false };
  }
  const targetStage = getPcnWorkflowStageByKey(input.targetStageKey);
  const currentStage = getPcnWorkflowStage(input.dossier.status);
  if (!targetStage || !currentStage) {
    return { editable: false, locked: true, requiresWithdrawal: false, reason: 'Bước hồ sơ chưa có cấu hình thao tác.' };
  }

  if (isPcnDossierPostApprovalLocked(input.dossier.status)) {
    return {
      editable: false,
      locked: true,
      requiresWithdrawal: true,
      reason: 'Hồ sơ đã duyệt/phát hành; phải thực hiện thu hồi có lý do trước khi chỉnh sửa.',
    };
  }

  const currentIndex = getPcnWorkflowStageIndex(currentStage.key);
  const targetIndex = getPcnWorkflowStageIndex(targetStage.key);
  if (targetIndex > currentIndex) {
    return {
      editable: false,
      locked: true,
      requiresWithdrawal: false,
      reason: 'Bước sau đang bị khóa; hãy hoàn tất bước hiện tại trước.',
    };
  }

  const ownerUsername = normalizeUsername(input.dossier.ownerUsername);
  const actorUsername = normalizeUsername(input.actorUsername);
  if (ownerUsername && ownerUsername !== actorUsername && !input.actorIsSystemManager) {
    return {
      editable: false,
      locked: true,
      requiresWithdrawal: false,
      reason: 'Chỉ chủ hồ sơ được chỉnh sửa dữ liệu và checklist của bước 1–4.',
    };
  }

  return { editable: true, locked: false, requiresWithdrawal: false };
}

export function getPcnDossierReopenStatus(targetStageKey: PcnPipelineStationKey): PcnDossierStatus | undefined {
  return REOPEN_STATUS_BY_STAGE[targetStageKey];
}

export function getPcnPostApprovalStatuses(): readonly PcnDossierStatus[] {
  return [...POST_APPROVAL_STATUSES];
}

// --- End of pcnDossierStepAccess.ts ---
