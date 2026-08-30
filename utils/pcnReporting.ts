import type { CertificationDossier, CertificationProposal, IssuancePackage, OutboundLabRequest, ReturnedTestResult } from '../types.ts';
import { getPcnDossierCustomerSnapshot } from './pcnDossierPolicy.ts';

export interface PcnDashboardMetrics {
  totalDossiers: number;
  awaitingDocuments: number;
  waitingLab: number;
  waitingResults: number;
  correctiveAction: number;
  waitingApproval: number;
  issued: number;
  archived: number;
  overdue: number;
}

export function getPcnDashboardMetrics(
  dossiers: CertificationDossier[],
  labRequests: OutboundLabRequest[],
  _results: ReturnedTestResult[],
  now: string = new Date().toISOString(),
): PcnDashboardMetrics {
  const today = Date.parse(now);
  return {
    totalDossiers: dossiers.length,
    awaitingDocuments: dossiers.filter((dossier) => dossier.status === 'AWAITING_DOCUMENTS').length,
    waitingLab: labRequests.filter((request) => ['SENT', 'RECEIVED'].includes(request.status)).length,
    waitingResults: dossiers.filter((dossier) => dossier.status === 'AWAITING_RESULTS').length,
    correctiveAction: dossiers.filter((dossier) => dossier.status === 'CORRECTIVE_ACTION').length,
    waitingApproval: dossiers.filter((dossier) => dossier.status === 'WAITING_APPROVAL').length,
    issued: dossiers.filter((dossier) => ['ISSUED', 'DELIVERED'].includes(dossier.status)).length,
    archived: dossiers.filter((dossier) => dossier.status === 'ARCHIVED').length,
    overdue: dossiers.filter((dossier) => dossier.targetDate && !['ISSUED', 'DELIVERED', 'ARCHIVED', 'CANCELLED'].includes(dossier.status) && Date.parse(dossier.targetDate) < today).length,
  };
}

export interface PcnArchiveFilter {
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  issuancePackages: IssuancePackage[];
  query?: string;
  fieldCode?: string;
  year?: string;
}

export function filterPcnArchive(input: PcnArchiveFilter): CertificationDossier[] {
  const query = String(input.query || '').trim().toLocaleLowerCase('vi-VN');
  return input.dossiers.filter((dossier) => {
    const issuance = input.issuancePackages.find((item) => item.dossierId === dossier.id);
    const isArchived = dossier.status === 'ARCHIVED' || issuance?.status === 'ARCHIVED';
    if (!isArchived) return false;
    if (input.fieldCode && !dossier.fieldCodes.includes(input.fieldCode)) return false;
    const dateSource = issuance?.issuedAt || dossier.updatedAt || dossier.createdAt || '';
    if (input.year && !String(dateSource).startsWith(input.year)) return false;
    if (!query) return true;
    const proposal = input.proposals.find((item) => item.id === dossier.proposalId);
    const customerSnapshot = getPcnDossierCustomerSnapshot(dossier, proposal);
    const haystack = [
      dossier.dossierCode,
      dossier.fieldCodes.join(' '),
      proposal?.proposalCode,
      customerSnapshot?.name,
      customerSnapshot?.taxId,
      proposal?.productName,
      issuance?.issuanceNumber,
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN');
    return haystack.includes(query);
  });
}

// --- End of pcnReporting.ts ---
