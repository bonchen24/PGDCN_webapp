// Author: Codex
// OS support: Web/Node
// Description: Pure canonical-data builder for human review of imported PCN dossiers

import type {
  CertificationDossier,
  CertificationProposal,
  PcnCertificationMethod,
} from '../types.ts';

export interface PcnHistoricalReviewInput {
  customerName: string;
  customerAddress: string;
  customerTaxId?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerContactPerson?: string;
  productName: string;
  model?: string;
  brand?: string;
  manufacturer?: string;
  manufacturerAddress?: string;
  method: PcnCertificationMethod;
}

export interface PcnHistoricalReviewResult {
  proposal: CertificationProposal;
  dossier: CertificationDossier;
}

const VALID_METHODS = new Set<PcnCertificationMethod>(['METHOD_1', 'METHOD_5', 'METHOD_7']);

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function optionalValue(next: unknown, previous: unknown): string | undefined {
  const value = clean(next);
  if (value) return value;
  const fallback = clean(previous);
  return fallback || undefined;
}

function isUnresolvedProduct(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return !normalized || ['san pham theo ho so', 'chua xac dinh', 'unknown', 'n a', 'na'].includes(normalized);
}

function buildUnresolvedFields(
  proposal: CertificationProposal,
  dossier: CertificationDossier,
  input: PcnHistoricalReviewInput,
  productName: string,
): string[] {
  const unresolved = new Set([
    ...(proposal.historicalImport?.unresolvedFields || []),
    ...(dossier.historicalImport?.unresolvedFields || []),
  ]);
  if (isUnresolvedProduct(productName)) unresolved.add('productName');
  else unresolved.delete('productName');

  if (VALID_METHODS.has(input.method)) unresolved.delete('method');
  else unresolved.add('method');

  return Array.from(unresolved).sort((left, right) => left.localeCompare(right));
}

export function buildPcnHistoricalReview(
  proposal: CertificationProposal,
  dossier: CertificationDossier,
  input: PcnHistoricalReviewInput,
  reviewedAt: string = new Date().toISOString(),
): PcnHistoricalReviewResult {
  if (!proposal.historicalImport && !dossier.historicalImport) {
    throw new Error('Chỉ hồ sơ nhập lịch sử mới có thể rà soát theo luồng này.');
  }
  if (proposal.dossierId && proposal.dossierId !== dossier.id) {
    throw new Error('Đề nghị và hồ sơ không liên kết với nhau.');
  }
  if (dossier.proposalId !== proposal.id) {
    throw new Error('Hồ sơ không liên kết ngược về Đề nghị.');
  }

  const previousCustomer = dossier.customerSnapshot || proposal.customerSnapshot || { name: '', address: '' };
  const customerSnapshot = {
    name: clean(input.customerName) || clean(previousCustomer.name),
    address: clean(input.customerAddress) || clean(previousCustomer.address),
    ...(optionalValue(input.customerTaxId, previousCustomer.taxId) ? { taxId: optionalValue(input.customerTaxId, previousCustomer.taxId) } : {}),
    ...(optionalValue(input.customerPhone, previousCustomer.phone) ? { phone: optionalValue(input.customerPhone, previousCustomer.phone) } : {}),
    ...(optionalValue(input.customerEmail, previousCustomer.email) ? { email: optionalValue(input.customerEmail, previousCustomer.email) } : {}),
    ...(optionalValue(input.customerContactPerson, previousCustomer.contactPerson) ? { contactPerson: optionalValue(input.customerContactPerson, previousCustomer.contactPerson) } : {}),
  };
  const productName = clean(input.productName) || clean(proposal.productName);
  const method = VALID_METHODS.has(input.method) ? input.method : dossier.method;
  const unresolvedFields = buildUnresolvedFields(proposal, dossier, input, productName);
  const historicalImport = {
    ...(proposal.historicalImport || dossier.historicalImport!),
    reviewStatus: 'REVIEWED' as const,
    unresolvedFields,
  };

  const nextProposal: CertificationProposal = {
    ...proposal,
    customerSnapshot,
    productName,
    ...(clean(input.model) || clean(proposal.model) ? { model: clean(input.model) || clean(proposal.model) } : {}),
    ...(clean(input.brand) || clean(proposal.brand) ? { brand: clean(input.brand) || clean(proposal.brand) } : {}),
    ...(clean(input.manufacturer) || clean(proposal.manufacturer) ? { manufacturer: clean(input.manufacturer) || clean(proposal.manufacturer) } : {}),
    ...(clean(input.manufacturerAddress) || clean(proposal.manufacturerAddress) ? { manufacturerAddress: clean(input.manufacturerAddress) || clean(proposal.manufacturerAddress) } : {}),
    updatedAt: reviewedAt,
    historicalImport,
  };
  const nextDossier: CertificationDossier = {
    ...dossier,
    customerSnapshot: { ...customerSnapshot },
    method,
    status: dossier.status,
    updatedAt: reviewedAt,
    historicalImport: { ...historicalImport },
  };
  return { proposal: nextProposal, dossier: nextDossier };
}

// --- End of pcnHistoricalReview.ts ---
