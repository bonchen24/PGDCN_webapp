// Author: Codex
// OS support: Web
// Description: Same-origin API client for atomic PCN outbound PYC mutations

import type {
  ActivityLog,
  CertificationDossier,
  OutboundLabRequest,
  PcnSampleLot,
  PcnSampleRoute,
  PcnSampleFlowEvent,
  PcnLabRequestStatus,
} from '../types.ts';

export interface PcnLabRequestMutationResponse {
  request: OutboundLabRequest;
  dossier: CertificationDossier;
  lot?: PcnSampleLot;
  route?: PcnSampleRoute;
  activityLogs: ActivityLog[];
  event?: PcnSampleFlowEvent;
  stale?: boolean;
  idempotent?: boolean;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PYC API PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function createPcnLabRequest(request: OutboundLabRequest): Promise<PcnLabRequestMutationResponse> {
  const response = await fetch('/api/pcn/lab-requests', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ request }),
  });
  return parseResponse(response) as Promise<PcnLabRequestMutationResponse>;
}

function createIdempotencyKey(): string {
  return `pyc-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export async function updatePcnLabRequest(
  requestId: string,
  status: PcnLabRequestStatus,
  updates: Partial<Pick<OutboundLabRequest, 'handoverAt' | 'receivedAt' | 'handoverNote' | 'handoverDocumentId' | 'handoverDetails' | 'sampleIssue' | 'returnedResultId'>> = {},
  idempotencyKey = createIdempotencyKey(),
): Promise<PcnLabRequestMutationResponse> {
  const response = await fetch(`/api/pcn/lab-requests/${encodeURIComponent(requestId)}/status`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status, updates, idempotencyKey }),
  });
  return parseResponse(response) as Promise<PcnLabRequestMutationResponse>;
}

export async function dispatchPcnLabRequest(requestId: string): Promise<PcnLabRequestMutationResponse> {
  const response = await fetch(`/api/pcn/lab-requests/${encodeURIComponent(requestId)}/dispatch`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return parseResponse(response) as Promise<PcnLabRequestMutationResponse>;
}

export async function reconcilePcnLabRequest(requestId: string): Promise<PcnLabRequestMutationResponse> {
  const response = await fetch(`/api/pcn/lab-requests/${encodeURIComponent(requestId)}/reconcile`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return parseResponse(response) as Promise<PcnLabRequestMutationResponse>;
}

// --- End of pcnLabRequestApi.ts ---
