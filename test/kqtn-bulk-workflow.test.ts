// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for mapping split KQTN PDF segments to upload targets.

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildKqtnBulkUploadPlan } from '../utils/kqtnBulkWorkflow';
import type { KqtnBulkCandidate } from '../utils/kqtnBulkMatching';

const candidate = (id: string, overrides: Partial<KqtnBulkCandidate> = {}): KqtnBulkCandidate => ({
  id,
  sampleCode: id.toUpperCase(),
  sampleKey: id,
  model: 'MODEL-A',
  hasPdf: false,
  ...overrides,
});

test('pairs each split segment with its selected KQTN target', () => {
  const plan = buildKqtnBulkUploadPlan([
    { id: 'segment-1', status: 'ready', candidateId: 'record-1', pageStart: 1, pageEnd: 2, splitFileReady: true },
    { id: 'segment-2', status: 'ready', candidateId: 'record-2', pageStart: 3, pageEnd: 4, splitFileReady: true },
  ], [candidate('record-1'), candidate('record-2')]);

  assert.deepEqual(plan.queue.map(({ segment, candidate: target }) => ({
    segmentId: segment.id,
    targetId: target.id,
    pageStart: segment.pageStart,
    pageEnd: segment.pageEnd,
  })), [
    { segmentId: 'segment-1', targetId: 'record-1', pageStart: 1, pageEnd: 2 },
    { segmentId: 'segment-2', targetId: 'record-2', pageStart: 3, pageEnd: 4 },
  ]);
});

test('queues a pending sample head and leaves the no-KQTN state as a warning', () => {
  const plan = buildKqtnBulkUploadPlan([
    { id: 'segment-pending', status: 'ready', candidateId: 'sample-head:atd-001', pageStart: 1, pageEnd: 1, splitFileReady: true },
  ], [candidate('sample-head:atd-001', { isPending: true })]);

  assert.deepEqual(plan.queue.map(({ segment, candidate: target }) => ({ segmentId: segment.id, targetId: target.id })), [
    { segmentId: 'segment-pending', targetId: 'sample-head:atd-001' },
  ]);
  assert.deepEqual(plan.pendingSegmentIds, []);
});

test('retry mode only returns failed segments and never reuploads completed work', () => {
  const plan = buildKqtnBulkUploadPlan([
    { id: 'segment-uploaded', status: 'uploaded', candidateId: 'record-1', pageStart: 1, pageEnd: 1, splitFileReady: true },
    { id: 'segment-failed', status: 'failed', candidateId: 'record-2', pageStart: 2, pageEnd: 2, splitFileReady: true },
    { id: 'segment-ready', status: 'ready', candidateId: 'record-3', pageStart: 3, pageEnd: 3, splitFileReady: true },
  ], [candidate('record-1'), candidate('record-2'), candidate('record-3')], true);

  assert.deepEqual(plan.queue.map(({ segment }) => segment.id), ['segment-failed']);
});

test('keeps mapped segments out of the upload queue until child PDFs are materialized', () => {
  const plan = buildKqtnBulkUploadPlan([
    { id: 'segment-unsplit', status: 'ready', candidateId: 'record-1', pageStart: 1, pageEnd: 2, splitFileReady: false },
  ], [candidate('record-1')]);

  assert.deepEqual(plan.queue, []);
  assert.deepEqual(plan.unsplitSegmentIds, ['segment-unsplit']);
});

// --- End of kqtn-bulk-workflow.test.ts ---
