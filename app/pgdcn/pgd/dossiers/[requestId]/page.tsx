import PgdcnAppShell from '../../../../../components/PgdcnAppShell';

export default function PgdDossierPage({ params }: { params: { requestId: string } }) {
  return <PgdcnAppShell initialDomain="PGD" initialPgdRequestId={decodeURIComponent(params.requestId)} />;
}
