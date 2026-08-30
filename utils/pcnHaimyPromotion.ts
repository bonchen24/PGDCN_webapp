// Author: Codex
// OS support: Web/Node
// Description: Pure policy for explicitly promoting reviewed Haimy staging into a PCN intake pair

import type {
  CertificationDossier,
  CertificationProposal,
  PcnHaimyPromotionMetadata,
  PcnHaimyStagingRecord,
  PcnProposalChannel,
  PcnCertificationMethod,
} from '../types.ts';
import { validatePcnProposalIntake, type PcnIntakeValidationIssue } from './pcnIntakePolicy.ts';

export interface PcnHaimyPromotionInput {
  proposalCode?: string;
  channel?: PcnProposalChannel;
  customerAddress?: string;
  contactPerson?: string;
  taxId?: string;
  phone?: string;
  email?: string;
  warehouseAddress?: string;
  productType?: string;
  specifications?: string;
  manufacturer?: string;
  manufacturerAddress?: string;
  method?: PcnCertificationMethod;
}

export interface PcnHaimyPromotionDraft {
  valid: boolean;
  issues: PcnIntakeValidationIssue[];
  fingerprint: string;
  proposal?: CertificationProposal;
  dossier?: CertificationDossier;
}

const CHANNELS = new Set<PcnProposalChannel>(['DIRECT', 'EMAIL', 'ONLINE_ZALO', 'OTHER']);
const METHODS = new Set<PcnCertificationMethod>(['METHOD_1', 'METHOD_5', 'METHOD_7']);

function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

