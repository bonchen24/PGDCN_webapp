// Author: Codex
// OS support: Web
// Description: Same-origin API client for atomic PCN returned-result mutations

import type {
  ActivityLog,
  CertificationDossier,
  OutboundLabRequest,
  PcnSampleFlowEvent,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';

export interface PcnReturnedResultMutationResponse {
  results: ReturnedTestResult[];
  request: OutboundLabRequest;
  dossier: CertificationDossier;
  lot?: PcnSampleLot;
  route?: PcnSampleRoute;
  events: PcnSampleFlowEvent[];
  activityLogs: ActivityLog[];
  idempotent?: boolean;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `API KQTN PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function submitPcnReturnedResult(
  result: ReturnedTestResult,
  idempotencyKey = result.id,
): Promise<PcnReturnedResultMutationResponse> {
  const response = await fetch('/api/pcn/results', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ result, idempotencyKey }),
  });
  return parseResponse(response) as Promise<PcnReturnedResultMutationResponse>;
}

// --- End of pcnResultApi.ts ---
