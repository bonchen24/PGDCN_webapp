import PgdcnAppShell from '../../../components/PgdcnAppShell';

// Compatibility route: PcnAppShell is hosted by the shared PGDCN shell.

function getInitialPcnSection(value: string | string[] | undefined): 'operations' | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === 'operations' ? 'operations' : undefined;
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
