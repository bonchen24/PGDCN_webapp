// Author: Codex
// Description: Keep historical/reference records out of the active PCN work projection.

import type {
  ActivityLog,
  AppNotification,
  CertificationDossier,
  CertificationProposal,
  CustomerRef,
  IssuancePackage,
  OutboundLabRequest,
  PcnApprovalStep,
  PcnDossierAttachment,
  PcnDossierDocument,
  PcnGeneratedDocument,
  PcnOfficialGeneratedDocument,
  PcnSampleFlowEvent,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';

type HistoricalAwareRecord = {
  historicalImport?: unknown;
};

export interface PcnFutureWorkSnapshotInput {
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  customers: CustomerRef[];
}

export interface PcnFutureWorkSnapshot {
  proposals: CertificationProposal[];
  dossiers: CertificationDossier[];
  customers: CustomerRef[];
}

export interface PcnFutureWorkRelations {
  dossierDocuments: PcnDossierDocument[];
  dossierAttachments: PcnDossierAttachment[];
  generatedDocuments: PcnGeneratedDocument[];
  officialDocuments: PcnOfficialGeneratedDocument[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  approvalSteps: PcnApprovalStep[];
  issuancePackages: IssuancePackage[];
  sampleLots: PcnSampleLot[];
  sampleItems: PcnSampleItem[];
  sampleRoutes: PcnSampleRoute[];
  sampleFlowEvents: PcnSampleFlowEvent[];
  activityLogs: ActivityLog[];
  notifications: AppNotification[];
}

export function isPcnHistoricalRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as HistoricalAwareRecord;
  return Boolean(record.historicalImport && typeof record.historicalImport === 'object');
}

export function filterPcnFutureWorkSnapshot(input: PcnFutureWorkSnapshotInput): PcnFutureWorkSnapshot {
  const proposals = (input.proposals || []).filter((proposal) => !isPcnHistoricalRecord(proposal));
  const activeProposalIds = new Set(proposals.map((proposal) => proposal.id));
  const dossiers = (input.dossiers || []).filter((dossier) =>
    !isPcnHistoricalRecord(dossier) && activeProposalIds.has(dossier.proposalId),
  );

  return {
    proposals,
    dossiers,
    // The customer catalogue is intentionally preserved, including customers that
    // originally came from a reference import, because new proposals may select them.
    customers: [...(input.customers || [])],
  };
}

export function filterPcnFutureWorkRelations(
  relations: PcnFutureWorkRelations,
  activeDossiers: CertificationDossier[],
): PcnFutureWorkRelations {
  const dossierIds = new Set(activeDossiers.map((dossier) => dossier.id));
  const sampleLots = relations.sampleLots.filter((lot) => dossierIds.has(lot.dossierId));
  const sampleLotIds = new Set(sampleLots.map((lot) => lot.id));
  const sampleItems = relations.sampleItems.filter((item) => sampleLotIds.has(item.sampleLotId));
  const labRequests = relations.labRequests.filter((request) => dossierIds.has(request.dossierId));
  const labRequestIds = new Set(labRequests.map((request) => request.id));
  const issuancePackages = relations.issuancePackages.filter((issuance) => dossierIds.has(issuance.dossierId));
  const issuanceIds = new Set(issuancePackages.map((issuance) => issuance.id));
  const returnedResults = relations.returnedResults.filter((result) => dossierIds.has(result.dossierId));
  const resultIds = new Set(returnedResults.map((result) => result.id));
  const activeEntityIds = new Set([
    ...dossierIds,
    ...labRequestIds,
    ...issuanceIds,
    ...resultIds,
    ...sampleLotIds,
    ...sampleItems.map((item) => item.id),
  ]);

  const isActiveActivity = (activity: ActivityLog): boolean => {
    if (!activity.entityId) return true;
    const entityType = String(activity.entityType || '');
    const dossierBound = new Set([
      'PCN_PROPOSAL',
      'PCN_DOSSIER',
      'PCN_LAB_REQUEST',
      'PCN_RESULT',
      'PCN_APPROVAL',
      'PCN_ISSUANCE',
      'PCN_SAMPLE_LOT',
    ]);
    return !dossierBound.has(entityType) || activeEntityIds.has(activity.entityId);
  };

  const isActiveNotification = (notification: AppNotification): boolean => {
    if (!notification.entityId) return true;
    const entityType = String(notification.entityType || '');
    const dossierBound = new Set([
      'PCN_PROPOSAL',
      'PCN_DOSSIER',
      'PCN_LAB_REQUEST',
      'PCN_RESULT',
      'PCN_APPROVAL',
      'PCN_ISSUANCE',
      'PCN_SAMPLE_LOT',
    ]);
    return !dossierBound.has(entityType) || activeEntityIds.has(notification.entityId);
  };

  return {
    dossierDocuments: relations.dossierDocuments.filter((document) => dossierIds.has(document.dossierId)),
    dossierAttachments: relations.dossierAttachments.filter((attachment) => dossierIds.has(attachment.dossierId)),
    generatedDocuments: relations.generatedDocuments.filter((document) => dossierIds.has(document.dossierId)),
    officialDocuments: relations.officialDocuments.filter((document) => dossierIds.has(document.dossierId) && issuanceIds.has(document.issuanceId)),
    labRequests,
    returnedResults,
    approvalSteps: relations.approvalSteps.filter((step) => dossierIds.has(step.dossierId)),
    issuancePackages,
    sampleLots,
    sampleItems,
    sampleRoutes: relations.sampleRoutes.filter((route) => sampleLotIds.has(route.sampleLotId)),
    sampleFlowEvents: relations.sampleFlowEvents.filter((event) => sampleLotIds.has(event.sampleLotId)),
    activityLogs: relations.activityLogs.filter(isActiveActivity),
    notifications: relations.notifications.filter(isActiveNotification),
  };
}

// --- End of pcnActiveData.ts ---
