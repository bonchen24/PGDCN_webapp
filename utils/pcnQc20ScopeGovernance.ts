import type {
  PcnCertificationFieldScopeStatus,
  PcnCertificationMethod,
  PcnQc20ChemicalCompositionRequirement,
  PcnQc20ScopeConfiguration,
  PcnTemplateDefinition,
} from '../types.ts';
import { getPcnTemplateReadiness } from './pcnTemplateCatalog.ts';

export const QC20_STANDARD_REFS = [
  'QCVN 20:2019/BKHCN',
  'Sửa đổi 1:2021 QCVN 20:2019/BKHCN',
] as const;

export const QC20_SOURCE_REFERENCES = [
  'QCVN 20:2019/BKHCN',
  'Thông tư 09/2021/TT-BKHCN',
] as const;

export const DEFAULT_PCN_QC20_SCOPE_CONFIGURATION: PcnQc20ScopeConfiguration = {
  status: 'NEEDS_PCN_CONFIRMATION',
  scopeVersion: '',
  standardRefs: [...QC20_STANDARD_REFS],
  method: 'METHOD_7',
  sourceReferences: [...QC20_SOURCE_REFERENCES],
  productForms: [],
  grades: [],
  hsCodes: [],
  appliedStandards: [],
  chemicalCompositionRequirements: [],
};

export interface PcnQc20ScopeConfirmationValidation {
  valid: boolean;
  issues: Array<{ field: string; message: string }>;
}

export interface PcnQc20Readiness {
  ready: boolean;
  reasons: string[];
  scope: Pick<PcnQc20ScopeConfiguration, 'status' | 'scopeVersion' | 'confirmedByUsername' | 'confirmedAt'>;
  templates: Array<{
    documentKind: 'CERTIFICATE' | 'DECISION';
    templateId?: string;
    displayName?: string;
    ready: boolean;
    reasons: string[];
  }>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanString(value: unknown, maxLength = 255): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanList(value: unknown, maxItems = 100): string[] {
  return Array.from(new Set(
    (Array.isArray(value) ? value : [])
      .map((item) => cleanString(item))
      .filter(Boolean),
  )).slice(0, maxItems);
}

function normalizeComposition(value: unknown): PcnQc20ChemicalCompositionRequirement[] {
  return (Array.isArray(value) ? value : []).slice(0, 50).flatMap((item) => {
    const source = asRecord(item);
    const element = cleanString(source.element, 30);
    if (!element) return [];
    const requirement: PcnQc20ChemicalCompositionRequirement = { element };
    for (const key of ['minPercent', 'maxPercent'] as const) {
      if (source[key] === undefined || source[key] === null || source[key] === '') continue;
      const numeric = Number(source[key]);
      if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 100) requirement[key] = numeric;
    }
    const sourceLabel = cleanString(source.source);
    if (sourceLabel) requirement.source = sourceLabel;
    return [requirement];
  });
}

export function normalizePcnQc20ScopeConfiguration(value: unknown): PcnQc20ScopeConfiguration {
  const input = asRecord(value);
  const status: PcnCertificationFieldScopeStatus = String(input.status || '').trim().toUpperCase() === 'CONFIRMED'
    ? 'CONFIRMED'
    : 'NEEDS_PCN_CONFIRMATION';
  const method: PcnCertificationMethod = String(input.method || '').trim().toUpperCase() === 'METHOD_7' ? 'METHOD_7' : 'METHOD_7';
  const rawComposition = normalizeComposition(input.chemicalCompositionRequirements);
  return {
    status,
    scopeVersion: cleanString(input.scopeVersion, 80),
    standardRefs: [...QC20_STANDARD_REFS],
    method,
    sourceReferences: input.sourceReferences === undefined ? [...QC20_SOURCE_REFERENCES] : cleanList(input.sourceReferences, 20),
    productForms: cleanList(input.productForms),
    grades: cleanList(input.grades),
    hsCodes: cleanList(input.hsCodes, 50),
    appliedStandards: cleanList(input.appliedStandards),
    chemicalCompositionRequirements: rawComposition,
    ...(cleanString(input.confirmedByUsername, 120) ? { confirmedByUsername: cleanString(input.confirmedByUsername, 120) } : {}),
    ...(cleanString(input.confirmedAt, 40) ? { confirmedAt: cleanString(input.confirmedAt, 40) } : {}),
    ...(cleanString(input.confirmationNote, 500) ? { confirmationNote: cleanString(input.confirmationNote, 500) } : {}),
  };
}

