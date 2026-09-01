// Author: Codex
// OS support: Browser/Node
// Description: Deterministic graphic-workflow projections for PCN dashboards and dossier detail

import type {
  ActivityLog,
  CertificationDossier,
  CertificationProposal,
  PcnDossierDocument,
  PcnDossierStatus,
  PcnDocumentRequirement,
} from '../types.ts';
import {
  buildPcnDossierCompleteness,
  getPcnPipelineStation,
  PCN_PIPELINE_STATIONS,
  type PcnPipelineStation,
  type PcnPipelineStationKey,
} from './pcnDossierPipeline.ts';
import { PCN_WORKFLOW_STAGES, getPcnWorkflowStage, type PcnWorkflowStage } from './pcnWorkflowStages.ts';
import { buildPcnDossierStageGate } from './pcnDossierStageGate.ts';
import { buildPcnWorkQueueRows } from './pcnWorkQueue.ts';

export type PcnWorkflowMapNodeState = 'COMPLETED' | 'CURRENT' | 'FUTURE' | 'EXCEPTION';

export interface PcnWorkflowNode {
  key: PcnPipelineStationKey;
  number?: number;
  title: string;
  description: string;
  actionLabel: string;
  statuses: readonly PcnDossierStatus[];
  state: PcnWorkflowMapNodeState;
  count: number;
  overdueCount: number;
  missingDocumentCount: number;
  returnedCount: number;
  blockedCount: number;
  returned: boolean;
  blocked: boolean;
  currentStatus?: PcnDossierStatus;
  exceptionReason?: string;
}

export interface PcnWorkflowOverviewProjection {
  nodes: PcnWorkflowNode[];
  totalDossierCount: number;
  hasReturned: boolean;
}

export interface PcnDossierWorkflowMapProjection {
  nodes: PcnWorkflowNode[];
  currentNodeKey: PcnPipelineStationKey;
  currentNode: PcnWorkflowNode;
  totalDossierCount: 1;
  hasReturned: boolean;
}

interface WorkflowMapInput {
  requirements?: PcnDocumentRequirement[];
  documents?: PcnDossierDocument[];
  now?: string;
  /** UI-only projection: collapse internal statuses into the five PCN steps. */
  compact?: boolean;
}

interface DossierWorkflowMapInput extends WorkflowMapInput {
  dossier: CertificationDossier;
  proposal?: CertificationProposal;
  activityLogs?: ActivityLog[];
}

interface OverviewWorkflowMapInput extends WorkflowMapInput {
  dossiers: CertificationDossier[];
  proposals?: CertificationProposal[];
}

const EXCEPTION_STATION = getPcnPipelineStation('ON_HOLD');
const WORKFLOW_STATIONS: readonly PcnPipelineStation[] = [...PCN_PIPELINE_STATIONS, EXCEPTION_STATION];
const VALID_DOSSIER_STATUSES = new Set<PcnDossierStatus>(
  WORKFLOW_STATIONS.flatMap((station) => station.statuses),
);

const COMPACT_WORKFLOW_STATIONS: readonly PcnPipelineStation[] = [
  ...PCN_WORKFLOW_STAGES.map((stage) => ({
    key: stage.key,
    number: stage.number,
    title: stage.title,
    description: stage.description,
    actionLabel: stage.actionLabel,
    statuses: stage.statuses,
    requirementStages: stage.requirementStages,
  })),
  EXCEPTION_STATION,
];

function getWorkflowStations(compact = false): readonly PcnPipelineStation[] {
  return compact ? COMPACT_WORKFLOW_STATIONS : WORKFLOW_STATIONS;
}

function getWorkflowStation(status: PcnDossierStatus, compact = false): PcnPipelineStation {
  if (!compact) return getPcnPipelineStation(status);
  const stage = getPcnWorkflowStage(status);
  return stage ? COMPACT_WORKFLOW_STATIONS.find((item) => item.key === stage.key)! : EXCEPTION_STATION;
}

function validStatus(value: unknown): PcnDossierStatus | undefined {
  const status = String(value || '').trim().toUpperCase() as PcnDossierStatus;
  return VALID_DOSSIER_STATUSES.has(status) ? status : undefined;
}

