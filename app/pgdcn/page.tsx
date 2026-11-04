import PgdcnAppShell from '../../components/PgdcnAppShell';

// Compatibility links: /pgdcn/pcn and /pgdcn/pgd remain canonical entry points.

export default function PgdcnLandingPage() {
  return <PgdcnAppShell initialDomain="department" />;
}
