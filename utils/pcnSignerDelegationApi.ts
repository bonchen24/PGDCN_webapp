import type { PcnSignerDelegation } from '../types.ts';

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `PCN signer API trả về HTTP ${response.status}`);
  }
  return payload;
}

async function request(path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return parseResponse(response);
}

export type PcnSignerDelegationInput = Omit<PcnSignerDelegation, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'revokedAt' | 'revokedByUsername'>;

export async function fetchPcnSignerDelegations(): Promise<PcnSignerDelegation[]> {
  const payload = await request('/api/pcn/signer-delegations');
  return Array.isArray(payload?.items) ? payload.items : [];
}

export async function createPcnSignerDelegation(input: PcnSignerDelegationInput): Promise<{ delegation: PcnSignerDelegation; activityLog?: any }> {
  const payload = await request('/api/pcn/signer-delegations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload as { delegation: PcnSignerDelegation; activityLog?: any };
}

export async function revokePcnSignerDelegation(id: string): Promise<{ delegation: PcnSignerDelegation; activityLog?: any }> {
  const payload = await request(`/api/pcn/signer-delegations/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' });
  return payload as { delegation: PcnSignerDelegation; activityLog?: any };
}

export async function issuePcnIssuance(
  issuanceId: string,
  input: { issuanceNumber: string; signerUsername: string; issuedAt?: string },
  idempotencyKey = `issuance-issue-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`,
): Promise<{ issuance: any; dossier: any; authorization: { mode: 'DIRECT' | 'DELEGATED'; delegationId?: string }; activityLog?: any }> {
  const payload = await request(`/api/pcn/issuance/${encodeURIComponent(issuanceId)}/issue`, {
    method: 'POST',
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
  return payload;
}

// --- End of pcnSignerDelegationApi.ts ---