function statusHistory(dossier: CertificationDossier, activityLogs: ActivityLog[]): PcnDossierStatus[] {
  const logs = activityLogs
    .filter((log) => log.entityType === 'PCN_DOSSIER' && log.entityId === dossier.id)
    .map((log, index) => ({ log, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.log.createdAt);
      const rightTime = Date.parse(right.log.createdAt);
      const leftValid = Number.isFinite(leftTime);
      const rightValid = Number.isFinite(rightTime);
      if (leftValid && rightValid && leftTime !== rightTime) return leftTime - rightTime;
      if (leftValid !== rightValid) return leftValid ? -1 : 1;
      return left.index - right.index;
    });
  const history: PcnDossierStatus[] = [];
  for (const { log } of logs) {
    for (const change of log.changes || []) {
      if (String(change.field || '').trim().toLowerCase() !== 'status') continue;
      const status = validStatus(change.after);
      if (status) history.push(status);
    }
  }
  const currentStatus = validStatus(dossier.status);
  if (currentStatus) history.push(currentStatus);
  return history;
}

function isReturnedStatus(status: PcnDossierStatus): boolean {
  return status === 'CORRECTIVE_ACTION' || status === 'REJECTED';
}

function buildQueueRowMap(input: OverviewWorkflowMapInput | DossierWorkflowMapInput): Map<string, ReturnType<typeof buildPcnWorkQueueRows>[number]> {
  const isOverview = 'dossiers' in input;
  const dossiers = isOverview ? input.dossiers : [input.dossier];
  return new Map(buildPcnWorkQueueRows({
    dossiers,
    proposals: isOverview ? input.proposals || [] : input.proposal ? [input.proposal] : [],
    documentRequirements: input.requirements,
    dossierDocuments: input.documents || [],
    now: input.now,
  }).map((row) => [row.dossierId, row]));
}

function buildOverviewNode(
  station: PcnPipelineStation,
  dossiers: CertificationDossier[],
  proposalsById: Map<string, CertificationProposal>,
  input: OverviewWorkflowMapInput,
  queueRows: Map<string, ReturnType<typeof buildPcnWorkQueueRows>[number]>,
  compact: boolean,
): PcnWorkflowNode {
  const stationDossiers = dossiers.filter((dossier) => station.statuses.includes(dossier.status));
  const overdueCount = stationDossiers.filter((dossier) => queueRows.get(dossier.id)?.priority === 'OVERDUE').length;
  const missingDocumentCount = stationDossiers.filter((dossier) => compact
    ? !buildPcnDossierStageGate({ dossier, requirements: input.requirements, documents: input.documents || [], documentWaivers: dossier.documentWaivers }).complete
    : buildPcnDossierCompleteness({
      dossier,
      proposal: proposalsById.get(dossier.proposalId),
      requirements: input.requirements,
      documents: input.documents || [],
    }).stationMissingLabels.length > 0).length;
  const returnedCount = stationDossiers.filter((dossier) => isReturnedStatus(dossier.status)).length;
  const blockedCount = stationDossiers.filter((dossier) => dossier.status === 'ON_HOLD').length;
  return {
    key: station.key,
    ...(station.number ? { number: station.number } : {}),
    title: station.title,
    description: station.description,
    actionLabel: station.actionLabel,
    statuses: station.statuses,
    state: stationDossiers.length > 0 ? 'CURRENT' : 'FUTURE',
    count: stationDossiers.length,
    overdueCount,
    missingDocumentCount,
    returnedCount,
    blockedCount,
    returned: returnedCount > 0,
    blocked: blockedCount > 0,
  };
}

/** Builds the aggregate graphic from the exact filtered dossier snapshot. */
export function buildPcnWorkflowOverview(input: OverviewWorkflowMapInput): PcnWorkflowOverviewProjection {
  const proposalsById = new Map((input.proposals || []).map((proposal) => [proposal.id, proposal]));
  const queueRows = buildQueueRowMap(input);
  const workflowStations = getWorkflowStations(input.compact);
  const nodes = workflowStations.map((station) => buildOverviewNode(station, input.dossiers, proposalsById, input, queueRows, Boolean(input.compact)));
  return {
    nodes,
    totalDossierCount: input.dossiers.length,
    hasReturned: nodes.some((node) => node.returned),
  };
}

