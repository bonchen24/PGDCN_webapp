import type { PcnDraftFormKind, PcnDraftWorkspace, PcnGeneratedDocumentFormat } from '../types.ts';
import type { PcnDossierDocumentMutationResponse } from './pcnDossierDocumentApi.ts';

async function parse(response: Response): Promise<any> {
  const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) throw new Error(typeof payload === 'string' ? payload : payload?.error || `PCN draft API trả về HTTP ${response.status}`);
  return payload;
}

export async function fetchPcnDraftWorkspaces(): Promise<PcnDraftWorkspace[]> {
  const response = await fetch('/api/pcn/drafts', { credentials: 'same-origin' });
  return (await parse(response)).items || [];
}

export async function savePcnDraftWorkspace(input: Partial<PcnDraftWorkspace> & { formKind: PcnDraftFormKind; templateId: string; fieldCodes: string[]; values: Record<string, unknown> }): Promise<PcnDraftWorkspace> {
  const response = await fetch('/api/pcn/drafts', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  return (await parse(response)).draft as PcnDraftWorkspace;
}

export async function generatePcnDraftWorkspace(draftId: string, formats: PcnGeneratedDocumentFormat[] = ['DOCX', 'PDF']): Promise<PcnDraftWorkspace> {
  const response = await fetch(`/api/pcn/drafts/${encodeURIComponent(draftId)}/generate`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ formats }) });
  return (await parse(response)).draft as PcnDraftWorkspace;
}

export async function confirmPcnDraftOutput(input: { dossierId: string; draftId: string; outputId: string; requirementId: string; nodeId?: string }): Promise<PcnDossierDocumentMutationResponse> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(input.dossierId)}/documents/confirm-draft-output`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ draftId: input.draftId, outputId: input.outputId, requirementId: input.requirementId, ...(input.nodeId ? { nodeId: input.nodeId } : {}) }),
  });
  return parse(response) as Promise<PcnDossierDocumentMutationResponse>;
}
