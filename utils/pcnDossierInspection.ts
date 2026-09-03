// Author: Codex
// OS support: Browser/Node
// Description: Read-only, stage-grouped inspection projection for a PCN dossier

import type {
  PcnCertificationFieldCode,
  PcnDocumentRequirement,
  PcnDocumentRequirementStage,
  PcnDossierDocument,
  PcnDossierDocumentVersion,
  PcnDossierDocumentWaiver,
  PcnDossierStationKey,
} from '../types.ts';
import { getPcnDocumentRequirements } from './pcnDossierDocuments.ts';
import { getPcnDossierStationScore, PCN_PIPELINE_STATIONS } from './pcnDossierPipeline.ts';
import { PCN_WORKFLOW_STAGES } from './pcnWorkflowStages.ts';
import { isPcnDocumentWaiverValid } from './pcnDocumentWaivers.ts';

export interface PcnDossierInspectionItem {
  requirement: PcnDocumentRequirement;
  status: 'PRESENT' | 'MISSING' | 'WAIVED';
  versionCount: number;
  currentVersion?: PcnDossierDocumentVersion;
  waiver?: PcnDossierDocumentWaiver;
}

export interface PcnDossierInspectionStage {
  stage: PcnDocumentRequirementStage;
  label: string;
  items: PcnDossierInspectionItem[];
  present: number;
  total: number;
  missing: number;
  waived?: number;
}

export interface PcnDossierInspectionStation {
  key: PcnDossierStationKey;
  number?: number;
  label: string;
  items: PcnDossierInspectionItem[];
  present: number;
  total: number;
  missing: number;
  waived?: number;
  requiredPresent: number;
  requiredTotal: number;
  requiredMissing: number;
  requiredWaived?: number;
  stationScore: number | null;
}

export interface PcnDossierInspectionSummary {
  total: number;
  present: number;
  missing: number;
  requiredTotal: number;
  requiredPresent: number;
  requiredMissing: number;
  waived?: number;
  requiredWaived?: number;
}

export interface PcnDossierInspection {
  stages: PcnDossierInspectionStage[];
  stations: PcnDossierInspectionStation[];
  summary: PcnDossierInspectionSummary;
}

const STAGE_ORDER: readonly PcnDocumentRequirementStage[] = [
  'INTAKE',
  'LAB_ROUTING',
  'TECHNICAL_REVIEW',
  'ISSUANCE',
  'DELIVERY',
  'ARCHIVE',
];

const STAGE_LABELS: Record<PcnDocumentRequirementStage, string> = {
  INTAKE: 'Tiếp nhận & đầu vào',
  LAB_ROUTING: 'Lấy mẫu & gửi PTN',
  TECHNICAL_REVIEW: 'KQTN & đánh giá / hoàn thiện & soát xét trước duyệt',
  ISSUANCE: 'Phê duyệt',
  DELIVERY: 'Giao khách hàng',
  ARCHIVE: 'Lưu hồ sơ',
};

const FALLBACK_STATION_BY_STAGE: Record<PcnDocumentRequirementStage, PcnDossierStationKey> = {
  INTAKE: 'INTAKE',
  LAB_ROUTING: 'SAMPLING_LAB',
  TECHNICAL_REVIEW: 'TECHNICAL_REVIEW',
  ISSUANCE: 'ISSUANCE',
  DELIVERY: 'DELIVERY_ARCHIVE',
  ARCHIVE: 'DELIVERY_ARCHIVE',
};

function getInspectionStationKeys(requirement: PcnDocumentRequirement): PcnDossierStationKey[] {
  const configured = Array.isArray(requirement.stationKeys)
    ? requirement.stationKeys.filter((key) => PCN_PIPELINE_STATIONS.some((station) => station.key === key))
    : [];
  if (configured.length > 0) return [...new Set(configured)];
  return [...new Set(requirement.stages.map((stage) => FALLBACK_STATION_BY_STAGE[stage]))];
}

function getCurrentVersion(document?: PcnDossierDocument): PcnDossierDocumentVersion | undefined {
  if (!document || document.status !== 'PRESENT' || !document.currentVersionId) return undefined;
  return document.versions.find((version) => version.assetId === document.currentVersionId);
}

