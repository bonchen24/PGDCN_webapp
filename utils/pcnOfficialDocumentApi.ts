// Author: Codex
// OS support: Web
// Description: Same-origin API client for approved PCN official-document generation

import type { ActivityLog, IssuancePackage, PcnOfficialDocumentKind, PcnOfficialGeneratedDocument, PcnGeneratedDocumentFormat } from '../types.ts';

export interface PcnOfficialPreflightItem {
  documentKind: PcnOfficialDocumentKind;
  ready: boolean;
  reasons: string[];
  templateId?: string;
  templateDisplayName?: string;
  officialContextHash?: string;
}

export interface PcnOfficialPreflightResponse {
  issuance: IssuancePackage;
  contextHash: string;
  preflight: PcnOfficialPreflightItem[];
}

export interface PcnOfficialDocumentGenerationResponse {
  issuance: IssuancePackage;
  documents: PcnOfficialGeneratedDocument[];
  activityLogs: ActivityLog[];
  contextHash: string;
  preflight?: PcnOfficialPreflightItem[];
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Sinh tài liệu phát hành PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function generatePcnOfficialDocuments(
  issuanceId: string,
  documentKinds: PcnOfficialDocumentKind[] = ['CERTIFICATE', 'DECISION'],
  formats: PcnGeneratedDocumentFormat[] = ['DOCX'],
  expectedContextHash?: string,
): Promise<PcnOfficialDocumentGenerationResponse> {
  const normalizedContextHash = String(expectedContextHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedContextHash)) {
    throw new Error('Sinh tài liệu chính thức phải dùng expectedContextHash từ bước kiểm tra dữ liệu.');
  }
  const response = await fetch(`/api/pcn/issuance/${encodeURIComponent(issuanceId)}/official-documents/generate`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documentKinds, formats, expectedContextHash: normalizedContextHash }),
  });
  return parseResponse(response) as Promise<PcnOfficialDocumentGenerationResponse>;
}

export async function preflightPcnOfficialDocuments(
  issuanceId: string,
  documentKinds: PcnOfficialDocumentKind[] = ['CERTIFICATE', 'DECISION'],
  formats: PcnGeneratedDocumentFormat[] = ['DOCX'],
): Promise<PcnOfficialPreflightResponse> {
  const response = await fetch(`/api/pcn/issuance/${encodeURIComponent(issuanceId)}/official-documents/generate`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documentKinds, formats, dryRun: true }),
  });
  return parseResponse(response) as Promise<PcnOfficialPreflightResponse>;
}

// --- End of pcnOfficialDocumentApi.ts ---
