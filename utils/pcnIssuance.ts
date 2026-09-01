import type { CertificationDossier, IssuancePackage, PcnApprovalStep, PcnOfficialDocumentKind, PcnTemplateDefinition, ReturnedTestResult } from '../types.ts';
import type { PcnDossierDocumentContext } from './pcnDocumentGeneration.ts';
import { buildPcnOfficialTemplateData, getPcnOfficialGenerationReadiness } from './pcnOfficialTemplatePolicy.ts';
import { selectPcnOfficialTemplate } from './pcnOfficialDocumentPolicy.ts';
import { getPcnTemplateCode } from './pcnWorkflow.ts';
import { isPcnApprovalComplete } from './pcnApproval.ts';
import { normalizePcnIssuanceTimestamp, normalizePcnUtcTimestamp } from './pcnDossierDate.ts';

export interface PcnIssuanceDraft {
  id: string;
  dossier: Pick<CertificationDossier, 'id' | 'method'>;
  now?: string;
  fileAssetIds?: string[];
}

export interface PcnIssuanceReadiness {
  ready: boolean;
  reasons: string[];
}

export function buildPcnIssuancePackage(input: PcnIssuanceDraft): IssuancePackage {
  const id = String(input.id || '').trim();
  const dossierId = String(input.dossier?.id || '').trim();
  if (!id || !dossierId) throw new Error('Bộ phát hành phải có mã và hồ sơ PCN');
  return {
    id,
    dossierId,
    certificateTemplateCode: getPcnTemplateCode(input.dossier.method, 'CERTIFICATE'),
    decisionTemplateCode: getPcnTemplateCode(input.dossier.method, 'DECISION'),
    documentType: 'CERTIFICATE',
    status: 'DRAFT',
    approvalStepIds: [],
    fileAssetIds: [...(input.fileAssetIds || [])],
    createdAt: input.now || new Date().toISOString(),
    updatedAt: input.now || new Date().toISOString(),
  };
}

export function getPcnIssuanceReadiness(
  dossier: Pick<CertificationDossier, 'status'>,
  results: ReturnedTestResult[],
  approvalSteps: PcnApprovalStep[],
): PcnIssuanceReadiness {
  const reasons: string[] = [];
  if (dossier.status !== 'APPROVED') reasons.push('Hồ sơ chưa được phê duyệt đầy đủ');
  if (!isPcnApprovalComplete(approvalSteps)) reasons.push('Chuỗi phê duyệt chưa hoàn tất');
  const candidateResults = results.filter((result) => result.isOfficial !== false);
  const officialResults = candidateResults.filter((result) => result.outcome !== 'PENDING');
  if (!officialResults.some((result) => result.outcome === 'PASS')) reasons.push('Chưa có KQTN chính thức đạt');
  if (candidateResults.some((result) => result.outcome === 'PENDING')) reasons.push('Còn KQTN đang chờ bổ sung');
  return { ready: reasons.length === 0, reasons };
}

export function getPcnIssuanceOfficialDocumentReadiness(input: {
  context: PcnDossierDocumentContext;
  issuance: Pick<IssuancePackage, 'issuanceNumber' | 'issuedAt' | 'signerUsername'>;
  templates: PcnTemplateDefinition[];
  fieldCodes: string[];
  privateTemplateAssetIds?: Iterable<string>;
  documentKinds?: PcnOfficialDocumentKind[];
}): PcnIssuanceReadiness {
  const reasons: string[] = [];
  const documentKinds = input.documentKinds || ['CERTIFICATE', 'DECISION'];
  const privateTemplateAssetIds = input.privateTemplateAssetIds ? new Set(Array.from(input.privateTemplateAssetIds).map((id) => String(id).trim()).filter(Boolean)) : undefined;
  for (const documentKind of documentKinds) {
    const template = selectPcnOfficialTemplate(input.templates, input.fieldCodes, input.context.method, documentKind);
    if (!template) {
      reasons.push(`${documentKind}: TEMPLATE_MISSING`);
      continue;
    }
    if (privateTemplateAssetIds && (!template.fileAssetId || !privateTemplateAssetIds.has(template.fileAssetId))) {
      reasons.push(`${documentKind}: MISSING_PRIVATE_ASSET`);
    }
    const data = buildPcnOfficialTemplateData({ context: input.context, issuance: input.issuance, documentKind });
    const readiness = getPcnOfficialGenerationReadiness(template, data);
    reasons.push(...readiness.reasons.map((reason) => `${documentKind}: ${reason}`));
  }
  return { ready: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function approvePcnIssuancePackage(issuance: IssuancePackage, now: string = new Date().toISOString()): IssuancePackage {
  if (!['DRAFT', 'RETURNED', 'PENDING_APPROVAL'].includes(issuance.status)) {
    throw new Error('Bộ phát hành không ở trạng thái chờ phê duyệt');
  }
  return { ...issuance, status: 'APPROVED', updatedAt: now };
}

export function issuePcnIssuancePackage(
  issuance: IssuancePackage,
  input: { issuanceNumber: string; signerUsername: string; issuedAt?: string },
): IssuancePackage {
  if (issuance.status !== 'APPROVED') throw new Error('Chỉ được cấp số sau khi bộ phát hành đã phê duyệt');
  const issuanceNumber = String(input.issuanceNumber || '').trim();
  const signerUsername = String(input.signerUsername || '').trim();
  if (!issuanceNumber || !signerUsername) throw new Error('Cấp số phát hành phải có số và người ký');
  const issuedAt = normalizePcnIssuanceTimestamp(input.issuedAt || new Date().toISOString());
  return { ...issuance, status: 'ISSUED', issuanceNumber, signerUsername, issuedAt, updatedAt: issuedAt };
}

export function getPcnIssuanceGenericMutationDenial(
  input: Pick<Partial<IssuancePackage>, 'status'>,
): string | null {
  if (input.status === 'ISSUED') {
    return 'Bộ phát hành PCN chỉ được cấp số qua endpoint chuyên biệt để kiểm tra người ký và điều kiện phát hành.';
  }
  return null;
}

export function deliverPcnIssuancePackage(
  issuance: IssuancePackage,
  input: { recipient: string; deliveredAt?: string; note?: string },
): IssuancePackage {
  if (issuance.status !== 'ISSUED') throw new Error('Chỉ được ghi nhận giao khách hàng sau khi đã phát hành');
  const recipient = String(input.recipient || '').trim();
  if (!recipient) throw new Error('Giao khách hàng phải có người hoặc đơn vị nhận');
  const deliveredAt = normalizePcnUtcTimestamp('Ngày giao', input.deliveredAt || new Date().toISOString());
  const note = String(input.note || '').trim();
  return {
    ...issuance,
    status: 'DELIVERED',
    deliveryRecipient: recipient,
    ...(note ? { deliveryNote: note } : {}),
    deliveredAt,
    updatedAt: deliveredAt,
  };
}

export function archivePcnIssuancePackage(
  issuance: IssuancePackage,
  archivedAt: string = new Date().toISOString(),
): IssuancePackage {
  if (issuance.status !== 'DELIVERED') throw new Error('Chỉ được lưu trữ sau khi đã giao khách hàng');
  return { ...issuance, status: 'ARCHIVED', archivedAt, updatedAt: archivedAt };
}

// --- End of pcnIssuance.ts ---
