import type { ActivityLog, PcnWorkflowTemplate } from '../types.ts';

export interface PcnWorkflowTemplateMutationResponse {
  template: PcnWorkflowTemplate;
  activityLog?: ActivityLog;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Thao tác workflow template trả về HTTP ${response.status}`);
  }
  return payload;
}

async function request(path: string, method: string, body?: unknown): Promise<any> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return parseResponse(response);
}

export async function fetchPcnWorkflowTemplates(): Promise<PcnWorkflowTemplate[]> {
  const response = await fetch('/api/pcn/workflow-templates', { credentials: 'same-origin' });
  const payload = await parseResponse(response);
  return Array.isArray(payload?.items) ? payload.items as PcnWorkflowTemplate[] : [];
}

export async function createPcnWorkflowTemplate(template: PcnWorkflowTemplate): Promise<PcnWorkflowTemplateMutationResponse> {
  return request('/api/pcn/workflow-templates', 'POST', { template }) as Promise<PcnWorkflowTemplateMutationResponse>;
}

export async function createPcnWorkflowRevision(templateId: string, template: PcnWorkflowTemplate): Promise<PcnWorkflowTemplateMutationResponse> {
  return request(`/api/pcn/workflow-templates/${encodeURIComponent(templateId)}/revisions`, 'POST', { template }) as Promise<PcnWorkflowTemplateMutationResponse>;
}

export async function publishPcnWorkflowTemplate(templateId: string): Promise<PcnWorkflowTemplateMutationResponse> {
  return request(`/api/pcn/workflow-templates/${encodeURIComponent(templateId)}/publish`, 'POST') as Promise<PcnWorkflowTemplateMutationResponse>;
}

export async function retirePcnWorkflowTemplate(templateId: string, reason: string): Promise<PcnWorkflowTemplateMutationResponse> {
  return request(`/api/pcn/workflow-templates/${encodeURIComponent(templateId)}/retire`, 'POST', { reason: reason.trim() }) as Promise<PcnWorkflowTemplateMutationResponse>;
}

// --- End of pcnWorkflowTemplateApi.ts ---
