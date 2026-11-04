import type { PcnCertificationMethod, PcnWorkflowTemplate } from '../types.ts';
import { validatePcnWorkflowTemplate } from './pcnWorkflowTemplate.ts';
import type { PgdProductGroup } from './pgdDomain.ts';
import { validatePgdWorkflowTemplate, type PgdWorkflowTemplate } from './pgdWorkflowTemplate.ts';

export interface PcnTemplateMatchingContext {
  fieldCodes?: readonly string[];
  method?: PcnCertificationMethod;
  dossierType?: string;
}

export interface PgdTemplateMatchingContext {
  productGroups?: readonly PgdProductGroup[];
  methodCode?: string;
}

export type TemplateSelectionStatus = 'none' | 'suggested' | 'selected' | 'ambiguous';

export interface TemplateSelectionResolution<T extends { id: string }> {
  status: TemplateSelectionStatus;
  selectedId?: string;
  selectedTemplate?: T;
  suggestedTemplate?: T;
  isAmbiguous: boolean;
}

export interface ResolveTemplateSelectionOptions<T extends { id: string }> {
  candidates: readonly T[];
  selectedId?: string | null;
}

export type WorkflowTemplateCreateResolution<T extends { id: string; version: number }> =
  | { status: 'none' }
  | { status: 'ambiguous' }
  | { status: 'invalid-selection' }
  | { status: 'resolved'; template: T };

export function resolveWorkflowTemplateForCreate<T extends { id: string; version: number }>(
  candidates: readonly T[],
  selection?: { id?: string; version?: number } | null,
): WorkflowTemplateCreateResolution<T> {
  if (selection) {
    if (!selection.id?.trim() || !Number.isInteger(selection.version)) return { status: 'invalid-selection' };
    const selected = candidates.find((template) => template.id === selection.id && template.version === selection.version);
    return selected ? { status: 'resolved', template: selected } : { status: 'invalid-selection' };
  }
  if (candidates.length === 0) return { status: 'none' };
  if (candidates.length === 1) return { status: 'resolved', template: candidates[0] };
  return { status: 'ambiguous' };
}

function compareWorkflowTemplates<T extends { code: string; name: string; version: number; id: string }>(
  left: T,
  right: T,
): number {
  return (
    left.code.localeCompare(right.code) ||
    right.version - left.version ||
    left.name.localeCompare(right.name, 'vi') ||
    left.id.localeCompare(right.id)
  );
}

/**
 * Matches all active published PCN workflow templates against intake context.
 * Requires at least one field code. Templates with unstated method/dossierType constraints
 * cannot be assumed and are excluded.
 * Returns matches in stable display sort without best-match ranking.
 */
export function matchPcnPublishedWorkflowTemplates(
  catalog: readonly PcnWorkflowTemplate[] | undefined | null,
  context: PcnTemplateMatchingContext | undefined | null,
): PcnWorkflowTemplate[] {
  if (!Array.isArray(catalog) || catalog.length === 0) return [];
  const fieldCodes = context?.fieldCodes;
  if (!Array.isArray(fieldCodes) || fieldCodes.length === 0) return [];

  const matched = catalog.filter((template) => {
    if (template.status !== 'PUBLISHED') return false;

    const templateFieldCodes = template.appliesTo?.fieldCodes;
    if (!Array.isArray(templateFieldCodes) || templateFieldCodes.length === 0) return false;
    if (!fieldCodes.every((code) => templateFieldCodes.includes(code))) return false;

    const templateMethods = template.appliesTo?.methods;
    if (Array.isArray(templateMethods) && templateMethods.length > 0) {
      if (!context.method || !templateMethods.includes(context.method)) return false;
    }

    const templateDossierType = template.appliesTo?.dossierType;
    if (templateDossierType && templateDossierType.trim() !== '') {
      if (!context.dossierType || templateDossierType !== context.dossierType) return false;
    }

    const validation = validatePcnWorkflowTemplate(template);
    return validation.valid;
  });

  return matched.sort(compareWorkflowTemplates);
}

/**
 * Matches all active published PGD workflow templates against intake context.
 * Requires at least one product group. Templates with unstated methodCode constraints
 * cannot be assumed and are excluded.
 * Returns matches in stable display sort without best-match ranking.
 */
export function matchPgdPublishedWorkflowTemplates(
  catalog: readonly PgdWorkflowTemplate[] | undefined | null,
  context: PgdTemplateMatchingContext | undefined | null,
): PgdWorkflowTemplate[] {
  if (!Array.isArray(catalog) || catalog.length === 0) return [];
  const productGroups = context?.productGroups;
  if (!Array.isArray(productGroups) || productGroups.length === 0) return [];

  const matched = catalog.filter((template) => {
    if (template.domain !== 'pgd') return false;
    if (template.status !== 'PUBLISHED') return false;

    const templateGroups = template.appliesTo?.productGroups;
    if (!Array.isArray(templateGroups) || templateGroups.length === 0) return false;
    if (!productGroups.every((group) => templateGroups.includes(group))) return false;

    const templateMethodCodes = template.appliesTo?.methodCodes;
    if (Array.isArray(templateMethodCodes) && templateMethodCodes.length > 0) {
      if (!context.methodCode || !templateMethodCodes.includes(context.methodCode)) return false;
    }

    const validation = validatePgdWorkflowTemplate(template);
    return validation.valid;
  });

  return matched.sort(compareWorkflowTemplates);
}

/**
 * Resolves template selection state across dynamic candidate changes:
 * - Empty candidates -> non-blocking status 'none'
 * - Single candidate -> 'suggested' if not selected or stale; 'selected' if already chosen
 * - Multiple candidates -> 'selected' if existing selection is present; 'ambiguous' otherwise, dropping stale id
 */
export function resolveTemplateSelectionState<T extends { id: string }>(
  options: ResolveTemplateSelectionOptions<T>,
): TemplateSelectionResolution<T> {
  const candidates = options?.candidates || [];
  const selectedId = options?.selectedId ? String(options.selectedId).trim() : undefined;

  if (candidates.length === 0) {
    return {
      status: 'none',
      selectedId: undefined,
      selectedTemplate: undefined,
      suggestedTemplate: undefined,
      isAmbiguous: false,
    };
  }

  const existingSelected = selectedId
    ? candidates.find((cand) => cand.id === selectedId)
    : undefined;

  if (candidates.length === 1) {
    const sole = candidates[0];
    if (existingSelected) {
      return {
        status: 'selected',
        selectedId: existingSelected.id,
        selectedTemplate: existingSelected,
        suggestedTemplate: undefined,
        isAmbiguous: false,
      };
    }
    return {
      status: 'suggested',
      selectedId: undefined,
      selectedTemplate: undefined,
      suggestedTemplate: sole,
      isAmbiguous: false,
    };
  }

  // Multiple candidates
  if (existingSelected) {
    return {
      status: 'selected',
      selectedId: existingSelected.id,
      selectedTemplate: existingSelected,
      suggestedTemplate: undefined,
      isAmbiguous: false,
    };
  }

  return {
    status: 'ambiguous',
    selectedId: undefined,
    selectedTemplate: undefined,
    suggestedTemplate: undefined,
    isAmbiguous: true,
  };
}
