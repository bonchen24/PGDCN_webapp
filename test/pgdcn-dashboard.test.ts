import assert from 'node:assert/strict';
import test from 'node:test';

import { getPgdcnDashboardProjection } from '../utils/pgdcnDashboard.ts';

test('projects six department KPIs and tagged attention rows without merging records', () => {
  const projection = getPgdcnDashboardProjection({
    scopes: ['PCN', 'PGD'],
    pcnDossiers: [
      { id: 'pcn-1', dossierCode: 'PCN-1', status: 'TECHNICAL_REVIEW', targetDate: '2026-09-01' },
      { id: 'pcn-2', dossierCode: 'PCN-2', status: 'ARCHIVED', targetDate: '2026-08-01' },
    ],
    pgdRequests: [
      { id: 'pgd-1', requestCode: 'PGD-1', status: 'LEADERSHIP_APPROVAL', inspectionScheduledAt: '2026-09-01T03:00:00.000Z' },
    ],
    now: new Date('2026-09-02T03:00:00.000Z'),
  });

  assert.deepEqual(projection.kpis, {
    pcnDossiers: 2,
    pgdRequests: 1,
    pcnWork: 1,
    pgdWork: 1,
    aiCandidates: 2,
    attention: 2,
  });
  assert.deepEqual(projection.attention.map((item) => item.domain), ['PCN', 'PGD']);
  assert.deepEqual(projection.attention.map((item) => item.id), ['pcn-1', 'pgd-1']);
});

test('filters department dashboard records by the current scopes', () => {
  const projection = getPgdcnDashboardProjection({
    scopes: ['PCN'],
    pcnDossiers: [{ id: 'pcn-1', dossierCode: 'PCN-1', status: 'WAITING_APPROVAL' }],
    pgdRequests: [{ id: 'pgd-1', requestCode: 'PGD-1', status: 'TECHNICAL_REVIEW' }],
  });

  assert.equal(projection.kpis.pcnDossiers, 1);
  assert.equal(projection.kpis.pgdRequests, 0);
  assert.equal(projection.kpis.aiCandidates, 1);
  assert.equal(projection.attention.every((item) => item.domain === 'PCN'), true);
});
