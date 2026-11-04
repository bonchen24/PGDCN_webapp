// Author: Codex
// Description: Regression tests for KQTN payment unlock and private PDF download policy.

import assert from 'node:assert/strict';
import test from 'node:test';
import { canDownloadKqtnPdf, isKqtnPaymentManager, isKqtnPaymentStateChanged } from '../utils/kqtnPaymentPolicy.ts';

test('Admin, office clerk, and room managers can change payment unlock state', () => {
  assert.equal(isKqtnPaymentManager({ role: 'admin' }), true);
  assert.equal(isKqtnPaymentManager({ role: 'office_clerk' }), true);
  assert.equal(isKqtnPaymentManager({ role: 'tester', position: 'Quản lý phòng' }), true);
  assert.equal(isKqtnPaymentManager({ role: 'viewer', position: 'Trưởng phòng' }), true);
  assert.equal(isKqtnPaymentManager({ role: 'tester' }), false);
  assert.equal(isKqtnPaymentManager({ role: 'viewer' }), false);
  assert.equal(isKqtnPaymentManager(null), false);
});

test('normal users can download only after payment is confirmed while Admin bypasses the lock', () => {
  const locked = { customerPaymentConfirmed: false };
  const unlocked = { customerPaymentConfirmed: true };

  assert.equal(canDownloadKqtnPdf(locked, { role: 'tester' }), false);
  assert.equal(canDownloadKqtnPdf(locked, { role: 'viewer' }), false);
  assert.equal(canDownloadKqtnPdf(locked, { role: 'office_clerk' }), false);
  assert.equal(canDownloadKqtnPdf(locked, { role: 'admin' }), true);
  assert.equal(canDownloadKqtnPdf(unlocked, { role: 'tester' }), true);
  assert.equal(canDownloadKqtnPdf(unlocked, { role: 'viewer' }), true);
  assert.equal(canDownloadKqtnPdf(unlocked, null), false);
});

test('treats missing legacy payment state as the default locked state', () => {
  assert.equal(isKqtnPaymentStateChanged(undefined, { customerPaymentConfirmed: false }), false);
  assert.equal(isKqtnPaymentStateChanged({ customerPaymentConfirmed: false }, { customerPaymentConfirmed: true }), true);
  assert.equal(isKqtnPaymentStateChanged({ customerPaymentConfirmed: true }, {}), false);
});

// --- End of kqtn-payment-policy.test.ts ---
