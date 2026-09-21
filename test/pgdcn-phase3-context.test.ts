import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { rememberPgdcnRecentRecord, type PgdcnRecentRecord } from '../utils/pgdcnRecent';
import { upsertPgdcnSavedFilter } from '../utils/pgdcnSavedFilters';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('recent records keep the latest six unique dossier entries', () => {
  let records: PgdcnRecentRecord[] = Array.from({ length: 6 }, (_, index) => ({
    domain: 'PCN' as const,
    recordId: `pcn-${index}`,
    openedAt: `2026-09-21T00:0${index}:00.000Z`,
  }));
  records = rememberPgdcnRecentRecord(records, 'PGD', 'pgd-latest', '2026-09-21T01:00:00.000Z');
  assert.equal(records.length, 6);
  assert.deepEqual(records[0], { domain: 'PGD', recordId: 'pgd-latest', openedAt: '2026-09-21T01:00:00.000Z' });
  assert.equal(records.some((item) => item.recordId === 'pcn-5'), false);
  records = rememberPgdcnRecentRecord(records, 'PGD', 'pgd-latest', '2026-09-21T02:00:00.000Z');
  assert.equal(records.filter((item) => item.recordId === 'pgd-latest').length, 1);
  assert.equal(records[0].openedAt, '2026-09-21T02:00:00.000Z');
});

test('saved filter presets update by name instead of duplicating entries', () => {
  const first = upsertPgdcnSavedFilter([], 'Hồ sơ thiếu tài liệu', { query: 'abc', values: { status: 'INCOMPLETE' } }, '2026-09-21T01:00:00.000Z');
  const second = upsertPgdcnSavedFilter(first, 'Hồ sơ thiếu tài liệu', { query: 'xyz', values: { status: 'COMPLETE' } }, '2026-09-21T02:00:00.000Z');
  assert.equal(second.length, 1);
  assert.equal(second[0].snapshot.query, 'xyz');
  assert.equal(second[0].snapshot.values.status, 'COMPLETE');
});

test('Phase 3 context entry points are wired to live dashboard, Data View, and AppShell callbacks', () => {
  const dashboard = read('../components/PgdcnDashboardView.tsx');
  const grid = read('../components/PgdcnDossierSummaryGrid.tsx');
  const appShell = read('../components/PgdcnAppShell.tsx');
  const palette = read('../components/PgdcnCommandPalette.tsx');
  assert.match(dashboard, /pgdcn-dashboard-recent-items/);
  assert.match(grid, /saved-filter-toolbar/);
  assert.match(grid, /readPgdcnSavedFilters/);
  assert.match(appShell, /Ctrl K/);
  assert.match(appShell, /recentRecords=\{recentRecords\}/);
  assert.match(palette, /aria-modal="true"/);
  assert.match(palette, /ArrowDown/);
});
