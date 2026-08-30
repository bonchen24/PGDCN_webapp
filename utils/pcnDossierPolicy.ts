import type { CertificationDossier, CertificationProposal } from '../types.ts';

export type PcnDossierCustomerSnapshot = NonNullable<CertificationDossier['customerSnapshot']>;

export function ensurePcnDossierCustomerSnapshot(
  dossier: CertificationDossier,
  proposal: CertificationProposal,
): CertificationDossier & { customerSnapshot: PcnDossierCustomerSnapshot } {
  if (dossier.customerSnapshot) return dossier as CertificationDossier & { customerSnapshot: PcnDossierCustomerSnapshot };
  return {
    ...dossier,
    customerSnapshot: { ...proposal.customerSnapshot },
  };
}

export function getPcnDossierCustomerSnapshot(
  dossier: CertificationDossier,
  proposal?: CertificationProposal,
): PcnDossierCustomerSnapshot | undefined {
  return dossier.customerSnapshot || proposal?.customerSnapshot;
}

// --- End of pcnDossierPolicy.ts ---
