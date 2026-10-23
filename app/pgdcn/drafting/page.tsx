import PgdcnAppShell from '../../../components/PgdcnAppShell';
import type { PcnDraftFormKind } from '../../../types';
import type { PgdDocumentTemplateKind } from '../../../utils/pgdDocumentTemplates';
import type { UnifiedDraftingTab } from '../../../components/PgdcnUnifiedDraftingView';
import { getPcnNodeDocumentGenerationKind, getPcnNodeDraftFormKind } from '../../../utils/pcnDossierNodeWork';

const PCN_DRAFT_KINDS = new Set<PcnDraftFormKind>([
  'PROPOSAL_FORM', 'DOSSIER_COVER', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION',
  'SAMPLE_TAKING', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'LAB_REQUEST', 'EVALUATION_REPORT',
]);

const PGD_TEMPLATE_KINDS = new Set<PgdDocumentTemplateKind>([
  'INTAKE_REQUEST', 'ASSIGNMENT', 'INSPECTION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING',
  'LAB_REQUEST', 'INSPECTION_REPORT', 'DECISION', 'INSPECTION_CERTIFICATE', 'DOSSIER_COVER',
  'CASE_TIMELINE', 'FIELD_ACTIVITY_LOG', 'LAB_RESULT_REVIEW', 'INSPECTION_MINUTES', 'SAMPLE_HANDOVER',
]);

function scalar(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() || undefined;
}

function getPcnDraftKind(value: string | string[] | undefined): PcnDraftFormKind | undefined {
  const candidate = scalar(value);
  if (!candidate) return undefined;
  const draftKind = getPcnNodeDraftFormKind(candidate);
  if (draftKind) return draftKind;
  const generatedKind = getPcnNodeDocumentGenerationKind(candidate);
  return generatedKind && PCN_DRAFT_KINDS.has(generatedKind as PcnDraftFormKind)
    ? generatedKind as PcnDraftFormKind
    : undefined;
}

function getPgdTemplateKind(value: string | string[] | undefined): PgdDocumentTemplateKind | undefined {
  const candidate = scalar(value);
  return candidate && PGD_TEMPLATE_KINDS.has(candidate as PgdDocumentTemplateKind)
    ? candidate as PgdDocumentTemplateKind
    : undefined;
}

function getDomain(value: string | string[] | undefined): 'PGD' | 'PCN' | undefined {
  const candidate = scalar(value)?.toUpperCase();
  if (candidate === 'PGD') return 'PGD';
  if (candidate === 'PCN') return 'PCN';
  return undefined;
}

function getTab(value: string | string[] | undefined): UnifiedDraftingTab | undefined {
  const candidate = scalar(value)?.toLowerCase();
  if (candidate === 'docx' || candidate === 'templates') return 'docx';
  if (candidate === 'drafts' || candidate === 'nhap') return 'drafts';
  if (candidate === 'drafting' || candidate === 'soan-thao') return 'drafting';
  return undefined;
}

type PgdcnDraftingPageParams = {
  searchParams?: {
    domain?: string | string[];
    tab?: string | string[];
    dossierId?: string | string[];
    requestId?: string | string[];
    requirementId?: string | string[];
    requirementCode?: string | string[];
    node?: string | string[];
    kind?: string | string[];
    templateKind?: string | string[];
    returnTo?: string | string[];
  };
};

export default async function PgdcnSharedDraftingPage(props: {
  searchParams?: Promise<PgdcnDraftingPageParams['searchParams']>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const domain = getDomain(searchParams?.domain);
  const tab = getTab(searchParams?.tab);
  const pcnKind = getPcnDraftKind(searchParams?.kind);
  const pgdKind = getPgdTemplateKind(searchParams?.templateKind || searchParams?.kind);

  return (
    <PgdcnAppShell
      initialDomain="department"
      initialDepartmentSection="document-drafting"
      initialDraftingDomain={domain}
      initialDraftingTab={tab}
      initialPcnDraftDossierId={scalar(searchParams?.dossierId)}
      initialPcnDraftRequirementId={scalar(searchParams?.requirementId)}
      initialPcnDraftNodeId={scalar(searchParams?.node)}
      initialPcnDraftKind={pcnKind}
      initialPcnDraftReturnTo={scalar(searchParams?.returnTo)}
      initialPgdDraftRequestId={scalar(searchParams?.requestId)}
      initialPgdDraftRequirementCode={scalar(searchParams?.requirementCode)}
      initialPgdDraftTemplateKind={pgdKind}
      initialPgdDraftReturnTo={scalar(searchParams?.returnTo)}
    />
  );
}
