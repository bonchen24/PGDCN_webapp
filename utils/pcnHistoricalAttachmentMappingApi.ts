import type { ActivityLog, CertificationDossier, PcnDossierAttachment, PcnDossierDocument } from '../types.ts';

export interface PcnHistoricalAttachmentMappingResponse {
  dossier: CertificationDossier;
  attachment: PcnDossierAttachment;
  documents: PcnDossierDocument[];
  activityLogs: ActivityLog[];
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Nối tệp lịch sử PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function mapPcnHistoricalAttachment(dossierId: string, attachmentId: string, requirementId: string): Promise<PcnHistoricalAttachmentMappingResponse> {
  const response = await fetch('/api/pcn/historical-attachment-mapping', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dossierId, attachmentId, requirementId }),
  });
  return parseResponse(response) as Promise<PcnHistoricalAttachmentMappingResponse>;
}