function buildDossierNode(
  station: PcnPipelineStation,
  dossier: CertificationDossier,
  currentStation: PcnPipelineStation,
  currentMainIndex: number | undefined,
  lastVisitedMainIndex: number | undefined,
  mainStationIndex: Map<PcnPipelineStationKey, number>,
  visitedKeys: Set<PcnPipelineStationKey>,
  completeness: ReturnType<typeof buildPcnDossierCompleteness>,
  queueRow: ReturnType<typeof buildPcnWorkQueueRows>[number] | undefined,
  hasReturned: boolean,
  missingDocumentCount: number,
): PcnWorkflowNode {
  const isCurrent = station.key === currentStation.key;
  const stationIndex = mainStationIndex.get(station.key);
  const state: PcnWorkflowMapNodeState = station.key === 'EXCEPTIONS'
    ? 'EXCEPTION'
    : isCurrent
      ? 'CURRENT'
      : (stationIndex !== undefined && (
        (currentMainIndex !== undefined && stationIndex < currentMainIndex)
        || visitedKeys.has(station.key)
      )
        ? 'COMPLETED'
        : 'FUTURE');
  const returned = isCurrent && hasReturned;
  const blocked = isCurrent && dossier.status === 'ON_HOLD';
  return {
    key: station.key,
    ...(station.number ? { number: station.number } : {}),
    title: station.title,
    description: station.description,
    actionLabel: station.actionLabel,
    statuses: station.statuses,
    state,
    count: isCurrent ? 1 : 0,
    overdueCount: isCurrent && queueRow?.priority === 'OVERDUE' ? 1 : 0,
    missingDocumentCount: isCurrent ? missingDocumentCount : 0,
    returnedCount: returned ? 1 : 0,
    blockedCount: blocked ? 1 : 0,
    returned,
    blocked,
    ...(isCurrent ? { currentStatus: dossier.status } : {}),
    ...(isCurrent && dossier.exceptionReason?.trim() ? { exceptionReason: dossier.exceptionReason.trim() } : {}),
  };
}

/** Builds the detail graphic without mutating the dossier or inferring missing history. */
export function buildPcnDossierWorkflowMap(input: DossierWorkflowMapInput): PcnDossierWorkflowMapProjection {
  const compact = Boolean(input.compact);
  const workflowStations = getWorkflowStations(compact);
  const mainStations = workflowStations.filter((station) => station.key !== 'EXCEPTIONS');
  const mainStationIndex = new Map<PcnPipelineStationKey, number>(mainStations.map((station, index) => [station.key, index]));
  const currentStation = getWorkflowStation(input.dossier.status, compact);
  const currentMainIndex = mainStationIndex.get(currentStation.key);
  const history = statusHistory(input.dossier, input.activityLogs || []);
  const visitedKeys = new Set(history.map((status) => getWorkflowStation(status, compact).key));
  const visitedMainIndexes = history
    .map((status) => mainStationIndex.get(getWorkflowStation(status, compact).key))
    .filter((index): index is number => index !== undefined);
  const lastVisitedMainIndex = visitedMainIndexes.length > 0 ? Math.max(...visitedMainIndexes) : undefined;
  const hasReturned = isReturnedStatus(input.dossier.status)
    || (currentMainIndex !== undefined && lastVisitedMainIndex !== undefined && lastVisitedMainIndex > currentMainIndex);
  const completeness = buildPcnDossierCompleteness({
    dossier: input.dossier,
    proposal: input.proposal,
    requirements: input.requirements,
    documents: input.documents || [],
  });
  const stageGate = compact ? buildPcnDossierStageGate({
    dossier: input.dossier,
    requirements: input.requirements,
    documents: input.documents || [],
    documentWaivers: input.dossier.documentWaivers,
  }) : undefined;
  const queueRow = buildQueueRowMap(input).get(input.dossier.id);
  const nodes = workflowStations.map((station) => buildDossierNode(
    station,
    input.dossier,
    currentStation,
    currentMainIndex,
    lastVisitedMainIndex,
    mainStationIndex,
    visitedKeys,
    completeness,
    queueRow,
    hasReturned,
    stageGate?.missingRequirementIds.length ?? completeness.stationMissingLabels.length,
  ));
  const currentNode = nodes.find((node) => node.key === currentStation.key) || nodes[nodes.length - 1];
  return {
    nodes,
    currentNodeKey: currentStation.key,
    currentNode,
    totalDossierCount: 1,
    hasReturned,
  };
}

export function filterPcnWorkflowDossiers(
  dossiers: CertificationDossier[],
  nodeKey: PcnPipelineStationKey,
  options?: { compact?: boolean },
): CertificationDossier[] {
  const station = getWorkflowStations(options?.compact).find((candidate) => candidate.key === nodeKey);
  return station ? dossiers.filter((dossier) => station.statuses.includes(dossier.status)) : [];
}

// --- End of pcnWorkflowMap.ts ---
