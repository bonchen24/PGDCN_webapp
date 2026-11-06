import type { ActivityLog, CertificationDossier, CertificationProposal } from '../types.ts';

export type PcnProposalUpdateInput = Partial<Pick<
  CertificationProposal,
  | 'channel'
  | 'customerId'
  | 'registrationNumber'
  | 'registrationDate'
  | 'standards'
  | 'productGroup'
  | 'warehouseAddress'
  | 'productName'
  | 'productType'
  | 'model'
  | 'brand'
  | 'specifications'
  | 'manufacturer'
  | 'manufacturerAddress'
  | 'quantity'
>> & {
  customerSnapshot?: Partial<CertificationProposal['customerSnapshot']>;
};

export interface PcnProposalMutationResponse {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
  activityLogs?: ActivityLog[];
  idempotent?: boolean;
}
async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    throw new Error(message || `Cập nhật Đề nghị PCN trả về HTTP ${response.status}`);
  }
  return payload;
}

function createIdempotencyKey(): string {
  return `proposal-update-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export async function updatePcnProposal(
  proposalId: string,
  updates: PcnProposalUpdateInput,
  idempotencyKey = createIdempotencyKey(),
): Promise<PcnProposalMutationResponse> {
  const response = await fetch(`/api/pcn/proposals/${encodeURIComponent(proposalId)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ updates, idempotencyKey }),
  });
  return parseResponse(response) as Promise<PcnProposalMutationResponse>;
}
