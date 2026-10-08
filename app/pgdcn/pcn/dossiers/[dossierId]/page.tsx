import PgdcnAppShell from '../../../../../components/PgdcnAppShell';
import type { PcnDossierDetailTab } from '../../../../../utils/pcnDossierNavigation';

const detailTabs = new Set<PcnDossierDetailTab>(['overview', 'documents', 'lab', 'results', 'issuance']);

function getInitialTab(value: string | string[] | undefined): PcnDossierDetailTab | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && detailTabs.has(candidate as PcnDossierDetailTab) ? candidate as PcnDossierDetailTab : undefined;
}

function getInitialNodeId(value: string | string[] | undefined): string | undefined {
  const candidate = (Array.isArray(value) ? value[0] : value)?.trim();
  return candidate && candidate.length <= 120 ? candidate : undefined;
}

export default async function PcnDossierPage({
  params,
  searchParams,
}: {
  params: Promise<{ dossierId: string }>;
  searchParams?: Promise<{ tab?: string | string[]; node?: string | string[] }>;
}) {
  const { dossierId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialDossierId = decodeURIComponent(dossierId);
  const initialDossierTab = getInitialTab(resolvedSearchParams?.tab);
  const initialDossierNodeId = getInitialNodeId(resolvedSearchParams?.node);
  return <PgdcnAppShell initialDomain="PCN" initialPcnDossierId={initialDossierId} initialPcnDossierTab={initialDossierTab} initialPcnDossierNodeId={initialDossierNodeId} />;
}
