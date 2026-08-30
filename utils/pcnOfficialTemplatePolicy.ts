// Author: Codex
// OS support: Web/Node
// Description: Browser-safe PCN official-template data and readiness policy

import type { IssuancePackage, PcnOfficialDocumentKind, PcnTemplateDefinition } from '../types.ts';
import { getPcnTemplateReadiness, getPcnTemplateRequiredPlaceholderKeys, type PcnTemplateReadinessReason } from './pcnTemplateCatalog.ts';
import type { PcnDossierDocumentContext } from './pcnDocumentGeneration.ts';

export type PcnOfficialGenerationReason = PcnTemplateReadinessReason | 'MISSING_REQUIRED_DATA' | 'HISTORICAL_REVIEW_INCOMPLETE';

export interface PcnOfficialGenerationReadiness {
  ready: boolean;
  reasons: PcnOfficialGenerationReason[];
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function formatAdministrativeDate(value?: string): string {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return '';
  return [date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear()]
    .map((part, index) => index === 2 ? String(part) : String(part).padStart(2, '0'))
    .join('/');
}

function getAllowedOverrides(documentKind: PcnOfficialDocumentKind, overrides?: Record<string, string | undefined>): Record<string, string> {
  if (documentKind !== 'SAMPLE_HANDOVER' || !overrides) return {};
  const allowedKeys = ['ngay_dk', 'ngay_lay_mau', 'so_ITD', 'ngay_ITD'];
  return Object.fromEntries(
    allowedKeys
      .filter((key) => overrides[key] !== undefined)
      .map((key) => [key, clean(overrides[key])]),
  );
}

export function buildPcnOfficialTemplateData(input: {
  context: PcnDossierDocumentContext;
  issuance: Pick<IssuancePackage, 'issuanceNumber' | 'issuedAt' | 'signerUsername'>;
  documentKind: PcnOfficialDocumentKind;
  overrides?: Record<string, string | undefined>;
}): Record<string, string> {
  const { context, issuance, documentKind } = input;
  const safeOverrides = getAllowedOverrides(documentKind, input.overrides);
  const shared: Record<string, string> = {
    loai_sp: clean(context.productName),
    ten_cong_ty: clean(context.customerName),
    dia_chi_ct: clean(context.customerAddress),
    so_dang_ky: clean(issuance.issuanceNumber),
    ngay_cap_CN: formatAdministrativeDate(issuance.issuedAt),
    ngay_qd: formatAdministrativeDate(issuance.issuedAt),
  };

  if (documentKind === 'CERTIFICATE') {
    return {
      loai_sp: shared.loai_sp,
      ten_cong_ty: shared.ten_cong_ty,
      dia_chi_ct: shared.dia_chi_ct,
      so_dang_ky: shared.so_dang_ky,
      ngay_cap_CN: shared.ngay_cap_CN,
    };
  }
  if (documentKind === 'DECISION') {
    return {
      so_dang_ky: shared.so_dang_ky,
      loai_sp: shared.loai_sp,
      ten_cong_ty: shared.ten_cong_ty,
      dia_chi_ct: shared.dia_chi_ct,
      ngay_cap_CN: shared.ngay_cap_CN,
      ngay_qd: shared.ngay_qd,
    };
  }

  const sampleData: Record<string, string> = {
    ...shared,
    ngay_dk: safeOverrides.ngay_dk || '',
    dia_chi_kho: clean(context.warehouseAddress),
    ngay_lay_mau: safeOverrides.ngay_lay_mau || '',
    model: clean(context.model),
    nhan_hieu: clean(context.brand),
    tieu_chuan: clean(context.fieldNames.join(', ')),
    so_ITD: safeOverrides.so_ITD || '',
    ngay_ITD: safeOverrides.ngay_ITD || '',
  };
  return { ...sampleData, ...safeOverrides };
}

export function getPcnOfficialGenerationReadiness(
  template: PcnTemplateDefinition,
  data: Record<string, string>,
  documentContext?: Pick<PcnDossierDocumentContext, 'reviewStatus' | 'unresolvedFields'>,
): PcnOfficialGenerationReadiness {
  const templateReadiness = getPcnTemplateReadiness(template, { availablePlaceholderKeys: template.placeholderKeys });
  const reasons: PcnOfficialGenerationReason[] = [...templateReadiness.reasons];
  const missingData = getPcnTemplateRequiredPlaceholderKeys(template).some((key) => !clean(data[key]));
  if (missingData) reasons.push('MISSING_REQUIRED_DATA');
  const reviewStatus = clean(documentContext?.reviewStatus);
  const unresolvedFields = documentContext?.unresolvedFields || [];
  if ((reviewStatus && reviewStatus !== 'REVIEWED') || unresolvedFields.length > 0) {
    reasons.push('HISTORICAL_REVIEW_INCOMPLETE');
  }
  return { ready: reasons.length === 0, reasons: [...new Set(reasons)] };
}

// --- End of pcnOfficialTemplatePolicy.ts ---
