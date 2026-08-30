import type { PcnPipelineStationKey } from './pcnDossierPipeline.ts';
import type { NotificationEntityType, PcnDossierStatus, PcnGeneratedDocumentKind } from '../types.ts';

export type PcnDossierDetailTab =
  | 'overview'
  | 'historicalReview'
  | 'documents'
  | 'generation'
  | 'proposal'
  | 'lab'
  | 'results'
  | 'issuance'
  | 'attachments'
  | 'history';

/**
 * Maps a PCN notification to the dossier detail area that can act on it.
 * A plain dossier notification intentionally returns undefined so the detail
 * view can derive its default area from the dossier's current station.
 */
export function getPcnNotificationDossierTab(entityType?: NotificationEntityType): PcnDossierDetailTab | undefined {
  switch (entityType) {
    case 'PCN_PROPOSAL':
      return 'proposal';
    case 'PCN_SAMPLE_LOT':
    case 'PCN_LAB_REQUEST':
      return 'lab';
    case 'PCN_RESULT':
      return 'results';
    case 'PCN_APPROVAL':
    case 'PCN_ISSUANCE':
      return 'issuance';
    case 'PCN_DOSSIER':
    default:
      return undefined;
  }
}

/**
 * Maps the action of a pipeline station to the detail area that can complete it.
 * The mapping is derived UI navigation only; it does not persist another dossier state.
 */
export function getPcnDossierStationTab(stationKey: PcnPipelineStationKey, hasHistoricalReview = false): PcnDossierDetailTab {
  switch (stationKey) {
    case 'INTAKE':
      return 'proposal';
    case 'DOCUMENTS':
      return 'documents';
    case 'SAMPLING_LAB':
      return 'lab';
    case 'RESULTS':
    case 'CORRECTION':
      return 'results';
    case 'TECHNICAL_REVIEW':
      return 'documents';
    case 'APPROVAL':
    case 'ISSUANCE':
    case 'DELIVERY_ARCHIVE':
      return 'issuance';
    case 'EXCEPTIONS':
      return hasHistoricalReview ? 'historicalReview' : 'documents';
    case 'ASSIGNMENT':
    case 'EVALUATION':
    default:
      return 'overview';
  }
}

/**
 * Chooses the first useful internal Word/PDF form when a station opens the
 * generation area. The user can still switch to any other internal form.
 */
export function getPcnDossierStationGenerationKind(
  stationKey: PcnPipelineStationKey,
  status?: PcnDossierStatus,
): PcnGeneratedDocumentKind {
  switch (stationKey) {
    case 'INTAKE':
      return 'PROPOSAL_SUMMARY';
    case 'DOCUMENTS':
      return 'PROPOSAL_FORM';
    case 'EVALUATION':
      return 'EVALUATION_PLAN';
    case 'SAMPLING_LAB':
      return status === 'SENT_TO_LAB' ? 'LAB_REQUEST' : status === 'AWAITING_SAMPLING' ? 'SAMPLE_TAKING' : 'SAMPLE_HANDOVER';
    case 'ASSIGNMENT':
      return 'ASSIGNMENT_FORM';
    case 'RESULTS':
    case 'CORRECTION':
    case 'TECHNICAL_REVIEW':
      return 'EVALUATION_REPORT';
    case 'APPROVAL':
    case 'ISSUANCE':
    case 'DELIVERY_ARCHIVE':
    case 'EXCEPTIONS':
    default:
      return 'DOSSIER_COVER';
  }
}

// --- End of pcnDossierNavigation.ts ---
