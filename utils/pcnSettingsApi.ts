import type { PcnSettings } from '../types.ts';
import { normalizePcnSettings } from './pcnSettings.ts';

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : (payload as { error?: string; message?: string })?.error || (payload as { message?: string })?.message;
    throw new Error(message || `Cài đặt PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function fetchPcnSettings(): Promise<PcnSettings> {
  const response = await fetch('/api/pcn/settings', { credentials: 'same-origin' });
  const payload = await parseResponse(response) as { settings?: unknown };
  return normalizePcnSettings(payload.settings);
}

export async function updatePcnSettings(settings: PcnSettings): Promise<PcnSettings> {
  const response = await fetch('/api/pcn/settings', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  const payload = await parseResponse(response) as { settings?: unknown };
  return normalizePcnSettings(payload.settings);
}

// --- End of pcnSettingsApi.ts ---
