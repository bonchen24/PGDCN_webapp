// Author: Codex
// OS support: Web
// Description: Same-origin API client for atomic human review of imported PCN dossiers

import type { ActivityLog, CertificationDossier, CertificationProposal } from '../types.ts';
import type { PcnHistoricalReviewInput } from './pcnHistoricalReview.ts';

export interface PcnHistoricalReviewResponse {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  activityLogs: ActivityLog[];
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Rà soát hồ sơ PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function reviewPcnHistoricalDossier(
  dossierId: string,
  input: PcnHistoricalReviewInput,
): Promise<PcnHistoricalReviewResponse> {
  const response = await fetch('/api/pcn/historical-review', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dossierId, input }),
  });
  return parseResponse(response) as Promise<PcnHistoricalReviewResponse>;
}

// --- End of pcnHistoricalReviewApi.ts ---
