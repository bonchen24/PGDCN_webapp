import type { ActivityLog } from '../types.ts';
import type { PgdWorkflowTemplate } from './pgdWorkflowTemplate.ts';

export interface PgdWorkflowTemplateMutationResponse {
  template: PgdWorkflowTemplate;
  activityLog?: ActivityLog;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Thao tác workflow PGD trả về HTTP ${response.status}`);
  }
  return payload;
}

async function request(path: string, method = 'GET', body?: unknown): Promise<any> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return parseResponse(response);
}

export async function fetchPgdWorkflowTemplates(): Promise<PgdWorkflowTemplate[]> {
  const payload = await request('/api/pgd/workflow-templates');
  return Array.isArray(payload?.items) ? payload.items as PgdWorkflowTemplate[] : [];
}

export async function createPgdWorkflowTemplate(template: PgdWorkflowTemplate): Promise<PgdWorkflowTemplateMutationResponse> {
  return request('/api/pgd/workflow-templates', 'POST', { template }) as Promise<PgdWorkflowTemplateMutationResponse>;
}

export async function updatePgdWorkflowTemplate(templateId: string, template: PgdWorkflowTemplate, expectedUpdatedAt?: string): Promise<PgdWorkflowTemplateMutationResponse> {
  return request(`/api/pgd/workflow-templates/${encodeURIComponent(templateId)}`, 'PUT', { template, ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}) }) as Promise<PgdWorkflowTemplateMutationResponse>;
}

export async function createPgdWorkflowRevision(templateId: string, template: PgdWorkflowTemplate): Promise<PgdWorkflowTemplateMutationResponse> {
  return request(`/api/pgd/workflow-templates/${encodeURIComponent(templateId)}/revisions`, 'POST', { template }) as Promise<PgdWorkflowTemplateMutationResponse>;
}

export async function publishPgdWorkflowTemplate(templateId: string): Promise<PgdWorkflowTemplateMutationResponse> {
  return request(`/api/pgd/workflow-templates/${encodeURIComponent(templateId)}/publish`, 'POST') as Promise<PgdWorkflowTemplateMutationResponse>;
}

export async function retirePgdWorkflowTemplate(templateId: string, reason: string): Promise<PgdWorkflowTemplateMutationResponse> {
  return request(`/api/pgd/workflow-templates/${encodeURIComponent(templateId)}/retire`, 'POST', { reason: reason.trim() }) as Promise<PgdWorkflowTemplateMutationResponse>;
}
