// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for clearing and replacing RequestModal field values

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const requestModal = fs.readFileSync(new URL('../components/RequestModal.tsx', import.meta.url), 'utf8');

test('keeps numeric request fields blank while the user is editing them', () => {
  assert.match(requestModal, /value=\{generalInfo\.resultCopyCount === 0 \? '' : generalInfo\.resultCopyCount\}/);
  assert.match(requestModal, /value=\{currentSample\.quantity === 0 \? '' : currentSample\.quantity\}/);
  assert.match(requestModal, /value=\{currentSample\.retryCount \?\? ''\}/);
  assert.match(requestModal, /value=\{sample\.quantity === 0 \? '' : sample\.quantity\}/);
  assert.match(requestModal, /value=\{sample\.retryCount \?\? ''\}/);
  assert.doesNotMatch(requestModal, /parseInt\(e\.target\.value\) \|\| 1/);
  assert.doesNotMatch(requestModal, /Math\.max\(0, parseInt\(e\.target\.value\) \|\| 0\)/);
});

test('does not reapply generated text defaults while the user is editing', () => {
  assert.match(requestModal, /value=\{currentSample\.sealStamp\}/);
  assert.match(requestModal, /value=\{sample\.mtt \?\? ''\}/);
  assert.match(requestModal, /value=\{sample\.unit \?\? ''\}/);
  assert.doesNotMatch(requestModal, /value=\{currentSample\.sealStamp \|\| \(generalInfo\.sealStamp/);
  assert.doesNotMatch(requestModal, /value=\{sample\.mtt \|\| `M\$\{String\(sIdx \+ 1\)/);
  assert.doesNotMatch(requestModal, /value=\{sample\.unit \|\| 'Cái'\}/);
});

// --- End of request-modal-input-editing.test.ts ---
