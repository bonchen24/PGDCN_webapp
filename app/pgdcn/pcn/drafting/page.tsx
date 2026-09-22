import PgdcnAppShell from '../../../../components/PgdcnAppShell';
import type { PcnDraftFormKind } from '../../../../types';
import { getPcnNodeDocumentGenerationKind, getPcnNodeDraftFormKind } from '../../../../utils/pcnDossierNodeWork';

const draftKinds = new Set<PcnDraftFormKind>([
  'PROPOSAL_FORM', 'DOSSIER_COVER', 'ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION',
  'SAMPLE_TAKING', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'LAB_REQUEST', 'EVALUATION_REPORT',
]);

function scalar(value: string | string[] | undefined): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim() || undefined;
}

function getDraftKind(value: string | string[] | undefined): PcnDraftFormKind | undefined {
  const candidate = scalar(value);
  if (!candidate) return undefined;
  const draftKind = getPcnNodeDraftFormKind(candidate);
  if (draftKind) return draftKind;
  const generatedKind = getPcnNodeDocumentGenerationKind(candidate);
  return generatedKind && draftKinds.has(generatedKind as PcnDraftFormKind) ? generatedKind as PcnDraftFormKind : undefined;
}

export default function PcnDraftingPage({ searchParams }: { searchParams?: { dossierId?: string | string[]; requirementId?: string | string[]; node?: string | string[]; kind?: string | string[]; returnTo?: string | string[] } }) {
  return <PgdcnAppShell
    initialDomain="PCN"
    initialPcnDraftingOpen={true}
    initialPcnDraftDossierId={scalar(searchParams?.dossierId)}
    initialPcnDraftRequirementId={scalar(searchParams?.requirementId)}
    initialPcnDraftNodeId={scalar(searchParams?.node)}
    initialPcnDraftKind={getDraftKind(searchParams?.kind)}
    initialPcnDraftReturnTo={scalar(searchParams?.returnTo)}
  />;
}
