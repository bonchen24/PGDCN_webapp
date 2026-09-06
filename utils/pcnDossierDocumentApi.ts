import type { ActivityLog, CertificationDossier, PcnCertificationFieldCode, PcnDocumentRequirement, PcnDossierAttachment, PcnDossierDocument, PcnDossierWorkflowTask, PcnGeneratedDocument, PcnGeneratedDocumentKind } from '../types.ts';
import { buildPcnDossierDocumentId } from './pcnDossierDocuments.ts';
import { uploadPcnFile, type PcnFileAsset } from './pcnFileApi.ts';

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PCN dossier document API trả về HTTP ${response.status}`);
  }
  return payload;
}

export interface PcnDossierDocumentMutationResponse {
  document?: PcnDossierDocument;
  dossier?: CertificationDossier;
  attachment?: PcnDossierAttachment;
  asset?: PcnFileAsset;
  workflowTasks?: PcnDossierWorkflowTask[];
  activityLog?: ActivityLog;
}

async function mutateDossierDocumentBoundary(input: { dossierId: string; requirementId: string; action: 'waive' | 'remove-current'; reason?: string }): Promise<PcnDossierDocumentMutationResponse> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(input.dossierId)}/documents/${encodeURIComponent(input.requirementId)}/${input.action}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input.action === 'waive' ? { reason: input.reason } : {}),
  });
  return parseResponse(response) as Promise<PcnDossierDocumentMutationResponse>;
}

export function waivePcnDossierDocument(input: { dossierId: string; requirementId: string; reason: string }): Promise<PcnDossierDocumentMutationResponse> {
  return mutateDossierDocumentBoundary({ ...input, action: 'waive' });
}

export function removeCurrentPcnDossierDocument(input: { dossierId: string; requirementId: string }): Promise<PcnDossierDocumentMutationResponse> {
  return mutateDossierDocumentBoundary({ ...input, action: 'remove-current' });
}

export async function generateAndAttachPcnDossierNodeDocument(input: {
  dossierId: string;
  nodeId: string;
  requirementId: string;
  kind?: PcnGeneratedDocumentKind;
}): Promise<PcnDossierDocumentMutationResponse & { generated?: PcnGeneratedDocument }> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(input.dossierId)}/node-work/${encodeURIComponent(input.nodeId)}/generate-and-attach`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requirementId: input.requirementId, ...(input.kind ? { kind: input.kind } : {}) }),
  });
  return parseResponse(response) as Promise<PcnDossierDocumentMutationResponse & { generated?: PcnGeneratedDocument }>;
}

export async function fetchPcnDocumentRequirements(fieldCodes: PcnCertificationFieldCode[]): Promise<PcnDocumentRequirement[]> {
  const response = await fetch(`/api/pcn/document-requirements?fieldCodes=${encodeURIComponent(fieldCodes.join(','))}`, { cache: 'no-store' });
  const payload = await parseResponse(response);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function fetchPcnDossierDocuments(dossierId: string): Promise<PcnDossierDocument[]> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(dossierId)}/documents`, { cache: 'no-store' });
  const payload = await parseResponse(response);
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function uploadPcnDossierDocument(input: {
  dossierId: string;
  requirement: PcnDocumentRequirement;
  file: File;
  actorUsername?: string;
}): Promise<{
  document: PcnDossierDocument;
  asset: PcnFileAsset;
  dossier?: CertificationDossier;
  attachment?: PcnDossierAttachment;
  workflowTasks?: PcnDossierWorkflowTask[];
  activityLog?: ActivityLog;
}> {
  const documentId = buildPcnDossierDocumentId(input.dossierId, input.requirement.id);
  const asset = await uploadPcnFile({
    file: input.file,
    sourceCollection: 'dossierDocuments',
    sourceDocumentId: documentId,
    sourceJsonPath: input.requirement.id,
    actorUsername: input.actorUsername,
  });
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(input.dossierId)}/documents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requirementId: input.requirement.id,
      fieldCode: input.requirement.fieldCode,
      assetId: asset.id,
      fileName: input.file.name,
    }),
  });
  try {
    const payload = await parseResponse(response);
    return {
      document: payload.document as PcnDossierDocument,
      asset,
      ...(payload.dossier ? { dossier: payload.dossier as CertificationDossier } : {}),
      ...(payload.attachment ? { attachment: payload.attachment as PcnDossierAttachment } : {}),
      ...(Array.isArray(payload.workflowTasks) ? { workflowTasks: payload.workflowTasks as PcnDossierWorkflowTask[] } : {}),
      ...(payload.activityLog ? { activityLog: payload.activityLog as ActivityLog } : {}),
    };
  } catch (error) {
    // The storage object is intentionally retained for audit/recovery if metadata commit fails.
    throw error;
  }
}

export async function confirmPcnGeneratedDocumentIntoChecklist(input: {
  dossierId: string;
  generated: PcnGeneratedDocument;
  requirement: PcnDocumentRequirement;
}): Promise<{
  document: PcnDossierDocument;
  asset: PcnFileAsset;
  dossier?: CertificationDossier;
  attachment?: PcnDossierAttachment;
  workflowTasks?: PcnDossierWorkflowTask[];
  activityLog?: ActivityLog;
}> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(input.dossierId)}/documents/confirm-generated`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ generatedDocumentId: input.generated.id, requirementId: input.requirement.id }),
  });
  const payload = await parseResponse(response);
  return {
    document: payload.document as PcnDossierDocument,
    asset: payload.asset as PcnFileAsset,
    ...(payload.dossier ? { dossier: payload.dossier as CertificationDossier } : {}),
    ...(payload.attachment ? { attachment: payload.attachment as PcnDossierAttachment } : {}),
    ...(Array.isArray(payload.workflowTasks) ? { workflowTasks: payload.workflowTasks as PcnDossierWorkflowTask[] } : {}),
    ...(payload.activityLog ? { activityLog: payload.activityLog as ActivityLog } : {}),
  };
}

// --- End of pcnDossierDocumentApi.ts ---
