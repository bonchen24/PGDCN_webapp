// Author: Codex
// OS support: Web
// Description: Same-origin client boundary for downloading a complete PCN dossier package

import { buildPcnDossierPackageDownloadName } from './pcnDossierPackage.ts';

export function getPcnDossierPackageUrl(dossierId: string): string {
  const cleanId = String(dossierId || '').trim();
  if (!cleanId) throw new Error('Thiếu mã hồ sơ PCN.');
  return `/api/pcn/dossiers/${encodeURIComponent(cleanId)}/package`;
}

async function parsePackageError(response: Response): Promise<never> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
  throw new Error(message || `Tải gói hồ sơ PCN trả về HTTP ${response.status}`);
}

export async function downloadPcnDossierPackage(dossierId: string, dossierCode?: string): Promise<void> {
  const response = await fetch(getPcnDossierPackageUrl(dossierId), {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) await parsePackageError(response);
  const blob = await response.blob();
  if (blob.size <= 0) throw new Error('Gói hồ sơ PCN rỗng.');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildPcnDossierPackageDownloadName(dossierCode || dossierId);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// --- End of pcnDossierPackageApi.ts ---
