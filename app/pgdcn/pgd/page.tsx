import PgdcnAppShell from '../../../components/PgdcnAppShell';
import type { PgdSection } from '../../../components/PgdSidebar';

// Compatibility route: PgdAppShell is hosted by the shared PGDCN shell.

const VALID_PGD_SECTIONS: ReadonlySet<string> = new Set<PgdSection>([
  'requests',
  'operations',
  'sample-operations',
  'templates',
]);

function getInitialPgdSection(value: string | string[] | undefined): PgdSection | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && VALID_PGD_SECTIONS.has(candidate) ? (candidate as PgdSection) : undefined;
}

export default async function PgdWorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string | string[] }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const initialPgdSection = getInitialPgdSection(resolved?.section);
  return <PgdcnAppShell initialDomain="PGD" initialPgdSection={initialPgdSection} />;
}