export function validatePcnQc20ScopeConfirmation(value: unknown): PcnQc20ScopeConfirmationValidation {
  const scope = normalizePcnQc20ScopeConfiguration(value);
  const issues: Array<{ field: string; message: string }> = [];
  if (!scope.scopeVersion) issues.push({ field: 'scopeVersion', message: 'Phải có phiên bản phạm vi QC20.' });
  if (scope.standardRefs.length !== QC20_STANDARD_REFS.length) issues.push({ field: 'standardRefs', message: 'Thiếu bộ quy chuẩn QC20 bắt buộc.' });
  if (scope.sourceReferences.length === 0) issues.push({ field: 'sourceReferences', message: 'Phải có nguồn đối chiếu phạm vi QC20.' });
  for (const [field, label] of [['productForms', 'dạng sản phẩm'], ['grades', 'mác thép'], ['hsCodes', 'mã HS'], ['appliedStandards', 'tiêu chuẩn áp dụng']] as const) {
    if (scope[field].length === 0) issues.push({ field, message: `Phải có ít nhất một ${label} được Admin PCN xác nhận.` });
  }
  if (scope.chemicalCompositionRequirements.length === 0) {
    issues.push({ field: 'chemicalCompositionRequirements', message: 'Phải có ít nhất một chỉ tiêu thành phần có nguồn và giới hạn đối chiếu.' });
  }
  scope.chemicalCompositionRequirements.forEach((item, index) => {
    if (!item.source) issues.push({ field: `chemicalCompositionRequirements.${index}.source`, message: 'Mỗi chỉ tiêu phải có nguồn đối chiếu.' });
    if (item.minPercent === undefined && item.maxPercent === undefined) issues.push({ field: `chemicalCompositionRequirements.${index}`, message: 'Mỗi chỉ tiêu phải có ít nhất một giới hạn.' });
    if (item.minPercent !== undefined && item.maxPercent !== undefined && item.minPercent > item.maxPercent) issues.push({ field: `chemicalCompositionRequirements.${index}`, message: 'Giới hạn tối thiểu không được lớn hơn tối đa.' });
  });
  if (!cleanString(scope.confirmationNote, 500)) issues.push({ field: 'confirmationNote', message: 'Phải ghi chú căn cứ xác nhận phạm vi.' });
  return { valid: issues.length === 0, issues };
}

export function confirmPcnQc20ScopeConfiguration(input: unknown, actorUsername: string, confirmedAt: string): PcnQc20ScopeConfiguration {
  const validation = validatePcnQc20ScopeConfirmation(input);
  if (!validation.valid) throw new Error(validation.issues.map((issue) => `${issue.field}: ${issue.message}`).join('; '));
  const scope = normalizePcnQc20ScopeConfiguration(input);
  return {
    ...scope,
    status: 'CONFIRMED',
    confirmedByUsername: cleanString(actorUsername, 120),
    confirmedAt: cleanString(confirmedAt, 40),
  };
}

function templateReadinessReasons(
  template: PcnTemplateDefinition | undefined,
  privateTemplateAssetIds: Set<string>,
): { ready: boolean; reasons: string[] } {
  if (!template) return { ready: false, reasons: ['TEMPLATE_MISSING'] };
  const readiness = getPcnTemplateReadiness({
    ...template,
    ...(template.fileAssetId && privateTemplateAssetIds.has(template.fileAssetId) ? { privateAssetVerified: true } : {}),
  }, { requireVerifiedPrivateAsset: true });
  return { ready: readiness.ready, reasons: readiness.reasons };
}

export function getPcnQc20Readiness(input: {
  scopeConfiguration?: unknown;
  templates: PcnTemplateDefinition[];
  privateTemplateAssetIds?: Iterable<string>;
}): PcnQc20Readiness {
  const scope = normalizePcnQc20ScopeConfiguration(input.scopeConfiguration);
  const privateTemplateAssetIds = new Set(Array.from(input.privateTemplateAssetIds || []).map((id) => String(id).trim()).filter(Boolean));
  const reasons: string[] = [];
  if (scope.status !== 'CONFIRMED' || !scope.scopeVersion) reasons.push('QC20_SCOPE_NOT_CONFIRMED');
  const profileValidation = validatePcnQc20ScopeConfirmation(scope);
  if (!profileValidation.valid) reasons.push('QC20_TEST_PROFILE_NOT_CONFIRMED');
  const templateEntries = (['CERTIFICATE', 'DECISION'] as const).map((documentKind) => {
    const template = input.templates
      .filter((item) => String(item.fieldCode).trim().toUpperCase() === 'QC20' && item.documentKind === documentKind && (!item.method || item.method === 'METHOD_7'))
      .sort((left, right) => Number(right.method === 'METHOD_7') - Number(left.method === 'METHOD_7') || left.id.localeCompare(right.id))[0];
    const readiness = templateReadinessReasons(template, privateTemplateAssetIds);
    if (!readiness.ready) reasons.push(`${documentKind}: TEMPLATE_NOT_READY`);
    return {
      documentKind,
      ...(template ? { templateId: template.id, displayName: template.displayName } : {}),
      ready: readiness.ready,
      reasons: readiness.reasons,
    };
  });
  return {
    ready: reasons.length === 0,
    reasons: [...new Set(reasons)],
    scope: {
      status: scope.status,
      scopeVersion: scope.scopeVersion,
      ...(scope.confirmedByUsername ? { confirmedByUsername: scope.confirmedByUsername } : {}),
      ...(scope.confirmedAt ? { confirmedAt: scope.confirmedAt } : {}),
    },
    templates: templateEntries,
  };
}

// --- End of utils/pcnQc20ScopeGovernance.ts ---
