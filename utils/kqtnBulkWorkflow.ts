// Author: Gemini
// OS support: Web/Node
// Description: Builds upload plans that map split KQTN PDF segments to selected targets.

import type { KqtnBulkCandidate } from './kqtnBulkMatching';

export interface KqtnBulkUploadPlanSegment {
  id: string;
  status: string;
  candidateId?: string;
  pageStart: number;
  pageEnd: number;
  splitFileReady: boolean;
}

export interface KqtnBulkUploadPlan<T extends KqtnBulkUploadPlanSegment> {
  queue: Array<{ segment: T; candidate: KqtnBulkCandidate }>;
  pendingSegmentIds: string[];
  missingSegmentIds: string[];
  duplicateTargetIds: string[];
  unsplitSegmentIds: string[];
}

export function isKqtnBulkUploadTarget(candidate: KqtnBulkCandidate | undefined): boolean {
  // A pending sample head is a valid target. The UI warns about the missing
  // KQTN record and prepares it immediately before the PDF upload.
  return Boolean(candidate);
}

export function buildKqtnBulkUploadPlan<T extends KqtnBulkUploadPlanSegment>(
  segments: readonly T[],
  candidates: readonly KqtnBulkCandidate[],
  retryOnlyFailed = false,
): KqtnBulkUploadPlan<T> {
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const missing = segments.filter((segment) => {
    if (segment.status === 'uploaded' || segment.status === 'skipped') return false;
    if (retryOnlyFailed && segment.status !== 'failed') return false;
    return !segment.candidateId || !candidateMap.has(segment.candidateId);
  });
  const unsplit = segments.filter((segment) => {
    if (segment.status === 'uploaded' || segment.status === 'skipped') return false;
    if (retryOnlyFailed && segment.status !== 'failed') return false;
    return !segment.splitFileReady;
  });
  const candidatesForQueue = segments.filter((segment) => {
    if (segment.status === 'uploaded' || segment.status === 'skipped') return false;
    if (retryOnlyFailed && segment.status !== 'failed') return false;
    return segment.splitFileReady && isKqtnBulkUploadTarget(candidateMap.get(segment.candidateId || ''));
  });
  const queue = candidatesForQueue.map((segment) => ({
    segment,
    candidate: candidateMap.get(segment.candidateId as string) as KqtnBulkCandidate,
  }));
  const counts = new Map<string, number>();
  queue.forEach(({ candidate }) => counts.set(candidate.id, (counts.get(candidate.id) || 0) + 1));

  return {
    queue,
    // Missing KQTN is a warning-only state; an unavailable target is handled
    // by missingSegmentIds instead of being silently dropped from the queue.
    pendingSegmentIds: [],
    missingSegmentIds: missing.map((segment) => segment.id),
    duplicateTargetIds: [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
    unsplitSegmentIds: unsplit.map((segment) => segment.id),
  };
}

// --- End of kqtnBulkWorkflow.ts ---
