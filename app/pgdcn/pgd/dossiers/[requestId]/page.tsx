import PgdcnAppShell from '../../../../../components/PgdcnAppShell';

export default async function PgdDossierPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return <PgdcnAppShell initialDomain="PGD" initialPgdRequestId={decodeURIComponent(requestId)} />;
}
