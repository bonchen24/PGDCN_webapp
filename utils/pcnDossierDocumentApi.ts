import type { ActivityLog, CertificationDossier, PcnCertificationFieldCode, PcnDocumentRequirement, PcnDossierAttachment, PcnDossierDocument, PcnGeneratedDocument } from '../types.ts';
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
    ...(payload.activityLog ? { activityLog: payload.activityLog as ActivityLog } : {}),
  };
}

// --- End of pcnDossierDocumentApi.ts ---
