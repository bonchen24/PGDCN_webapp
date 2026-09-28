import { CustomerRef } from '@/types';
import { normalizeCustomerRecord } from '@/utils/customerRecord';
import { getPcnDocumentId } from '@/utils/pcnStorePolicy';
import {
  loadPcnCustomersForImport,
  buildPcnCustomerImportPreviewData,
  getPcnCustomerImportTargetHash,
  applyPcnCustomerImport,
  requirePcnImportBackup,
} from '@/utils/pcnCustomerImportService';
import { buildPcnCustomerMigrationPreview } from '@/utils/pcnCustomerMigration';
import { PcnCustomerImportApplyInput } from '@/utils/pcnCustomerImportContract';
import { stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';

export const PCN_CUSTOMER_BUSINESS_FIELDS = [
  'name',
  'address',
  'customerCode',
  'taxId',
  'phone',
  'email',
  'contactPerson',
] as const;

export function getPcnCustomerBusinessPayload(customer: CustomerRef): Record<string, string> {
  return Object.fromEntries(
    PCN_CUSTOMER_BUSINESS_FIELDS.map((field) => [field, String(customer[field] || '').trim()])
  );
}

export function samePcnCustomerBusiness(left: CustomerRef, right: CustomerRef): boolean {
  return (
    JSON.stringify(getPcnCustomerBusinessPayload(left)) ===
    JSON.stringify(getPcnCustomerBusinessPayload(right))
  );
}

export function readPcnCustomerImportRequest(body: any): {
  sourceLabel: string;
  customers: unknown[];
  aliasDecisions: unknown[];
} {
  const sourceLabel = String(body?.sourceLabel || '').trim();
  const customers = body?.customers;
  const aliasDecisions = body?.aliasDecisions === undefined ? [] : body.aliasDecisions;
  if (!sourceLabel || sourceLabel.length > 160 || /[\\/]/.test(sourceLabel)) {
    throw Object.assign(new Error('Tên file nguồn khách hàng không hợp lệ.'), { statusCode: 400 });
  }
  if (!Array.isArray(customers) || customers.length === 0 || customers.length > 5000) {
    throw Object.assign(new Error('Nguồn khách hàng phải có từ 1 đến 5.000 dòng.'), { statusCode: 400 });
  }
  if (!Array.isArray(aliasDecisions) || aliasDecisions.length > 5000) {
    throw Object.assign(new Error('Quyết định alias không hợp lệ.'), { statusCode: 400 });
  }
  return { sourceLabel, customers, aliasDecisions };
}

export {
  normalizeCustomerRecord,
  getPcnDocumentId,
  loadPcnCustomersForImport,
  buildPcnCustomerImportPreviewData,
  getPcnCustomerImportTargetHash,
  applyPcnCustomerImport,
  requirePcnImportBackup,
  buildPcnCustomerMigrationPreview,
  stablePcnMutationId,
};
export type { PcnCustomerImportApplyInput };
