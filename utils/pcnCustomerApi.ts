// Author: Codex
// OS support: Web
// Description: Same-origin API clients for atomic PCN customer mutations

import type { ActivityLog, CustomerRef } from '../types.ts';

export interface PcnCustomerMutationResponse {
  customer?: CustomerRef;
  activityLog?: ActivityLog;
  idempotent?: boolean;
  deleted?: boolean;
  id: string;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `API khách hàng PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

async function request(path: string, init: RequestInit): Promise<PcnCustomerMutationResponse> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
  return parseResponse(response) as Promise<PcnCustomerMutationResponse>;
}

export function createPcnCustomer(customer: Partial<CustomerRef>): Promise<PcnCustomerMutationResponse> {
  return request('/api/pcn/customers', { method: 'POST', body: JSON.stringify({ customer }) });
}

export function updatePcnCustomer(customerId: string, customer: Partial<CustomerRef>): Promise<PcnCustomerMutationResponse> {
  return request(`/api/pcn/customers/${encodeURIComponent(customerId)}`, { method: 'POST', body: JSON.stringify({ customer }) });
}

export function deletePcnCustomer(customerId: string): Promise<PcnCustomerMutationResponse> {
  return request(`/api/pcn/customers/${encodeURIComponent(customerId)}`, { method: 'DELETE' });
}

// --- End of pcnCustomerApi.ts ---
