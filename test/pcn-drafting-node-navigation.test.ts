import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPcnNodeDraftingRoute } from '../utils/draftingNavigation.ts';

test('node drafting route preserves supported form context and rejects generation-only kinds', () => {
  const route = buildPcnNodeDraftingRoute({
    dossierId: 'dossier-42',
    requirementId: 'QC4-COMMERCIAL',
    requirementCode: 'COMMERCIAL',
    nodeId: 'intake-commercial',
    returnTo: '/pgdcn/pcn/dossiers/dossier-42?tab=documents&node=intake-commercial',
  });

  assert.ok(route);
  const parsed = new URL(route, 'https://pgdcn.local');
  assert.equal(parsed.pathname, '/pgdcn/pcn/drafting');
  assert.equal(parsed.searchParams.get('dossierId'), 'dossier-42');
  assert.equal(parsed.searchParams.get('requirementId'), 'QC4-COMMERCIAL');
  assert.equal(parsed.searchParams.get('node'), 'intake-commercial');
  assert.equal(parsed.searchParams.get('kind'), 'COMMERCIAL');
  assert.equal(parsed.searchParams.get('returnTo'), '/pgdcn/pcn/dossiers/dossier-42?tab=documents&node=intake-commercial');

  assert.equal(buildPcnNodeDraftingRoute({
    dossierId: 'dossier-42',
    requirementId: 'QC9-SAMPLE_RETURN',
    requirementCode: 'SAMPLE_RETURN',
    nodeId: 'sample-return',
  }), undefined);
});
