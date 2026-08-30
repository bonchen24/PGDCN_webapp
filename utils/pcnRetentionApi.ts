import type { ActivityLog, CertificationDossier } from '../types.ts';

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PCN retention API trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function updatePcnDossierRetention(
  dossierId: string,
  input: { legalHold: boolean; reason?: string },
): Promise<{ dossier: CertificationDossier; activityLog?: ActivityLog }> {
  const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(dossierId)}/retention`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseResponse(response);
}

// --- End of pcnRetentionApi.ts ---
