import type { PcnUserAccount } from '../types.ts';

interface PcnSessionResponse {
  authenticated: boolean;
  user: PcnUserAccount;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PCN session trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function establishPcnSession(username: string, password: string): Promise<PcnSessionResponse> {
  const response = await fetch('/api/auth/pcn-session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: String(username || '').trim(), password: String(password || '') }),
  });
  return parseResponse(response) as Promise<PcnSessionResponse>;
}

export async function getPcnSession(): Promise<PcnSessionResponse | null> {
  const response = await fetch('/api/auth/pcn-session', { credentials: 'same-origin' });
  if (response.status === 401) return null;
  return parseResponse(response) as Promise<PcnSessionResponse>;
}

export async function clearPcnSession(): Promise<void> {
  const response = await fetch('/api/auth/pcn-session', {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  await parseResponse(response);
}

// --- End of pcnAuthApi.ts ---
