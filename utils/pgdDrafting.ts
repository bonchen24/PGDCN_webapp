import type { PgdDraftWorkspace, PgdGeneratedDocument, PgdInspectionRequest } from './pgdDomain.ts';
import type { DossierTemplateRequirementDefinition } from '../types.ts';
import type { PgdDossierRequirement } from './pgdDossier.ts';
import { getPgdDossierRequirementForTemplate } from './pgdDossier.ts';
import type { PgdDocumentTemplate, PgdDocumentTemplateKind } from './pgdDocumentTemplates.ts';

export function hasPgdDeepContext(input: {
  requestId?: string;
  requirementCode?: string;
  templateKind?: string;
}): boolean {
  return Boolean(String(input.requestId || '').trim());
}

export function getPgdDocumentRequirementCode(
  document: Pick<PgdGeneratedDocument, 'kind'> & Partial<Pick<PgdGeneratedDocument, 'templateId'>>,
  productGroup: PgdInspectionRequest['productGroup'],
  customDefinitions: readonly DossierTemplateRequirementDefinition[] = [],
): string | undefined {
  const custom = customDefinitions.find((definition) => definition.source === 'DRAFT_FROM_DOCX_TEMPLATE' && definition.linkedDocxTemplateId === document.templateId);
  if (custom) return custom.id;
  return getPgdDossierRequirementForTemplate(document.kind as PgdDocumentTemplateKind, productGroup)?.code;
}

export function isPgdDocumentForRequirement(input: {
  document: Pick<PgdGeneratedDocument, 'requestId' | 'kind'> & Partial<Pick<PgdGeneratedDocument, 'templateId'>>;
  requestId: string;
  requirementCode: string;
  productGroup: PgdInspectionRequest['productGroup'];
  customDefinitions?: readonly DossierTemplateRequirementDefinition[];
}): boolean {
  return input.document.requestId === input.requestId
    && getPgdDocumentRequirementCode(input.document, input.productGroup, input.customDefinitions) === input.requirementCode;
}

export function getPgdDocumentsForRequirement(input: {
  documents: readonly PgdGeneratedDocument[];
  requestId: string;
  requirementCode?: string;
  productGroup: PgdInspectionRequest['productGroup'];
  customDefinitions?: readonly DossierTemplateRequirementDefinition[];
}): PgdGeneratedDocument[] {
  const requirementCode = String(input.requirementCode || '').trim();
  if (!requirementCode) return [];
  return input.documents
    .filter((document) => isPgdDocumentForRequirement({ document, requestId: input.requestId, requirementCode, productGroup: input.productGroup, customDefinitions: input.customDefinitions }))
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
}

export interface ResolvedPgdDraftingContext {
  activeRequirement?: PgdDossierRequirement;
  selectedTemplate?: PgdDocumentTemplate;
  requirementTemplate?: PgdDocumentTemplate;
  invalidDeepContext: boolean;
  activeRequirementCode?: string;
}

export function getPgdDocumentTemplateForRequirement(
  requirement: PgdDossierRequirement | undefined,
  templates: readonly PgdDocumentTemplate[],
  productGroup: PgdInspectionRequest['productGroup'],
): PgdDocumentTemplate | undefined {
  if (!requirement) return undefined;
  return templates.find((template) => requirement.customDefinition?.linkedDocxTemplateId
    ? template.id === requirement.customDefinition.linkedDocxTemplateId
    : getPgdDossierRequirementForTemplate(template.kind, productGroup)?.code === requirement.code);
}

export function resolvePgdDraftingContext(input: {
  request?: Pick<PgdInspectionRequest, 'productGroup'>;
  requirements: readonly PgdDossierRequirement[];
  templates: readonly PgdDocumentTemplate[];
  selectedRequirementCode?: string;
  templateId?: string;
  initialRequirementCode?: string;
  initialTemplateKind?: PgdDocumentTemplateKind;
  activeDraft?: Pick<PgdDraftWorkspace, 'templateId' | 'templateKind' | 'requirementCode'>;
}): ResolvedPgdDraftingContext {
  const productGroup = input.request?.productGroup || 'OTHER';
  const initialRequirement = input.initialRequirementCode
    ? input.requirements.find((item) => item.code === input.initialRequirementCode)
    : undefined;
  const activeRequirement = input.requirements.find((item) => item.code === input.selectedRequirementCode)
    || (input.activeDraft?.requirementCode ? input.requirements.find((item) => item.code === input.activeDraft?.requirementCode) : undefined)
    || initialRequirement;
  const requirementTemplate = getPgdDocumentTemplateForRequirement(activeRequirement, input.templates, productGroup);
  const deepTemplate = input.initialTemplateKind
    ? input.templates.find((template) => template.kind === input.initialTemplateKind)
    : undefined;
  const selectedTemplate = (input.activeDraft
    ? input.templates.find((template) => template.id === input.activeDraft?.templateId)
    : undefined)
    || input.templates.find((template) => template.id === input.templateId)
    || deepTemplate
    || requirementTemplate;
  const selectedTemplateRequirementCode = selectedTemplate
    ? getPgdDossierRequirementForTemplate(selectedTemplate.kind, productGroup)?.code
    : undefined;
  const activeRequirementCode = activeRequirement?.code || selectedTemplateRequirementCode;
  const invalidDeepContext = Boolean(
    (input.initialRequirementCode && !initialRequirement)
    || (input.initialTemplateKind && !deepTemplate)
    || (input.initialRequirementCode && !requirementTemplate),
  );
  return { activeRequirement, selectedTemplate, requirementTemplate, invalidDeepContext, activeRequirementCode };
}

