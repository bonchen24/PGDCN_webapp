import type { PcnCutoverSnapshot } from './pcnCutoverVerification.ts';

export interface PcnCutoverStatusResponse {
  checkedAt: string;
  snapshot: PcnCutoverSnapshot;
  ok: boolean;
  errors: string[];
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Cutover API trả về HTTP ${response.status}`);
  }
  return payload;
}

export async function fetchPcnCutoverStatus(username: string): Promise<PcnCutoverStatusResponse> {
  const response = await fetch('/api/pcn/cutover-status', {
    headers: { 'x-user-name': username },
  });
  return parseResponse(response);
}

// --- End of pcnCutoverApi.ts ---
