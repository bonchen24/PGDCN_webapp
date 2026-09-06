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

export default function PcnDossierPage({ params, searchParams }: { params: { dossierId: string }; searchParams?: { tab?: string | string[]; node?: string | string[] } }) {
  const initialDossierId = decodeURIComponent(params.dossierId);
  const initialDossierTab = getInitialTab(searchParams?.tab);
  const initialDossierNodeId = getInitialNodeId(searchParams?.node);
  return <PgdcnAppShell initialDomain="PCN" initialPcnDossierId={initialDossierId} initialPcnDossierTab={initialDossierTab} initialPcnDossierNodeId={initialDossierNodeId} />;
}
