// Author: Codex
// OS support: Web
// Description: Same-origin API clients for atomic PCN issuance lifecycle mutations

import type { ActivityLog, CertificationDossier, IssuancePackage, PcnApprovalStep } from '../types.ts';

export interface PcnIssuanceMutationResponse {
  issuance: IssuancePackage;
  dossier: CertificationDossier;
  approvalSteps?: PcnApprovalStep[];
  activityLog?: ActivityLog;
  activityLogs?: ActivityLog[];
  idempotent?: boolean;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `API bộ phát hành PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

function createIdempotencyKey(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

async function postPcnIssuanceMutation(path: string, body: Record<string, unknown>): Promise<PcnIssuanceMutationResponse> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse(response) as Promise<PcnIssuanceMutationResponse>;
}

export function createPcnIssuanceBundle(
  dossierId: string,
  idempotencyKey = createIdempotencyKey('issuance-create'),
): Promise<PcnIssuanceMutationResponse> {
  return postPcnIssuanceMutation('/api/pcn/issuance', { dossierId, idempotencyKey });
}

export function actOnPcnApprovalStep(
  issuanceId: string,
  stepId: string,
  decision: 'APPROVE' | 'RETURN',
  comment?: string,
  idempotencyKey = createIdempotencyKey('approval'),
): Promise<PcnIssuanceMutationResponse> {
  return postPcnIssuanceMutation(
    `/api/pcn/issuance/${encodeURIComponent(issuanceId)}/approval/${encodeURIComponent(stepId)}`,
    { decision, ...(comment ? { comment } : {}), idempotencyKey },
  );
}

export function deliverPcnIssuance(
  issuanceId: string,
  input: { recipient: string; deliveredAt?: string; note?: string },
  idempotencyKey = createIdempotencyKey('issuance-deliver'),
): Promise<PcnIssuanceMutationResponse> {
  return postPcnIssuanceMutation(`/api/pcn/issuance/${encodeURIComponent(issuanceId)}/deliver`, {
    ...input,
    idempotencyKey,
  });
}

export function archivePcnIssuance(
  issuanceId: string,
  idempotencyKey = createIdempotencyKey('issuance-archive'),
): Promise<PcnIssuanceMutationResponse> {
  return postPcnIssuanceMutation(`/api/pcn/issuance/${encodeURIComponent(issuanceId)}/archive`, { idempotencyKey });
}

export function withdrawPcnIssuance(
  issuanceId: string,
  input: { reason: string },
  idempotencyKey = createIdempotencyKey('issuance-withdraw'),
): Promise<PcnIssuanceMutationResponse> {
  return postPcnIssuanceMutation(`/api/pcn/issuance/${encodeURIComponent(issuanceId)}/withdraw`, {
    reason: input.reason,
    idempotencyKey,
  });
}

export function attachPcnIssuanceFile(
  issuanceId: string,
  assetId: string,
  fileName: string,
  idempotencyKey = createIdempotencyKey('issuance-file'),
): Promise<PcnIssuanceMutationResponse> {
  return postPcnIssuanceMutation(`/api/pcn/issuance/${encodeURIComponent(issuanceId)}/file`, {
    assetId,
    fileName,
    idempotencyKey,
  });
}

// --- End of pcnIssuanceApi.ts ---
