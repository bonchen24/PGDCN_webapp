import PgdcnAppShell from '../../../components/PgdcnAppShell';

// Compatibility route: PgdAppShell is hosted by the shared PGDCN shell.

export default function PgdWorkspacePage() {
  return <PgdcnAppShell initialDomain="PGD" />;
}
