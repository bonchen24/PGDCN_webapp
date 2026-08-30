// Author: Codex
// OS support: Browser/Node
// Description: Read-only, stage-grouped inspection projection for a PCN dossier

import type {
  PcnCertificationFieldCode,
  PcnDocumentRequirement,
  PcnDocumentRequirementStage,
  PcnDossierDocument,
  PcnDossierDocumentVersion,
  PcnDossierStationKey,
} from '../types.ts';
import { getPcnDocumentRequirements } from './pcnDossierDocuments.ts';
import { PCN_PIPELINE_STATIONS } from './pcnDossierPipeline.ts';

export interface PcnDossierInspectionItem {
  requirement: PcnDocumentRequirement;
  status: 'PRESENT' | 'MISSING';
  versionCount: number;
  currentVersion?: PcnDossierDocumentVersion;
}

export interface PcnDossierInspectionStage {
  stage: PcnDocumentRequirementStage;
  label: string;
  items: PcnDossierInspectionItem[];
  present: number;
  total: number;
  missing: number;
}

export interface PcnDossierInspectionStation {
  key: PcnDossierStationKey;
  number?: number;
  label: string;
  items: PcnDossierInspectionItem[];
  present: number;
  total: number;
  missing: number;
}

export interface PcnDossierInspectionSummary {
  total: number;
  present: number;
  missing: number;
  requiredTotal: number;
  requiredPresent: number;
  requiredMissing: number;
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
  TECHNICAL_REVIEW: 'KQTN & soát xét',
  ISSUANCE: 'Phê duyệt & phát hành',
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

function buildInspectionItem(requirement: PcnDocumentRequirement, document?: PcnDossierDocument): PcnDossierInspectionItem {
  const currentVersion = getCurrentVersion(document);
  return {
    requirement,
    status: currentVersion ? 'PRESENT' : 'MISSING',
    versionCount: document?.versions.length || 0,
    ...(currentVersion ? { currentVersion } : {}),
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
}): PcnDossierInspection {
  const requirements = getPcnDocumentRequirements(input.fieldCodes, input.requirements);
  const documentsByRequirement = new Map(
    input.documents
      .filter((document) => document.dossierId === input.dossierId)
      .map((document) => [document.requirementId, document]),
  );
  const items = requirements.map((requirement) => buildInspectionItem(requirement, documentsByRequirement.get(requirement.id)));
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
      };
    })
    .filter((stage) => stage.items.length > 0);
  const stations = PCN_PIPELINE_STATIONS
    .map((station) => {
      const stationItems = items.filter((item) => getInspectionStationKeys(item.requirement).includes(station.key));
      return {
        key: station.key,
        number: station.number,
        label: station.title,
        items: stationItems,
        present: stationItems.filter((item) => item.status === 'PRESENT').length,
        total: stationItems.length,
        missing: stationItems.filter((item) => item.status === 'MISSING').length,
      };
    })
    .filter((station) => station.items.length > 0);
  const present = items.filter((item) => item.status === 'PRESENT').length;
  const requiredItems = items.filter((item) => item.requirement.required);
  const requiredPresent = requiredItems.filter((item) => item.status === 'PRESENT').length;

  return {
    stages,
    stations,
    summary: {
      total: items.length,
      present,
      missing: items.length - present,
      requiredTotal: requiredItems.length,
      requiredPresent,
      requiredMissing: requiredItems.length - requiredPresent,
    },
  };
}
