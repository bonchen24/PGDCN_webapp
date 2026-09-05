// Author: Codex
// OS support: Web
// Description: Same-origin API client for atomic PCN dossier metadata mutations

import type { ActivityLog, CertificationDossier, IssuancePackage, PcnApprovalStep } from '../types.ts';

type PcnNullableDossierField =
  | 'ownerUsername'
  | 'evaluatorUsername'
  | 'reviewerUsername'
  | 'targetDate'
  | 'evaluationAt'
  | 'effectiveAt'
  | 'exceptionReason';

export type PcnDossierUpdateInput =
  Partial<Pick<CertificationDossier, 'status' | 'method' | 'operationalForms'>>
  & { documentWaivers?: Record<string, { reason: string } | null> }
  & Partial<Record<PcnNullableDossierField, string | null>>;

export interface PcnDossierMutationResponse {
  dossier: CertificationDossier;
  approvalSteps?: PcnApprovalStep[];
  issuance?: IssuancePackage;
  activityLog?: ActivityLog;
  idempotent?: boolean;
}

export interface PcnDossierDeleteResponse {
  deleted: true;
  dossierId: string;
  proposalId?: string;
  activityLog?: ActivityLog;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Cập nhật hồ sơ PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

function createIdempotencyKey(): string {
  return `dossier-update-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export async function updatePcnDossier(
  dossierId: string,
  updates: PcnDossierUpdateInput,
  idempotencyKey = createIdempotencyKey(),
): Promise<PcnDossierMutationResponse> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(dossierId)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ updates, idempotencyKey }),
  });
  return parseResponse(response) as Promise<PcnDossierMutationResponse>;
}

export async function deletePcnDossier(
  dossierId: string,
  reason: string,
  confirmationCode: string,
): Promise<PcnDossierDeleteResponse> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(dossierId)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason, confirmationCode }),
  });
  return parseResponse(response) as Promise<PcnDossierDeleteResponse>;
}

// --- End of pcnDossierApi.ts ---
