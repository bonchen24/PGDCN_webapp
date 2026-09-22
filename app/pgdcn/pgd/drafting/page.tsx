import PgdcnAppShell from '../../../../components/PgdcnAppShell';
import type { PgdDocumentTemplateKind } from '../../../../utils/pgdDocumentTemplates';

const TEMPLATE_KINDS = new Set<PgdDocumentTemplateKind>([
  'INTAKE_REQUEST', 'ASSIGNMENT', 'INSPECTION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING',
  'LAB_REQUEST', 'INSPECTION_REPORT', 'DECISION', 'INSPECTION_CERTIFICATE', 'DOSSIER_COVER',
  'CASE_TIMELINE', 'FIELD_ACTIVITY_LOG', 'LAB_RESULT_REVIEW', 'INSPECTION_MINUTES', 'SAMPLE_HANDOVER',
]);

function scalar(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() || undefined;
}

function templateKind(value: string | string[] | undefined): PgdDocumentTemplateKind | undefined {
  const candidate = scalar(value);
  return candidate && TEMPLATE_KINDS.has(candidate as PgdDocumentTemplateKind) ? candidate as PgdDocumentTemplateKind : undefined;
}

export default function PgdDraftingPage({ searchParams }: { searchParams?: { requestId?: string | string[]; requirementCode?: string | string[]; templateKind?: string | string[]; returnTo?: string | string[] } }) {
  return <PgdcnAppShell
    initialDomain="PGD"
    initialPgdDraftingOpen={true}
    initialPgdDraftRequestId={scalar(searchParams?.requestId)}
    initialPgdDraftRequirementCode={scalar(searchParams?.requirementCode)}
    initialPgdDraftTemplateKind={templateKind(searchParams?.templateKind)}
    initialPgdDraftReturnTo={scalar(searchParams?.returnTo)}
  />;
}