function buildInspectionItem(requirement: PcnDocumentRequirement, document?: PcnDossierDocument, waiver?: PcnDossierDocumentWaiver): PcnDossierInspectionItem {
  const currentVersion = getCurrentVersion(document);
  const status = currentVersion ? 'PRESENT' as const : isPcnDocumentWaiverValid(waiver) ? 'WAIVED' as const : 'MISSING' as const;
  return {
    requirement,
    status,
    versionCount: document?.versions.length || 0,
    ...(currentVersion ? { currentVersion } : {}),
    ...(status === 'WAIVED' ? { waiver } : {}),
  };
}

/**
 * Builds a conservative visual projection. A document is present only when
 * its status is PRESENT and currentVersionId points to an actual version.
 */
export function buildPcnDossierInspection(input: {
  dossierId: string;
  fieldCodes: PcnCertificationFieldCode[];
  requirements: PcnDocumentRequirement[];
  documents: PcnDossierDocument[];
  documentWaivers?: Record<string, PcnDossierDocumentWaiver>;
  compact?: boolean;
}): PcnDossierInspection {
  const requirements = getPcnDocumentRequirements(input.fieldCodes, input.requirements);
  const documentsByRequirement = new Map(
    input.documents
      .filter((document) => document.dossierId === input.dossierId)
      .map((document) => [document.requirementId, document]),
  );
  const items = requirements.map((requirement) => buildInspectionItem(requirement, documentsByRequirement.get(requirement.id), input.documentWaivers?.[requirement.id]));
  const stages = STAGE_ORDER
    .map((stage) => {
      const stageItems = items.filter((item) => item.requirement.stages.includes(stage));
      return {
        stage,
        label: STAGE_LABELS[stage],
        items: stageItems,
        present: stageItems.filter((item) => item.status === 'PRESENT').length,
        total: stageItems.length,
        missing: stageItems.filter((item) => item.status === 'MISSING').length,
        ...(input.compact || input.documentWaivers ? { waived: stageItems.filter((item) => item.status === 'WAIVED').length } : {}),
      };
    })
    .filter((stage) => stage.items.length > 0);
  const inspectionStations = input.compact
    ? PCN_WORKFLOW_STAGES.map((stage) => ({
      key: stage.key,
      number: stage.number,
      title: stage.title,
      statuses: stage.statuses,
      requirementStages: stage.requirementStages,
      detailedStationKeys: stage.detailedStationKeys,
    }))
    : PCN_PIPELINE_STATIONS;
  const stations = inspectionStations
    .map((station) => {
      const stationItems = items.filter((item) => input.compact && 'detailedStationKeys' in station
        ? (item.requirement.stationKeys?.length
          ? item.requirement.stationKeys.some((key) => station.detailedStationKeys.includes(key))
          : item.requirement.stages.some((stage) => station.requirementStages.includes(stage)))
        : getInspectionStationKeys(item.requirement).includes(station.key));
      const requiredItems = stationItems.filter((item) => item.requirement.required);
      const requiredPresent = requiredItems.filter((item) => item.status === 'PRESENT').length;
      const requiredWaived = requiredItems.filter((item) => item.status === 'WAIVED').length;
      return {
        key: station.key,
        number: station.number,
        label: station.title,
        items: stationItems,
        present: stationItems.filter((item) => item.status === 'PRESENT').length,
        total: stationItems.length,
        missing: stationItems.filter((item) => item.status === 'MISSING').length,
        ...(input.compact || input.documentWaivers ? { waived: stationItems.filter((item) => item.status === 'WAIVED').length } : {}),
        requiredPresent,
        requiredTotal: requiredItems.length,
        requiredMissing: requiredItems.filter((item) => item.status === 'MISSING').length,
        ...(input.compact || input.documentWaivers ? { requiredWaived } : {}),
        stationScore: getPcnDossierStationScore({ requiredPresent: requiredPresent + requiredWaived, requiredTotal: requiredItems.length }),
      };
    })
    .filter((station) => station.items.length > 0);
  const present = items.filter((item) => item.status === 'PRESENT').length;
  const waived = items.filter((item) => item.status === 'WAIVED').length;
  const requiredItems = items.filter((item) => item.requirement.required);
  const requiredPresent = requiredItems.filter((item) => item.status === 'PRESENT').length;
  const requiredWaived = requiredItems.filter((item) => item.status === 'WAIVED').length;

  return {
    stages,
    stations,
    summary: {
      total: items.length,
      present,
      missing: items.filter((item) => item.status === 'MISSING').length,
      requiredTotal: requiredItems.length,
      requiredPresent,
      requiredMissing: requiredItems.filter((item) => item.status === 'MISSING').length,
      ...(input.compact || input.documentWaivers ? { waived, requiredWaived } : {}),
    },
  };
}
