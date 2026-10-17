import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildPcnDossierReturnRoute,
  buildPcnDraftingRoute,
  buildPgdDossierReturnRoute,
  buildPgdDraftingRoute,
  getPgdDossierStepForRequirement,
  sanitizeInternalReturnTo,
} from '../utils/draftingNavigation.ts';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PCN dossier drafting deep link carries dossier, requirement, node and form kind', () => {
  const route = buildPcnDraftingRoute({
    dossierId: 'dossier-1',
    requirementId: 'requirement-2',
    nodeId: 'documents',
    kind: 'PROPOSAL_FORM',
    returnTo: buildPcnDossierReturnRoute('dossier-1', { tab: 'documents', nodeId: 'documents' }),
  });
  const url = new URL(route, 'https://pgdcn.local');
  assert.equal(url.searchParams.get('dossierId'), 'dossier-1');
  assert.equal(url.searchParams.get('requirementId'), 'requirement-2');
  assert.equal(url.searchParams.get('node'), 'documents');
  assert.equal(url.searchParams.get('kind'), 'PROPOSAL_FORM');
  assert.equal(url.searchParams.get('returnTo'), '/pgdcn/pcn/dossiers/dossier-1?tab=documents&node=documents');
});

test('PGD dossier drafting deep link carries request, requirement, template and workflow step', () => {
  const route = buildPgdDraftingRoute({
    requestId: 'request-1',
    requirementCode: 'PGD_INTAKE_REQUEST',
    templateKind: 'INTAKE_REQUEST',
    returnTo: buildPgdDossierReturnRoute('request-1', { step: 'intake' }),
  });
  const url = new URL(route, 'https://pgdcn.local');
  assert.equal(url.searchParams.get('requestId'), 'request-1');
  assert.equal(url.searchParams.get('requirementCode'), 'PGD_INTAKE_REQUEST');
  assert.equal(url.searchParams.get('templateKind'), 'INTAKE_REQUEST');
  assert.equal(url.searchParams.get('returnTo'), '/pgdcn/pgd/dossiers/request-1?step=intake');
});

test('PGD requirement codes return to their matching dossier flow steps', () => {
  const mappings = [
    ['REQUEST_PYC', 'intake'],
    ['REQUEST_SUPPORTING', 'intake'],
    ['COMMERCIAL_CONTRACT', 'intake'],
    ['COMMERCIAL_INVOICE', 'intake'],
    ['PACKING_LIST', 'intake'],
    ['BILL_OF_LADING', 'intake'],
    ['CUSTOMS_DECLARATION', 'intake'],
    ['CERTIFICATE_OF_ORIGIN', 'intake'],
    ['ASSIGNMENT_FORM', 'assignment'],
    ['INSPECTION_PLAN', 'plan'],
    ['TECHNICAL_SPECIFICATION', 'plan'],
    ['MACHINERY_TECHNICAL_DOSSIER', 'plan'],
    ['COAL_TECHNICAL_OVERVIEW', 'plan'],
    ['COAL_QUALITY_SPECIFICATION', 'plan'],
    ['TECHNICAL_OVERVIEW', 'plan'],
    ['FIELD_INSPECTION_MINUTES', 'field'],
    ['FIELD_ACTIVITY_LOG', 'field'],
    ['MACHINERY_CONDITION_ASSESSMENT', 'field'],
    ['MACHINERY_SYNCHRONIZATION_ASSESSMENT', 'field'],
    ['FIELD_SAMPLE_TAKING', 'sampling'],
    ['SAMPLE_HANDOVER_LAB', 'lab-request'],
    ['LAB_RESULT', 'lab-result'],
    ['LAB_RESULT_REVIEW', 'result-review'],
    ['INSPECTION_REPORT', 'report'],
    ['DECISION', 'approval'],
    ['INSPECTION_CERTIFICATE', 'approval'],
    ['DOSSIER_COVER', 'return'],
    ['ARCHIVE_INDEX', 'return'],
  ] as const;

  for (const [requirementCode, expectedStep] of mappings) {
    assert.equal(getPgdDossierStepForRequirement(requirementCode), expectedStep, requirementCode);
  }
  assert.equal(getPgdDossierStepForRequirement('UNKNOWN_REQUIREMENT'), 'intake');
});

test('return context stays on the same dossier and rejects external destinations', () => {
  assert.equal(sanitizeInternalReturnTo('/pgdcn/pcn/dossiers/dossier-1?tab=documents&node=documents'), '/pgdcn/pcn/dossiers/dossier-1?tab=documents&node=documents');
  assert.equal(sanitizeInternalReturnTo('/pgdcn/pgd/dossiers/request-1?step=report'), '/pgdcn/pgd/dossiers/request-1?step=report');
  assert.equal(sanitizeInternalReturnTo('https://example.com/phishing'), undefined);
  assert.equal(sanitizeInternalReturnTo('//example.com/phishing'), undefined);
});

test('internal drafting links stay in-app while file preview/download links keep new-tab behavior', () => {
  const pcnNode = read('components/PcnDossierNodeWorkPanel.tsx');
  const pgdStep = read('components/PgdDossierStepWorkPanel.tsx');
  assert.doesNotMatch(pcnNode, /href=\{draftingHref\}[^\n]*target="_blank"/);
  assert.doesNotMatch(pgdStep, /href=\{draftingHref\}[^\n]*target="_blank"/);
  assert.match(pcnNode, /href=\{getPcnFileUrl\(version\.assetId\)\} target="_blank"/);
  assert.match(pgdStep, /getPgdDossierDocumentDownloadUrl\(document\.id\).*target="_blank"/);
});

test('successful attach exposes the dossier return action without advancing workflow', () => {
  const pcn = read('components/PcnDraftingWorkspaceView.tsx');
  const pgd = read('components/PgdDraftingWorkspaceView.tsx');
  assert.match(pcn, /Xác nhận & gắn vào bộ hồ sơ/);
  assert.match(pcn, /Quay lại hồ sơ/);
  assert.match(pgd, /data-testid="pgd-drafting-attach-success"/);
  assert.match(pgd, /Quay lại hồ sơ/);
  const pcnAttach = pcn.slice(pcn.indexOf('const confirmOutput'), pcn.indexOf('const sourceOptions'));
  const pgdAttach = pgd.slice(pgd.indexOf('const attachGenerated'), pgd.indexOf('const saveDraft'));
  assert.doesNotMatch(pcnAttach, /changeStatus|completeCurrentStep|advance\(/);
  assert.doesNotMatch(pgdAttach, /updateRequest|advance\(/);
});

// --- End of drafting-navigation-task4.test.ts ---
