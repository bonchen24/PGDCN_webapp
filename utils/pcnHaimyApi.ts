// Author: Codex
// OS support: Web
// Description: Same-origin PCN boundary for Haimy staging imports

import type { ActivityLog, CertificationDossier, CertificationProposal, PcnDossierDocument, PcnHaimyExportRecord, PcnHaimyPromotionMetadata, PcnHaimyStagingRecord } from '../types.ts';
import type { PcnHaimyPromotionInput } from './pcnHaimyPromotion.ts';

export interface PcnHaimyStagingSummary {
  received: number;
  created: number;
  idempotent: number;
  needsReview: number;
  conflicts: number;
}

export interface PcnHaimyImportResponse {
  batchId: string;
  items: PcnHaimyStagingRecord[];
  summary: PcnHaimyStagingSummary;
  idempotent: boolean;
}

export interface PcnHaimyPromotionResponse {
  staging: PcnHaimyStagingRecord;
  promotion?: PcnHaimyPromotionMetadata;
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  dossierDocuments?: PcnDossierDocument[];
  activityLogs?: ActivityLog[];
  idempotent: boolean;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Import Haimy trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function importPcnHaimyStaging(batchId: string, records: PcnHaimyExportRecord[]): Promise<PcnHaimyImportResponse> {
  const response = await fetch('/api/pcn/integrations/haimy/import', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ batchId, records }),
  });
  return parseResponse(response) as Promise<PcnHaimyImportResponse>;
}

export async function fetchPcnHaimyStaging(): Promise<PcnHaimyStagingRecord[]> {
  const response = await fetch('/api/db/pcnHaimyStaging', { credentials: 'same-origin' });
  const payload = await parseResponse(response);
  return Array.isArray(payload?.items) ? payload.items as PcnHaimyStagingRecord[] : [];
}

export async function promotePcnHaimyStaging(
  idempotencyKey: string,
  input: PcnHaimyPromotionInput,
): Promise<PcnHaimyPromotionResponse> {
  const response = await fetch('/api/pcn/integrations/haimy/promote', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idempotencyKey, input }),
  });
  return parseResponse(response) as Promise<PcnHaimyPromotionResponse>;
}

// --- End of pcnHaimyApi.ts ---
