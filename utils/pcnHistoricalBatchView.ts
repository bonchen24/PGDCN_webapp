// Author: Codex
// OS support: Browser
// Description: Read-only summaries for historical-import batches already present in PCN

import type { ActivityLog, CertificationDossier, PcnDossierAttachment } from '../types.ts';

export interface PcnHistoricalBatchSummary {
  batchId: string;
  importedAt?: string;
  sourceFamilies: Array<'QC4' | 'QC9'>;
  dossierCount: number;
  attachmentCount: number;
  importedBytes: number;
  pendingReviewCount: number;
}

type HistoricalDossier = Pick<CertificationDossier, 'id' | 'historicalImport'>;
type HistoricalAttachment = Pick<PcnDossierAttachment, 'dossierId' | 'byteSize'>;
type HistoricalActivity = Pick<ActivityLog, 'entityId' | 'entityType' | 'action' | 'source' | 'groupId' | 'createdAt'>;

interface BatchAccumulator {
  batchId: string;
  importedAt?: string;
  sourceFamilies: Set<'QC4' | 'QC9'>;
  dossierIds: Set<string>;
  attachmentCount: number;
  importedBytes: number;
  pendingReviewCount: number;
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function timestamp(value: unknown): number | undefined {
  const parsed = Date.parse(clean(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function latestTimestamp(left?: string, right?: string): string | undefined {
  const leftTime = timestamp(left);
  const rightTime = timestamp(right);
  if (leftTime === undefined) return rightTime === undefined ? left : right;
  if (rightTime === undefined) return left;
  return rightTime > leftTime ? right : left;
}

function activityBatchId(activity: HistoricalActivity): string {
  return clean(activity.entityId) || clean(activity.groupId);
}

export function buildPcnHistoricalBatchSummaries(
  dossiers: HistoricalDossier[],
  attachments: HistoricalAttachment[],
  activityLogs: HistoricalActivity[],
): PcnHistoricalBatchSummary[] {
  const batches = new Map<string, BatchAccumulator>();
  const dossierBatchIds = new Map<string, string>();

  for (const dossier of dossiers || []) {
    const historicalImport = dossier.historicalImport;
    const batchId = clean(historicalImport?.batchId);
    const dossierId = clean(dossier.id);
    if (!batchId || !dossierId) continue;
    const current = batches.get(batchId) || {
      batchId,
      sourceFamilies: new Set<'QC4' | 'QC9'>(),
      dossierIds: new Set<string>(),
      attachmentCount: 0,
      importedBytes: 0,
      pendingReviewCount: 0,
    } satisfies BatchAccumulator;
    current.dossierIds.add(dossierId);
    if (historicalImport?.sourceFamily === 'QC4' || historicalImport?.sourceFamily === 'QC9') current.sourceFamilies.add(historicalImport.sourceFamily);
    current.importedAt = latestTimestamp(current.importedAt, historicalImport?.importedAt);
    if (historicalImport?.reviewStatus === 'PENDING_REVIEW') current.pendingReviewCount += 1;
    batches.set(batchId, current);
    dossierBatchIds.set(dossierId, batchId);
  }

  for (const attachment of attachments || []) {
    const batchId = dossierBatchIds.get(clean(attachment.dossierId));
    const current = batchId ? batches.get(batchId) : undefined;
    if (!current) continue;
    current.attachmentCount += 1;
    const byteSize = Number(attachment.byteSize);
    if (Number.isFinite(byteSize) && byteSize > 0) current.importedBytes += Math.floor(byteSize);
  }

  const batchActivityDates = new Map<string, string>();
  for (const activity of activityLogs || []) {
    if (activity.source !== 'IMPORT' || activity.entityType !== 'SYSTEM' || activity.action !== 'IMPORTED') continue;
    const batchId = activityBatchId(activity);
    const createdAt = clean(activity.createdAt);
    if (!batchId || timestamp(createdAt) === undefined) continue;
    batchActivityDates.set(batchId, latestTimestamp(batchActivityDates.get(batchId), createdAt) || createdAt);
  }

    return [...batches.values()]
    .map((batch) => ({
      batchId: batch.batchId,
      ...(batchActivityDates.get(batch.batchId) || batch.importedAt ? { importedAt: batchActivityDates.get(batch.batchId) || batch.importedAt } : {}),
      sourceFamilies: (['QC4', 'QC9'] as const).filter((family) => batch.sourceFamilies.has(family)),
      dossierCount: batch.dossierIds.size,
      attachmentCount: batch.attachmentCount,
      importedBytes: batch.importedBytes,
      pendingReviewCount: batch.pendingReviewCount,
    }))
      .sort((left, right) => (timestamp(right.importedAt) ?? 0) - (timestamp(left.importedAt) ?? 0) || right.batchId.localeCompare(left.batchId));
}

// --- End of pcnHistoricalBatchView.ts ---
