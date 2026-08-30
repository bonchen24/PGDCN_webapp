import type {
  PcnCustomerImportApplyInput,
  PcnCustomerImportApplyResponse,
  PcnCustomerImportPreviewResponse,
} from './pcnCustomerImportContract.ts';

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `API nhập khách hàng PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

function requestHeaders(): HeadersInit {
  return { 'content-type': 'application/json' };
}

export async function previewPcnCustomerImport(
  sourceLabel: string,
  customers: unknown[],
): Promise<PcnCustomerImportPreviewResponse> {
  const response = await fetch('/api/pcn/customer-import/preview', {
    method: 'POST',
    credentials: 'same-origin',
    headers: requestHeaders(),
    body: JSON.stringify({ sourceLabel, customers }),
  });
  return parseResponse(response);
}

export async function applyPcnCustomerImport(
  input: PcnCustomerImportApplyInput,
): Promise<PcnCustomerImportApplyResponse> {
  const response = await fetch('/api/pcn/customer-import/apply', {
    method: 'POST',
    credentials: 'same-origin',
    headers: requestHeaders(),
    body: JSON.stringify(input),
  });
  return parseResponse(response);
}

// --- End of pcnCustomerImportApi.ts ---
