// Author: Codex
// OS support: Web
// Description: Same-origin API client for canonical PCN dossier document generation

import type { ActivityLog, PcnGeneratedDocument, PcnGeneratedDocumentFormat, PcnGeneratedDocumentKind } from '../types.ts';
import type { PcnDossierDocumentContext } from './pcnDocumentGeneration.ts';

export interface PcnDocumentGenerationResponse {
  context: PcnDossierDocumentContext;
  documents: PcnGeneratedDocument[];
  activityLogs: ActivityLog[];
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Sinh tài liệu PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function generatePcnDossierDocuments(
  dossierId: string,
  kind: PcnGeneratedDocumentKind = 'DOSSIER_COVER',
  formats: PcnGeneratedDocumentFormat[] = ['DOCX', 'PDF'],
  sampleRouteId?: string,
  expectedContextHash?: string,
  labRequestId?: string,
): Promise<PcnDocumentGenerationResponse> {
  const response = await fetch('/api/pcn/documents/generate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dossierId, kind, formats, ...(sampleRouteId ? { sampleRouteId } : {}), ...(expectedContextHash ? { expectedContextHash } : {}), ...(labRequestId ? { labRequestId } : {}) }),
  });
  return parseResponse(response) as Promise<PcnDocumentGenerationResponse>;
}

export async function preflightPcnDossierDocuments(
  dossierId: string,
  kind: PcnGeneratedDocumentKind = 'DOSSIER_COVER',
  sampleRouteId?: string,
  labRequestId?: string,
): Promise<PcnDocumentGenerationResponse> {
  const response = await fetch('/api/pcn/documents/generate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dossierId, kind, dryRun: true, formats: ['DOCX'], ...(sampleRouteId ? { sampleRouteId } : {}), ...(labRequestId ? { labRequestId } : {}) }),
  });
  return parseResponse(response) as Promise<PcnDocumentGenerationResponse>;
}

// --- End of pcnDocumentGenerationApi.ts ---
