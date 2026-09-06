// Author: Codex
// OS support: Web/Node
// Description: Same-origin API client for the PCN sample-management register bundle.

import type {
  ActivityLog,
  OutboundLabRequest,
  PcnSampleFlowEvent,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRequestBundle,
  PcnSampleRequestBundleDraft,
  PcnSampleRequestBundleDispatch,
  PcnSampleRoute,
} from '../types.ts';

export interface PcnSampleRequestBundleMutationResponse {
  bundle: PcnSampleRequestBundle;
  lots: PcnSampleLot[];
  items: PcnSampleItem[];
  routes: PcnSampleRoute[];
  dispatches: PcnSampleRequestBundleDispatch[];
  labRequests: OutboundLabRequest[];
  events?: PcnSampleFlowEvent[];
  activityLogs: ActivityLog[];
  idempotent?: boolean;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Sổ quản lý mẫu trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function savePcnSampleRequestBundle(bundle: PcnSampleRequestBundleDraft): Promise<PcnSampleRequestBundleMutationResponse> {
  const response = await fetch('/api/pcn/sample-request-bundles', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bundle }),
  });
  return parseResponse(response) as Promise<PcnSampleRequestBundleMutationResponse>;
}

export async function sendPcnSampleRequestBundle(bundleId: string): Promise<PcnSampleRequestBundleMutationResponse> {
  const response = await fetch(`/api/pcn/sample-request-bundles/${encodeURIComponent(bundleId)}/send`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return parseResponse(response) as Promise<PcnSampleRequestBundleMutationResponse>;
}

export async function retryPcnSampleRequestBundleDispatch(bundleId: string, dispatchId: string): Promise<PcnSampleRequestBundleMutationResponse> {
  const response = await fetch(`/api/pcn/sample-request-bundles/${encodeURIComponent(bundleId)}/retry/${encodeURIComponent(dispatchId)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  return parseResponse(response) as Promise<PcnSampleRequestBundleMutationResponse>;
}

// --- End of pcnSampleRequestBundleApi.ts ---
