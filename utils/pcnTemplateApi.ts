// Author: Codex
// OS support: Web
// Description: Same-origin API client for PCN template metadata review

import type { ActivityLog, PcnTemplateDefinition, PcnTemplateReviewAction } from '../types.ts';
import type { PcnTemplateInspection } from './pcnTemplateDiscovery.ts';
import type { PcnTemplateSourceCoverageReport } from './pcnTemplateSourceCoverage.ts';

export interface PcnTemplateReviewResponse {
  template: PcnTemplateDefinition;
  activityLog?: ActivityLog;
}

export type PcnTemplateImportMode = 'DRY_RUN' | 'APPLY';

export interface PcnTemplateImportInput {
  templateId: string;
  sourceRoot: string;
  mode: PcnTemplateImportMode;
  approve?: boolean;
  allowAnnotation?: boolean;
}

export interface PcnTemplateImportResponse {
  mode: PcnTemplateImportMode;
  templateId: string;
  sourceRelativePath: string;
  inspection: PcnTemplateInspection;
  assetId: string;
  objectPath: string;
  mimeType: string;
  status: PcnTemplateDefinition['status'];
  requiresAnnotation: boolean;
  canApprove: boolean;
  readOnly: boolean;
  changed?: boolean;
  definition?: PcnTemplateDefinition;
  activityLog?: ActivityLog;
  message: string;
}

export interface PcnTemplateSourceCoverageInput {
  sourceRoot: string;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : (payload as { error?: string; message?: string })?.error || (payload as { message?: string })?.message;
    throw new Error(message || `Thao tác template PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function reviewPcnTemplate(
  templateId: string,
  action: PcnTemplateReviewAction,
  reason?: string,
): Promise<PcnTemplateReviewResponse> {
  const response = await fetch(`/api/pcn/templates/${encodeURIComponent(templateId)}/review`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...(reason?.trim() ? { reason: reason.trim() } : {}) }),
  });
  return parseResponse(response) as Promise<PcnTemplateReviewResponse>;
}

export async function importPcnTemplateOnServer(
  input: PcnTemplateImportInput,
): Promise<PcnTemplateImportResponse> {
  const response = await fetch('/api/pcn/templates/import', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse(response) as Promise<PcnTemplateImportResponse>;
}

export async function preflightPcnTemplateSourcesOnServer(
  input: PcnTemplateSourceCoverageInput,
): Promise<PcnTemplateSourceCoverageReport> {
  const response = await fetch('/api/pcn/templates/preflight-all', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse(response) as Promise<PcnTemplateSourceCoverageReport>;
}

// --- End of pcnTemplateApi.ts ---
