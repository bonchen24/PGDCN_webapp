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
const MAIN_STATION_INDEX = new Map<PcnPipelineStationKey, number>(
  PCN_PIPELINE_STATIONS.map((station, index) => [station.key, index]),
);
const VALID_DOSSIER_STATUSES = new Set<PcnDossierStatus>(
  WORKFLOW_STATIONS.flatMap((station) => station.statuses),
);

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
): PcnWorkflowNode {
  const stationDossiers = dossiers.filter((dossier) => station.statuses.includes(dossier.status));
  const overdueCount = stationDossiers.filter((dossier) => queueRows.get(dossier.id)?.priority === 'OVERDUE').length;
  const missingDocumentCount = stationDossiers.filter((dossier) => buildPcnDossierCompleteness({
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
  const nodes = WORKFLOW_STATIONS.map((station) => buildOverviewNode(station, input.dossiers, proposalsById, input, queueRows));
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
  visitedKeys: Set<PcnPipelineStationKey>,
  completeness: ReturnType<typeof buildPcnDossierCompleteness>,
  queueRow: ReturnType<typeof buildPcnWorkQueueRows>[number] | undefined,
  hasReturned: boolean,
): PcnWorkflowNode {
  const isCurrent = station.key === currentStation.key;
  const stationIndex = MAIN_STATION_INDEX.get(station.key);
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
    missingDocumentCount: isCurrent ? completeness.stationMissingLabels.length : 0,
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
  const currentStation = getPcnPipelineStation(input.dossier.status);
  const currentMainIndex = MAIN_STATION_INDEX.get(currentStation.key);
  const history = statusHistory(input.dossier, input.activityLogs || []);
  const visitedKeys = new Set(history.map((status) => getPcnPipelineStation(status).key));
  const visitedMainIndexes = history
    .map((status) => MAIN_STATION_INDEX.get(getPcnPipelineStation(status).key))
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
  const queueRow = buildQueueRowMap(input).get(input.dossier.id);
  const nodes = WORKFLOW_STATIONS.map((station) => buildDossierNode(
    station,
    input.dossier,
    currentStation,
    currentMainIndex,
    lastVisitedMainIndex,
    visitedKeys,
    completeness,
    queueRow,
    hasReturned,
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
): CertificationDossier[] {
  const station = WORKFLOW_STATIONS.find((candidate) => candidate.key === nodeKey);
  return station ? dossiers.filter((dossier) => station.statuses.includes(dossier.status)) : [];
}

// --- End of pcnWorkflowMap.ts ---
