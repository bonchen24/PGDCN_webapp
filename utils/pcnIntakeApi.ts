import type { ActivityLog, CertificationDossier, CertificationProposal, PcnDossierDocument, PcnDossierWorkflowTask } from '../types.ts';
import type { PcnIntakeValidationIssue } from './pcnIntakePolicy.ts';

export interface PcnIntakeResponse {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  dossierDocuments?: PcnDossierDocument[];
  workflowTasks?: PcnDossierWorkflowTask[];
  activityLogs?: ActivityLog[];
  idempotent?: boolean;
}

export class PcnIntakeApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly issues: PcnIntakeValidationIssue[];

  constructor(message: string, status: number, code?: string, issues: PcnIntakeValidationIssue[] = []) {
    super(message);
    this.name = 'PcnIntakeApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function buildPcnIntakeApiError(payload: unknown, status: number): PcnIntakeApiError {
  const record = isRecord(payload) ? payload : {};
  const issues = Array.isArray(record.issues)
    ? record.issues
      .filter((issue): issue is { field: string; message: string } => isRecord(issue) && typeof issue.field === 'string' && typeof issue.message === 'string')
      .map((issue) => ({ field: issue.field.trim(), message: issue.message.trim() }))
      .filter((issue) => issue.field && issue.message)
    : [];
  const message = typeof payload === 'string'
    ? payload
    : typeof record.error === 'string'
      ? record.error
      : typeof record.message === 'string'
        ? record.message
        : `PCN intake API trả về HTTP ${status}`;
  const code = typeof record.code === 'string' && record.code.trim() ? record.code.trim() : undefined;
  return new PcnIntakeApiError(message, status, code, issues);
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw buildPcnIntakeApiError(payload, response.status);
  }
  return payload;
}

export async function createPcnIntake(
  proposal: CertificationProposal,
  dossier: CertificationDossier,
  workflowTemplateSelection?: { id: string; version: number },
): Promise<PcnIntakeResponse> {
  const response = await fetch('/api/pcn/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ proposal, dossier, workflowTemplateSelection }),
  });
  return parseResponse(response) as Promise<PcnIntakeResponse>;
}

// --- End of pcnIntakeApi.ts ---
