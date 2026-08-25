// Author: Codex
// OS support: Web/Node
// Description: Regression tests for searchable KQTN bulk target filtering.

import assert from 'node:assert/strict';
import test from 'node:test';

import { filterKqtnBulkCandidates } from '../utils/kqtnCandidateFilter';
import type { KqtnBulkCandidate } from '../utils/kqtnBulkMatching';

const candidates: KqtnBulkCandidate[] = [
  {
    id: 'r-1',
    sampleCode: 'Mẫu-001',
    sampleKey: 'MAU001',
    reportNo: 'ITD-2024-001',
    sampleName: 'Bếp từ',
    model: 'HPC 3S16H',
    brand: 'Bosch',
    sealStamp: 'SEAL-001',
    hasPdf: false,
  },
  {
    id: 'r-2',
    sampleCode: 'M-002',
    sampleKey: 'M002',
    reportNo: 'ITD-2024-002',
    sampleName: 'Máy hút bụi',
    model: 'VC-200',
    brand: 'Electrolux',
    sealStamp: 'SEAL-002',
    hasPdf: true,
  },
  {
    id: 'sample-head:3',
    sampleCode: 'M-003',
    sampleKey: 'M003',
    sampleName: 'Mẫu chờ KQTN',
    model: 'Pending model',
    hasPdf: false,
    isPending: true,
  },
];

test('filters by normalized Vietnamese sample name and model tokens', () => {
  assert.deepEqual(filterKqtnBulkCandidates(candidates, ' bep TU 3s16h ').map((candidate) => candidate.id), ['r-1']);
});

test('filters by report number, brand, and seal stamp', () => {
  assert.deepEqual(filterKqtnBulkCandidates(candidates, 'electrolux').map((candidate) => candidate.id), ['r-2']);
  assert.deepEqual(filterKqtnBulkCandidates(candidates, 'seal 002').map((candidate) => candidate.id), ['r-2']);
  assert.deepEqual(filterKqtnBulkCandidates(candidates, 'itd 2024 001').map((candidate) => candidate.id), ['r-1']);
});

test('empty query keeps pending candidates visible for warning rendering', () => {
  assert.deepEqual(filterKqtnBulkCandidates(candidates, '').map((candidate) => candidate.id), ['r-1', 'r-2', 'sample-head:3']);
});

// --- End of kqtn-candidate-filter.test.ts ---
