// Author: Codex
// OS support: Web
// Description: Same-origin API clients for the PCN quality-document registry

import type { ActivityLog, PcnQualityDocument } from '../types.ts';
import type { PcnQualityDocumentInput } from './pcnQualityDocuments.ts';

export interface PcnQualityDocumentMutationResponse {
  document: PcnQualityDocument;
  activityLog?: ActivityLog;
  idempotent?: boolean;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Tài liệu chất lượng PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

async function post(path: string, body: Record<string, unknown>): Promise<PcnQualityDocumentMutationResponse> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseResponse(response) as Promise<PcnQualityDocumentMutationResponse>;
}

export function createPcnQualityDocument(document: PcnQualityDocumentInput): Promise<PcnQualityDocumentMutationResponse> {
  return post('/api/pcn/quality-documents', { document });
}

export function updatePcnQualityDocument(
  documentId: string,
  updates: Partial<Omit<PcnQualityDocument, 'id'>>,
): Promise<PcnQualityDocumentMutationResponse> {
  return post(`/api/pcn/quality-documents/${encodeURIComponent(documentId)}`, { updates });
}

export function attachPcnQualityDocumentFile(
  documentId: string,
  assetId: string,
  fileName: string,
): Promise<PcnQualityDocumentMutationResponse> {
  return post(`/api/pcn/quality-documents/${encodeURIComponent(documentId)}/file`, { assetId, fileName });
}

// --- End of pcnQualityDocumentApi.ts ---
