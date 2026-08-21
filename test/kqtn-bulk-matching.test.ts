// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for AI-assisted KQTN PDF candidate matching.

import assert from 'node:assert/strict';
import test from 'node:test';

import { matchKqtnBulkFile, type KqtnBulkCandidate } from '../utils/kqtnBulkMatching';

const candidates: KqtnBulkCandidate[] = [
  { id: 'r-1', sampleCode: 'ATD-001', sampleKey: 'ATD001', model: 'Model Alpha', hasPdf: false },
  { id: 'r-2', sampleCode: 'ATD-002', sampleKey: 'ATD002', model: 'Model Beta', hasPdf: true },
];

test('matches by normalized sample code with high confidence', () => {
  const result = matchKqtnBulkFile({ fileName: 'ket-qua_ATD 001.pdf', sampleCode: 'atd001' }, candidates);
  assert.equal(result.candidateId, 'r-1');
  assert.equal(result.confidence, 'high');
  assert.equal(result.needsManualSelection, false);
});

test('falls back to an exact model match when code is unavailable', () => {
  const result = matchKqtnBulkFile({ fileName: 'model-beta-result.pdf', model: 'MODEL BETA' }, candidates);
  assert.equal(result.candidateId, 'r-2');
  assert.equal(result.confidence, 'medium');
  assert.equal(result.needsManualSelection, false);
});

test('requires manual selection for ambiguous model matches', () => {
  const ambiguous = candidates.concat({ id: 'r-3', sampleCode: 'ATD-003', sampleKey: 'ATD003', model: 'Model Beta', hasPdf: false });
  const result = matchKqtnBulkFile({ fileName: 'unknown.pdf', model: 'Model Beta' }, ambiguous);
  assert.equal(result.candidateId, undefined);
  assert.equal(result.needsManualSelection, true);
  assert.match(result.reason, /nhiều/i);
});

test('returns no match when neither code nor model identifies a sample', () => {
  const result = matchKqtnBulkFile({ fileName: 'unrelated.pdf' }, candidates);
  assert.equal(result.candidateId, undefined);
  assert.equal(result.confidence, 'none');
  assert.equal(result.needsManualSelection, true);
});

// --- End of kqtn-bulk-matching.test.ts ---
