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

test('checklist-backed draft forms keep the selected requirement and workflow node in navigation', () => {
  const certificationResultRoute = buildPcnNodeDraftingRoute({
    dossierId: 'dossier-42',
    requirementId: 'QC4-CERTIFICATION_RESULT',
    requirementCode: 'CERTIFICATION_RESULT',
    nodeId: 'technical-review',
    returnTo: '/pgdcn/pcn/dossiers/dossier-42?tab=documents&node=technical-review',
  });
  assert.ok(certificationResultRoute, 'a supported certification result form should open from its node');
  const certificationResult = new URL(certificationResultRoute, 'https://pgdcn.local');
  assert.equal(certificationResult.searchParams.get('requirementId'), 'QC4-CERTIFICATION_RESULT');
  assert.equal(certificationResult.searchParams.get('node'), 'technical-review');
  assert.equal(certificationResult.searchParams.get('kind'), 'CERTIFICATION_RESULT');
  assert.equal(certificationResult.searchParams.get('returnTo'), '/pgdcn/pcn/dossiers/dossier-42?tab=documents&node=technical-review');

  const clientPackageRoute = buildPcnNodeDraftingRoute({
    dossierId: 'dossier-42',
    requirementId: 'QC4-CLIENT_PACKAGE',
    requirementCode: 'CLIENT_PACKAGE',
    nodeId: 'delivery-archive',
    returnTo: '/pgdcn/pcn/dossiers/dossier-42?tab=documents&node=delivery-archive',
  });
  assert.ok(clientPackageRoute, 'a supported client package form should open from its node');
  const clientPackage = new URL(clientPackageRoute, 'https://pgdcn.local');
  assert.equal(clientPackage.searchParams.get('requirementId'), 'QC4-CLIENT_PACKAGE');
  assert.equal(clientPackage.searchParams.get('node'), 'delivery-archive');
  assert.equal(clientPackage.searchParams.get('kind'), 'CLIENT_PACKAGE');
  assert.equal(clientPackage.searchParams.get('returnTo'), '/pgdcn/pcn/dossiers/dossier-42?tab=documents&node=delivery-archive');
});
