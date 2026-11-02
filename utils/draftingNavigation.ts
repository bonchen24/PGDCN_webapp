import { getPcnNodeDraftFormKind } from './pcnDossierNodeWork';
import type { PcnDraftFormKind } from '../types';
import { getPcnDraftFormRequirementCode } from './pcnDossierDocuments';
import { getPcnOperationalTemplateForKind, type PcnOperationalTemplateKind } from './pcnOperationalTemplateCatalog';

const INTERNAL_DOSSIER_PATHS = ['/pgdcn/pcn/dossiers/', '/pgdcn/pgd/dossiers/'] as const;

function encodeRoutePart(value: string): string {
  return encodeURIComponent(value);
}

const PCN_DRAFT_FORM_KINDS: readonly PcnDraftFormKind[] = [
  'PROPOSAL_FORM', 'DOSSIER_COVER', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION',
  'SAMPLE_TAKING', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'LAB_REQUEST', 'EVALUATION_REPORT',
  'CERTIFICATION_RESULT', 'COMMERCIAL', 'CLIENT_PACKAGE',
];

function hasPcnDraftTemplate(kind: PcnDraftFormKind): boolean {
  return Boolean(getPcnOperationalTemplateForKind(kind as PcnOperationalTemplateKind));
}

export function resolvePcnDraftFormKindForRequirementCode(
  requirementCode: string,
  preferredKind?: PcnDraftFormKind,
): PcnDraftFormKind | undefined {
  const normalizedCode = String(requirementCode || '').trim().toUpperCase();
  if (!normalizedCode) return undefined;
  const candidates = PCN_DRAFT_FORM_KINDS.filter((kind) => (
    String(getPcnDraftFormRequirementCode(kind) || '').trim().toUpperCase() === normalizedCode
    && hasPcnDraftTemplate(kind)
  ));
  return candidates.find((kind) => kind === preferredKind) || candidates[0];
}

/** Keep return navigation inside the app and discard malformed/external values. */
export function sanitizeInternalReturnTo(value?: string | null): string | undefined {
  const candidate = value?.trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return undefined;
  try {
    const parsed = new URL(candidate, 'https://pgdcn.local');
    if (parsed.origin !== 'https://pgdcn.local' || !INTERNAL_DOSSIER_PATHS.some((prefix) => parsed.pathname.startsWith(prefix))) {
      return undefined;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return undefined;
  }
}

export function buildPcnDossierReturnRoute(
  dossierId: string,
  options: { tab?: string; nodeId?: string } = {},
): string {
  const query = new URLSearchParams();
  if (options.tab) query.set('tab', options.tab);
  if (options.nodeId) query.set('node', options.nodeId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return `/pgdcn/pcn/dossiers/${encodeRoutePart(dossierId)}${suffix}`;
}

export function buildPgdDossierReturnRoute(
  requestId: string,
  options: { step?: string } = {},
): string {
  const query = options.step ? `?step=${encodeURIComponent(options.step)}` : '';
  return `/pgdcn/pgd/dossiers/${encodeRoutePart(requestId)}${query}`;
}

export function getPgdDossierStepForRequirement(requirementCode: string): string {
  const code = requirementCode.trim().toUpperCase();
  if (['REQUEST_PYC', 'REQUEST_SUPPORTING', 'COMMERCIAL_CONTRACT', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'CUSTOMS_DECLARATION', 'CERTIFICATE_OF_ORIGIN'].includes(code)) return 'intake';
  if (code === 'ASSIGNMENT_FORM') return 'assignment';
  if (['INSPECTION_PLAN', 'TECHNICAL_SPECIFICATION', 'MACHINERY_TECHNICAL_DOSSIER', 'COAL_TECHNICAL_OVERVIEW', 'COAL_QUALITY_SPECIFICATION', 'TECHNICAL_OVERVIEW'].includes(code)) return 'plan';
  if (['FIELD_INSPECTION_MINUTES', 'FIELD_ACTIVITY_LOG', 'MACHINERY_CONDITION_ASSESSMENT', 'MACHINERY_SYNCHRONIZATION_ASSESSMENT'].includes(code)) return 'field';
  if (code === 'FIELD_SAMPLE_TAKING') return 'sampling';
  if (code === 'SAMPLE_HANDOVER_LAB') return 'lab-request';
  if (code === 'LAB_RESULT') return 'lab-result';
  if (code === 'LAB_RESULT_REVIEW') return 'result-review';
  if (['INSPECTION_REPORT'].includes(code)) return 'report';
  if (['DECISION', 'INSPECTION_CERTIFICATE'].includes(code)) return 'approval';
  if (['DOSSIER_COVER', 'ARCHIVE_INDEX'].includes(code)) return 'return';
  return 'intake';
}

export function buildPcnDraftingRoute(input: {
  dossierId: string;
  requirementId?: string;
  nodeId?: string;
  kind?: string;
  draftId?: string;
  returnTo?: string;
}): string {
  const query = new URLSearchParams({ dossierId: input.dossierId });
  if (input.requirementId) query.set('requirementId', input.requirementId);
  if (input.nodeId) query.set('node', input.nodeId);
  if (input.kind) query.set('kind', input.kind);
  if (input.draftId) query.set('draftId', input.draftId);
  const returnTo = sanitizeInternalReturnTo(input.returnTo);
  if (returnTo) query.set('returnTo', returnTo);
  return `/pgdcn/pcn/drafting?${query.toString()}`;
}

export function buildPcnNodeDraftingRoute(input: {
  dossierId: string;
  requirementId: string;
  requirementCode: string;
  nodeId?: string;
  draftId?: string;
  returnTo?: string;
}): string | undefined {
  const kind = getPcnNodeDraftFormKind(input.requirementCode);
  if (!kind || !hasPcnDraftTemplate(kind)) return undefined;
  return buildPcnDraftingRoute({ ...input, kind });
}

export function buildPgdDraftingRoute(input: {
  requestId: string;
  requirementCode?: string;
  templateKind?: string;
  returnTo?: string;
}): string {
  const query = new URLSearchParams({ requestId: input.requestId });
  if (input.requirementCode) query.set('requirementCode', input.requirementCode);
  if (input.templateKind) query.set('templateKind', input.templateKind);
  const returnTo = sanitizeInternalReturnTo(input.returnTo);
  if (returnTo) query.set('returnTo', returnTo);
  return `/pgdcn/pgd/drafting?${query.toString()}`;
}

// --- End of draftingNavigation.ts ---
