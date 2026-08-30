import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnRetentionMetadata, getPcnRetentionState, updatePcnLegalHold } from '../utils/pcnRetention.ts';

const archivedAt = '2025-03-03T00:00:00.000Z';

test('PCN retention stores reference deadlines from the archive date', () => {
  const retention = buildPcnRetentionMetadata(archivedAt);

  assert.equal(retention.policyVersion, 'PCN-REFERENCE-2026-08');
  assert.equal(retention.retentionStartAt, archivedAt);
  assert.equal(retention.paperRetentionUntil, '2026-03-03T00:00:00.000Z');
  assert.equal(retention.digitalRetentionUntil, '2035-03-03T00:00:00.000Z');
  assert.equal(retention.legalHold, false);
  assert.equal(getPcnRetentionState(retention, '2026-03-02T23:59:59.000Z'), 'ACTIVE');
  assert.equal(getPcnRetentionState(retention, '2026-03-03T00:00:00.000Z'), 'PAPER_REVIEW_DUE');
  assert.equal(getPcnRetentionState(retention, '2035-03-03T00:00:00.000Z'), 'DIGITAL_REVIEW_DUE');
});

test('PCN legal hold is explicit, reasoned, and suppresses retention warnings', () => {
  const retention = buildPcnRetentionMetadata(archivedAt);
  const held = updatePcnLegalHold(retention, {
    legalHold: true,
    reason: 'Đang phục vụ đánh giá công nhận.',
    actorUsername: 'admin',
    at: '2026-08-28T06:00:00.000Z',
  });

  assert.equal(held.legalHold, true);
  assert.equal(held.legalHoldReason, 'Đang phục vụ đánh giá công nhận.');
  assert.equal(held.legalHoldBy, 'admin');
  assert.equal(held.legalHoldAt, '2026-08-28T06:00:00.000Z');
  assert.equal(getPcnRetentionState(held, '2040-01-01T00:00:00.000Z'), 'LEGAL_HOLD');
  assert.throws(() => updatePcnLegalHold(retention, { legalHold: true }), /lý do/i);
  assert.deepEqual(updatePcnLegalHold(held, {
    legalHold: true,
    reason: 'Đang phục vụ đánh giá công nhận.',
    actorUsername: 'other-user',
    at: '2026-08-29T06:00:00.000Z',
  }), held);

  const released = updatePcnLegalHold(held, { legalHold: false, at: '2026-08-29T06:00:00.000Z' });
  assert.equal(released.legalHold, false);
  assert.equal('legalHoldReason' in released, false);
  assert.equal('legalHoldBy' in released, false);
  assert.equal('legalHoldAt' in released, false);
});

test('PCN archive retention is represented in the contract, UI, store, and server boundary', () => {
  const typesSource = fs.readFileSync(new URL('../types.ts', import.meta.url), 'utf8');
  const archiveSource = fs.readFileSync(new URL('../components/PcnArchiveView.tsx', import.meta.url), 'utf8');
  const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

  assert.match(typesSource, /PcnRetentionMetadata/);
  assert.match(typesSource, /retention\?: PcnRetentionMetadata/);
  assert.match(archiveSource, /legalHold/);
  assert.match(archiveSource, /bản mềm/i);
  assert.match(storeSource, /setDossierLegalHold/);
  assert.match(serverSource, /\/api\/pcn\/dossiers\/:dossierId\/retention/);
  assert.match(serverSource, /source: 'USER_REVIEW'/);
  assert.doesNotMatch(serverSource, /file_assets\s+SET/);
});

// --- End of pcn-retention.test.ts ---
