// Author: Codex
// OS support: Web
// Description: Same-origin read-only API client for inspecting PCN historical source folders

import type { PcnHistoricalDiscoveryResult } from './pcnHistoricalSourceDiscovery.ts';
import type { PcnAttachmentMappingStatus, PcnHistoricalFileKind } from '../types.ts';

export interface PcnHistoricalDiscoveryInput {
  sourceRoot: string;
  fieldCode?: 'QC4' | 'QC9';
}

export type PcnHistoricalDiscoveryResponse = Omit<PcnHistoricalDiscoveryResult, 'sourceRoot'> & {
  inspectedAt: string;
  readOnly: true;
  message: string;
};

export interface PcnHistoricalDryRunInput {
  sourceRoot: string;
  candidateSelectors: string[];
  batchId: string;
}

export interface PcnHistoricalApplyInput extends PcnHistoricalDryRunInput {
  confirmBatchId: string;
}

export interface PcnHistoricalDryRunFileReport {
  relativePath: string;
  fileName: string;
  kind: PcnHistoricalFileKind;
  byteSize: number;
  sha256: string;
  mappingStatus?: PcnAttachmentMappingStatus;
  mappingReason?: string;
}

export interface PcnHistoricalDryRunDossierReport {
  dossierCode: string;
  proposalCode: string;
  status: string;
  sourceFolderName?: string;
  sourceRelativePath?: string;
  unresolvedFields: string[];
  files: PcnHistoricalDryRunFileReport[];
  skippedFiles: Array<{ relativePath: string; fileName: string; reason: 'ARCHIVE' | 'TEMPORARY' }>;
}

export interface PcnHistoricalDryRunResponse {
  importedAt: string;
  batchId: string;
  selectedCandidates: Array<{ fieldCode: 'QC4' | 'QC9'; businessCode: string; sourceRelativePath: string }>;
  summary: {
    dossierCount: number;
    importedFiles: number;
    skippedFiles: number;
    importedBytes: number;
    byField: Record<'QC4' | 'QC9', number>;
    byKind: Record<string, number>;
    autoMappedFiles: number;
    unmappedFiles: number;
    unmappedByKind: Record<string, number>;
  };
  dossiers: PcnHistoricalDryRunDossierReport[];
  readOnly: true;
  message: string;
}

export interface PcnHistoricalApplyResponse {
  batchId: string;
  applied: boolean;
  idempotent: boolean;
  summary: PcnHistoricalDryRunResponse['summary'];
  message: string;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : (payload as { error?: string; message?: string })?.error || (payload as { message?: string })?.message;
    throw new Error(message || `Kiểm kê nguồn lịch sử PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function discoverPcnHistoricalFoldersOnServer(
  input: PcnHistoricalDiscoveryInput,
): Promise<PcnHistoricalDiscoveryResponse> {
  const response = await fetch('/api/pcn/historical/discovery', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse(response) as Promise<PcnHistoricalDiscoveryResponse>;
}

export async function createPcnHistoricalDryRunOnServer(
  input: PcnHistoricalDryRunInput,
): Promise<PcnHistoricalDryRunResponse> {
  const response = await fetch('/api/pcn/historical/dry-run', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse(response) as Promise<PcnHistoricalDryRunResponse>;
}

export async function applyPcnHistoricalBatchOnServer(
  input: PcnHistoricalApplyInput,
): Promise<PcnHistoricalApplyResponse> {
  const response = await fetch('/api/pcn/historical/apply', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse(response) as Promise<PcnHistoricalApplyResponse>;
}

// --- End of pcnHistoricalDiscoveryApi.ts ---