/** A deterministic browser-safe digest for idempotency namespacing, not a security checksum. */
function stableDigest(value: string): string {
  let left = 2166136261;
  let right = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left ^= code;
    left = Math.imul(left, 16777619);
    right ^= code + index;
    right = Math.imul(right, 3266489917);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

function promotionMetadata(staging: PcnHaimyStagingRecord, proposalId: string, dossierId: string, fingerprint: string, now: string): PcnHaimyPromotionMetadata {
  return {
    proposalId,
    dossierId,
    promotedAt: now,
    promotionFingerprint: fingerprint,
  };
}

function addIssue(issues: PcnIntakeValidationIssue[], field: string, message: string): void {
  issues.push({ field, message });
}

function normalizedInput(input: PcnHaimyPromotionInput): Record<string, string> {
  return {
    proposalCode: text(input.proposalCode),
    channel: text(input.channel).toUpperCase() || 'OTHER',
    customerAddress: text(input.customerAddress),
    contactPerson: text(input.contactPerson),
    taxId: text(input.taxId),
    phone: text(input.phone),
    email: text(input.email),
    warehouseAddress: text(input.warehouseAddress),
    productType: text(input.productType),
    specifications: text(input.specifications),
    manufacturer: text(input.manufacturer),
    manufacturerAddress: text(input.manufacturerAddress),
    method: text(input.method).toUpperCase() || 'METHOD_1',
  };
}

export function buildPcnHaimyPromotionFingerprint(staging: PcnHaimyStagingRecord, input: PcnHaimyPromotionInput): string {
  const normalized = normalizedInput(input);
  return stableDigest(JSON.stringify({
    staging: {
      idempotencyKey: staging.idempotencyKey,
      sourcePayloadFingerprint: staging.sourcePayloadFingerprint,
      batchId: staging.batchId,
      externalRegistrationId: staging.externalRegistrationId || '',
      externalBatchId: staging.externalBatchId || '',
      externalCertificateId: staging.externalCertificateId || '',
      registrationCode: staging.registrationCode || '',
      customerName: staging.customerName || '',
      productName: staging.productName || '',
      model: staging.model || '',
      brand: staging.brand || '',
      fieldCode: staging.fieldCode || '',
      quantity: staging.quantity ?? '',
    },
    input: normalized,
  }));
}

export function buildPcnHaimyPromotionDraft(
  staging: PcnHaimyStagingRecord,
  input: PcnHaimyPromotionInput,
  now = new Date().toISOString(),
): PcnHaimyPromotionDraft {
  const normalized = normalizedInput(input);
  const fingerprint = buildPcnHaimyPromotionFingerprint(staging, input);
  const issues: PcnIntakeValidationIssue[] = [];

  if (staging.status !== 'READY_FOR_REVIEW') {
    addIssue(issues, 'staging.status', 'Chỉ bản ghi Haimy ở trạng thái Sẵn sàng rà soát mới được duyệt vào PCN.');
  }
  if (!text(staging.customerName)) addIssue(issues, 'staging.customerName', 'Staging Haimy thiếu tên khách hàng.');
  if (!text(staging.productName)) addIssue(issues, 'staging.productName', 'Staging Haimy thiếu tên sản phẩm.');
  if (!text(staging.model)) addIssue(issues, 'staging.model', 'Staging Haimy thiếu model; cần bổ sung/đối chiếu trước khi duyệt.');
  if (!text(staging.brand)) addIssue(issues, 'staging.brand', 'Staging Haimy thiếu nhãn hiệu; cần bổ sung/đối chiếu trước khi duyệt.');
  if (!text(staging.fieldCode)) addIssue(issues, 'staging.fieldCode', 'Staging Haimy thiếu mã lĩnh vực.');
  if (!Number.isInteger(staging.quantity) || Number(staging.quantity) < 1) addIssue(issues, 'staging.quantity', 'Staging Haimy phải có số lượng mẫu là số nguyên dương.');
  if (!CHANNELS.has(normalized.channel as PcnProposalChannel)) addIssue(issues, 'channel', 'Kênh tiếp nhận PCN không hợp lệ.');
  if (!METHODS.has(normalized.method as PcnCertificationMethod)) addIssue(issues, 'method', 'Phương thức chứng nhận PCN không hợp lệ.');

  const proposalId = `pcn-proposal-haimy-${stableDigest(staging.idempotencyKey)}`;
  const dossierId = `pcn-dossier-haimy-${stableDigest(staging.idempotencyKey)}`;
  const proposalCode = normalized.proposalCode || text(staging.registrationCode) || text(staging.externalRegistrationId) || `HAIMY-${stableDigest(staging.idempotencyKey).slice(0, 12).toUpperCase()}`;
  const origin = {
    provider: 'HAIMY' as const,
    stagingIdempotencyKey: staging.idempotencyKey,
    batchId: staging.batchId,
    ...(staging.externalRegistrationId ? { externalRegistrationId: staging.externalRegistrationId } : {}),
    ...(staging.externalBatchId ? { externalBatchId: staging.externalBatchId } : {}),
    ...(staging.externalCertificateId ? { externalCertificateId: staging.externalCertificateId } : {}),
  };
  const proposal: CertificationProposal = {
    id: proposalId,
    proposalCode,
    channel: normalized.channel as PcnProposalChannel,
    status: 'CONVERTED',
    dossierId,
    customerSnapshot: {
      name: text(staging.customerName),
      address: normalized.customerAddress,
      ...(normalized.taxId ? { taxId: normalized.taxId } : {}),
      ...(normalized.phone ? { phone: normalized.phone } : {}),
      ...(normalized.email ? { email: normalized.email } : {}),
      ...(normalized.contactPerson ? { contactPerson: normalized.contactPerson } : {}),
    },
    warehouseAddress: normalized.warehouseAddress,
    productName: text(staging.productName),
    model: text(staging.model),
    brand: text(staging.brand),
    productType: normalized.productType,
    specifications: normalized.specifications,
    manufacturer: normalized.manufacturer,
    ...(normalized.manufacturerAddress ? { manufacturerAddress: normalized.manufacturerAddress } : {}),
    quantity: Number(staging.quantity),
    fieldCodes: [text(staging.fieldCode).toUpperCase()],
    receivedAt: now,
    createdAt: now,
    updatedAt: now,
    haimyOrigin: origin,
  };
  const dossier: CertificationDossier = {
    id: dossierId,
    dossierCode: `HS-HAIMY-${stableDigest(staging.idempotencyKey).slice(0, 12).toUpperCase()}`,
    proposalId,
    customerSnapshot: proposal.customerSnapshot,
    fieldCodes: proposal.fieldCodes,
    method: normalized.method as PcnCertificationMethod,
    status: 'INTAKE_REVIEW',
    labRequestIds: [],
    returnedResultIds: [],
    createdAt: now,
    updatedAt: now,
    haimyOrigin: origin,
  };

  const intakeValidation = validatePcnProposalIntake(proposal);
  issues.push(...intakeValidation.issues);
  if (issues.length > 0) return { valid: false, issues, fingerprint };
  return { valid: true, issues: [], fingerprint, proposal, dossier };
}

export function buildPcnHaimyPromotionMetadata(
  staging: PcnHaimyStagingRecord,
  draft: PcnHaimyPromotionDraft,
  now: string,
  promotedBy?: string,
): PcnHaimyPromotionMetadata {
  if (!draft.proposal || !draft.dossier) throw new Error('Không thể tạo metadata promotion từ draft không hợp lệ.');
  return {
    ...promotionMetadata(staging, draft.proposal.id, draft.dossier.id, draft.fingerprint, now),
    ...(promotedBy ? { promotedBy } : {}),
  };
}

// --- End of pcnHaimyPromotion.ts ---
