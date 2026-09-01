// Author: Codex
// OS support: Web
// Description: Same-origin API client for PCN template file management

import type { ActivityLog, PcnTemplateDefinition, PcnTemplateReviewAction } from '../types.ts';

export interface PcnTemplateReviewResponse {
  template: PcnTemplateDefinition;
  activityLog?: ActivityLog;
}

export interface PcnTemplateFileUploadResponse {
  template: PcnTemplateDefinition;
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

export async function uploadPcnTemplate(
  templateId: string,
  file: File,
): Promise<PcnTemplateFileUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`/api/pcn/templates/${encodeURIComponent(templateId)}/file`, {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  return parseResponse(response) as Promise<PcnTemplateFileUploadResponse>;
}

// --- End of pcnTemplateApi.ts ---
