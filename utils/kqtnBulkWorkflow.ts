// Author: Gemini
// OS support: Web/Node
// Description: Builds safe upload plans that map split KQTN PDF segments to real targets.

import type { KqtnBulkCandidate } from './kqtnBulkMatching';

export interface KqtnBulkUploadPlanSegment {
  id: string;
  status: string;
  candidateId?: string;
  pageStart: number;
  pageEnd: number;
}

export interface KqtnBulkUploadPlan<T extends KqtnBulkUploadPlanSegment> {
  queue: Array<{ segment: T; candidate: KqtnBulkCandidate }>;
  pendingSegmentIds: string[];
  missingSegmentIds: string[];
  duplicateTargetIds: string[];
}

export function isKqtnBulkUploadTarget(candidate: KqtnBulkCandidate | undefined): boolean {
  return Boolean(candidate && !candidate.isPending && !candidate.id.startsWith('sample-head:'));
}

export function buildKqtnBulkUploadPlan<T extends KqtnBulkUploadPlanSegment>(
  segments: readonly T[],
  candidates: readonly KqtnBulkCandidate[],
  retryOnlyFailed = false,
): KqtnBulkUploadPlan<T> {
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const pending = segments.filter((segment) => {
    if (segment.status === 'uploaded' || segment.status === 'skipped') return false;
    if (retryOnlyFailed && segment.status !== 'failed') return false;
    return Boolean(segment.candidateId && !isKqtnBulkUploadTarget(candidateMap.get(segment.candidateId)) && candidateMap.get(segment.candidateId));
  });
  const missing = segments.filter((segment) => {
    if (segment.status === 'uploaded' || segment.status === 'skipped') return false;
    if (retryOnlyFailed && segment.status !== 'failed') return false;
    return !segment.candidateId || !candidateMap.has(segment.candidateId);
  });
  const candidatesForQueue = segments.filter((segment) => {
    if (segment.status === 'uploaded' || segment.status === 'skipped') return false;
    if (retryOnlyFailed && segment.status !== 'failed') return false;
    return isKqtnBulkUploadTarget(candidateMap.get(segment.candidateId || ''));
  });
  const queue = candidatesForQueue.map((segment) => ({
    segment,
    candidate: candidateMap.get(segment.candidateId as string) as KqtnBulkCandidate,
  }));
  const counts = new Map<string, number>();
  queue.forEach(({ candidate }) => counts.set(candidate.id, (counts.get(candidate.id) || 0) + 1));

  return {
    queue,
    pendingSegmentIds: pending.map((segment) => segment.id),
    missingSegmentIds: missing.map((segment) => segment.id),
    duplicateTargetIds: [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  };
}

// --- End of kqtnBulkWorkflow.ts ---
