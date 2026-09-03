import PgdcnAppShell from '../../../components/PgdcnAppShell';

// Compatibility route: PcnAppShell is hosted by the shared PGDCN shell.

export default function PcnWorkspacePage() {
  return <PgdcnAppShell initialDomain="PCN" />;
}
