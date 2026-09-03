import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canOpenPgdcnActivitySource,
  mergePgdcnActivityLogs,
  normalizePgdcnActivityLog,
} from '../utils/pgdcnActivity.ts';

const log = (overrides: Record<string, unknown> = {}) => ({
  id: 'activity-1',
  createdAt: '2026-09-02T03:00:00.000Z',
  actorName: 'Nguyễn Văn A',
  actorUsername: 'nva',
  action: 'UPDATED',
  entityType: 'SYSTEM',
  summary: 'Cập nhật hồ sơ',
  source: 'UI',
  ...overrides,
});

test('normalizes PCN and PGD audit rows with an explicit domain', () => {
  const pcn = normalizePgdcnActivityLog(log({ entityType: 'PCN_DOSSIER' }), 'activityLogs');
  const pgd = normalizePgdcnActivityLog(log({ id: 'pgd-1', domain: 'pgd', entityType: 'PGD_REQUEST' }), 'pgdActivityLogs');

  assert.equal(pcn.domain, 'PCN');
  assert.equal(pgd.domain, 'PGD');
  assert.equal(pgd.sourceCollection, 'pgdActivityLogs');
  assert.equal(pgd.entityType, 'PGD_REQUEST');
});

test('merges both sources with deterministic same-timestamp ordering and cursor continuation', () => {
  const rows = [
    { sourceCollection: 'pgdActivityLogs' as const, row: log({ id: 'pgd-same', domain: 'PGD' }) },
    { sourceCollection: 'activityLogs' as const, row: log({ id: 'pcn-same', domain: 'PCN' }) },
    { sourceCollection: 'activityLogs' as const, row: log({ id: 'pcn-old', createdAt: '2026-09-01T03:00:00.000Z', domain: 'PCN' }) },
  ];

  const firstPage = mergePgdcnActivityLogs(rows, { limit: 2 });
  assert.deepEqual(firstPage.items.map((item) => item.id), ['pcn-same', 'pgd-same']);
  assert.equal(firstPage.hasMore, true);
  assert.ok(firstPage.nextCursor);

  const secondPage = mergePgdcnActivityLogs(rows, { limit: 2, cursor: firstPage.nextCursor });
  assert.deepEqual(secondPage.items.map((item) => item.id), ['pcn-old']);
  assert.equal(secondPage.hasMore, false);
});

test('only exposes source navigation for a matching department scope', () => {
  const pcn = normalizePgdcnActivityLog(log({ domain: 'PCN', entityId: 'dossier-1' }), 'activityLogs');
  const pgd = normalizePgdcnActivityLog(log({ domain: 'PGD', entityId: 'request-1' }), 'pgdActivityLogs');

  assert.equal(canOpenPgdcnActivitySource(pcn, ['PCN']), true);
  assert.equal(canOpenPgdcnActivitySource(pgd, ['PCN']), false);
  assert.equal(canOpenPgdcnActivitySource(pgd, ['PCN', 'PGD']), true);
});
