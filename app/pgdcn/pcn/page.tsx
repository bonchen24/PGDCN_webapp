import PgdcnAppShell from '../../../components/PgdcnAppShell';
import type { PcnSection } from '../../../utils/pcnNavigation';

// Compatibility route: PcnAppShell is hosted by the shared PGDCN shell.

const VALID_PCN_SECTIONS: ReadonlySet<string> = new Set<PcnSection>([
  'proposals',
  'operations',
  'lab-operations',
  'drafting',
]);

function getInitialPcnSection(value: string | string[] | undefined): PcnSection | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && VALID_PCN_SECTIONS.has(candidate) ? (candidate as PcnSection) : undefined;
}

export default async function PcnWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialPcnSection = getInitialPcnSection(resolvedSearchParams?.section);

  return <PgdcnAppShell initialDomain="PCN" initialPcnSection={initialPcnSection} />;
}
