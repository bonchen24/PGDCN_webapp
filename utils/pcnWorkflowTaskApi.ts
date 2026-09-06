import type { ActivityLog, PcnDossierWorkflowTask } from '../types.ts';

export interface PcnWorkflowTaskMutationResponse {
  task: PcnDossierWorkflowTask;
  tasks?: PcnDossierWorkflowTask[];
  activityLog?: ActivityLog;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Thao tác task workflow trả về HTTP ${response.status}`);
  }
  return payload;
}

async function mutateTask(dossierId: string, taskId: string, action: 'start' | 'complete' | 'return', body?: unknown): Promise<PcnWorkflowTaskMutationResponse> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(dossierId)}/workflow-tasks/${encodeURIComponent(taskId)}/${action}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return parseResponse(response) as Promise<PcnWorkflowTaskMutationResponse>;
}

export async function fetchPcnWorkflowTasks(dossierId: string): Promise<PcnDossierWorkflowTask[]> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(dossierId)}/workflow-tasks`, { credentials: 'same-origin' });
  const payload = await parseResponse(response);
  return Array.isArray(payload?.items) ? payload.items as PcnDossierWorkflowTask[] : [];
}

export function startPcnWorkflowTask(dossierId: string, taskId: string): Promise<PcnWorkflowTaskMutationResponse> {
  return mutateTask(dossierId, taskId, 'start');
}

export function completePcnWorkflowTask(dossierId: string, taskId: string): Promise<PcnWorkflowTaskMutationResponse> {
  return mutateTask(dossierId, taskId, 'complete');
}

export function returnPcnWorkflowTask(dossierId: string, taskId: string, input: { targetNodeId: string; reason: string }): Promise<PcnWorkflowTaskMutationResponse> {
  return mutateTask(dossierId, taskId, 'return', input);
}

// --- End of pcnWorkflowTaskApi.ts ---
