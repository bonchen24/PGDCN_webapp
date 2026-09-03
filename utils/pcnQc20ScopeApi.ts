import type { PcnQc20ScopeConfiguration, PcnSettings } from '../types.ts';
import { normalizePcnSettings } from './pcnSettings.ts';
import { normalizePcnQc20ScopeConfiguration, type PcnQc20Readiness } from './pcnQc20ScopeGovernance.ts';

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : (payload as { error?: string; message?: string })?.error || (payload as { message?: string })?.message;
    throw new Error(message || `QC20 trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function confirmPcnQc20Scope(scopeConfiguration: PcnQc20ScopeConfiguration): Promise<PcnSettings> {
  const response = await fetch('/api/pcn/settings/qc20-scope/confirm', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scopeConfiguration }),
  });
  const payload = await parseResponse(response) as { settings?: unknown };
  return normalizePcnSettings(payload.settings);
}

export async function fetchPcnQc20Readiness(): Promise<PcnQc20Readiness> {
  const response = await fetch('/api/pcn/settings/qc20-readiness', { credentials: 'same-origin' });
  const payload = await parseResponse(response) as { readiness?: PcnQc20Readiness };
  return {
    ...(payload.readiness || {} as PcnQc20Readiness),
    scope: normalizePcnQc20ScopeConfiguration(payload.readiness?.scope),
  } as PcnQc20Readiness;
}

// --- End of utils/pcnQc20ScopeApi.ts ---
