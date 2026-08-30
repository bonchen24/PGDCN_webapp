// Author: Codex
// OS support: Web
// Description: Same-origin API client for atomic PCN sample-lot and route mutations

import type {
  ActivityLog,
  CertificationDossier,
  PcnSampleFlowEvent,
  PcnSampleLot,
  PcnSampleRoute,
  PcnSampleRouteStatus,
} from '../types.ts';
import type { PcnSampleLotDraft, PcnSampleRouteUpdate } from './pcnSampleFlow.ts';

export interface PcnSampleLotMutationResponse {
  lot: PcnSampleLot;
  routes: PcnSampleRoute[];
  dossier: CertificationDossier;
  event?: PcnSampleFlowEvent;
  activityLogs: ActivityLog[];
  idempotent?: boolean;
}

export interface PcnSampleRouteMutationResponse {
  route: PcnSampleRoute;
  lot: PcnSampleLot;
  dossier: CertificationDossier;
  event?: PcnSampleFlowEvent;
  activityLogs: ActivityLog[];
  idempotent?: boolean;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `API mẫu PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function createPcnSampleLot(draft: PcnSampleLotDraft): Promise<PcnSampleLotMutationResponse> {
  const response = await fetch('/api/pcn/samples/lots', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ draft }),
  });
  return parseResponse(response) as Promise<PcnSampleLotMutationResponse>;
}

function createIdempotencyKey(): string {
  return `sample-route-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export async function updatePcnSampleRoute(
  routeId: string,
  status: PcnSampleRouteStatus,
  update: PcnSampleRouteUpdate = {},
  idempotencyKey = createIdempotencyKey(),
): Promise<PcnSampleRouteMutationResponse> {
  const response = await fetch(`/api/pcn/samples/routes/${encodeURIComponent(routeId)}/status`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status, update, idempotencyKey }),
  });
  return parseResponse(response) as Promise<PcnSampleRouteMutationResponse>;
}

// --- End of pcnSampleApi.ts ---
