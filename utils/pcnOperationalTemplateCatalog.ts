// Author: Codex
// Description: Catalog of checked-in operational PCN DOCX templates

import manifest from '../templates/pcn/manifest.json';

import type { PcnCertificationFieldCode, PcnGeneratedDocumentKind, PcnOfficialDocumentKind } from '../types.ts';

export type PcnOperationalTemplateKind = PcnGeneratedDocumentKind | PcnOfficialDocumentKind | 'COMMERCIAL' | 'CLIENT_PACKAGE' | 'CERTIFICATION_RESULT' | 'TEST_REPORT';
export type PcnOperationalTemplateStatus = 'OPERATIONAL_DRAFT' | 'OFFICIAL_CANDIDATE';
export type PcnOperationalTemplateUsage = 'GENERATED' | 'REFERENCE_ONLY';

export interface PcnOperationalTemplateDefinition {
  id: string;
  generationKind: PcnOperationalTemplateKind;
  fieldCodes: PcnCertificationFieldCode[];
  displayName: string;
  fileName: string;
  status: PcnOperationalTemplateStatus;
  usage?: PcnOperationalTemplateUsage;
  requiredPlaceholderKeys: string[];
}

const catalog = (manifest.templates as PcnOperationalTemplateDefinition[]).map((template) => ({
  ...template,
  fieldCodes: [...template.fieldCodes],
  requiredPlaceholderKeys: [...template.requiredPlaceholderKeys],
}));

export const PCN_OPERATIONAL_TEMPLATE_CATALOG: readonly PcnOperationalTemplateDefinition[] = catalog;

export function getPcnOperationalTemplates(): PcnOperationalTemplateDefinition[] {
  return PCN_OPERATIONAL_TEMPLATE_CATALOG.map((template) => ({
    ...template,
    fieldCodes: [...template.fieldCodes],
    requiredPlaceholderKeys: [...template.requiredPlaceholderKeys],
  }));
}

export function getPcnOperationalTemplatesForFields(fieldCodes: PcnCertificationFieldCode[]): PcnOperationalTemplateDefinition[] {
  const selected = new Set(fieldCodes);
  return PCN_OPERATIONAL_TEMPLATE_CATALOG
    .filter((template) => template.fieldCodes.some((fieldCode) => selected.has(fieldCode)))
    .map((template) => ({
      ...template,
      fieldCodes: [...template.fieldCodes],
      requiredPlaceholderKeys: [...template.requiredPlaceholderKeys],
    }));
}

export function getPcnOperationalTemplateForKind(kind: PcnOperationalTemplateKind, fieldCodes: PcnCertificationFieldCode[] = []): PcnOperationalTemplateDefinition | undefined {
  const selected = new Set(fieldCodes);
  return PCN_OPERATIONAL_TEMPLATE_CATALOG.find((template) => template.generationKind === kind && (selected.size === 0 || template.fieldCodes.some((fieldCode) => selected.has(fieldCode))));
}

export function getPcnOperationalTemplateStatusLabel(status: PcnOperationalTemplateStatus): string {
  return status === 'OFFICIAL_CANDIDATE' ? 'Ứng viên mẫu chính thức' : 'Mẫu vận hành nháp';
}

// --- End of pcnOperationalTemplateCatalog.ts ---
