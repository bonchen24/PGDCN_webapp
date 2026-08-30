import test from 'node:test';
import assert from 'node:assert/strict';

import type { CertificationDossier, CertificationProposal, IssuancePackage, OutboundLabRequest, PcnSampleLot, PcnSampleRoute, ReturnedTestResult } from '../types.ts';
import { getPcnDataIntegrityReport } from '../utils/pcnDataIntegrity.ts';

const proposal: CertificationProposal = {
  id: 'proposal-1',
  proposalCode: 'PCN-001',
  channel: 'DIRECT',
  status: 'CONVERTED',
  dossierId: 'dossier-1',
  customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' },
  productName: 'Thiết bị A',
  quantity: 1,
  fieldCodes: ['QC4'],
  receivedAt: '2026-08-01T00:00:00.000Z',
};

const dossier: CertificationDossier = {
  id: 'dossier-1',
  dossierCode: 'HS-001',
  proposalId: proposal.id,
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'AWAITING_RESULTS',
  labRequestIds: ['request-1'],
  returnedResultIds: ['result-1'],
};

const lot: PcnSampleLot = {
  id: 'lot-1',
  dossierId: dossier.id,
  lotCode: 'LOT-001',
  sampleName: 'Mẫu A',
  quantity: 1,
  fieldCodes: ['QC4'],
  routeIds: ['route-1'],
  status: 'IN_TRANSIT',
  currentLocation: 'PTN A',
};

const route: PcnSampleRoute = {
  id: 'route-1',
  sampleLotId: lot.id,
  labCode: 'PERFORMANCE',
  labName: 'PTN A',
  status: 'RESULT_RETURNED',
  labRequestId: 'request-1',
};

const request: OutboundLabRequest = {
  id: 'request-1',
  pycNumber: 'PYC-001',
  dossierId: dossier.id,
  fieldCode: 'QC4',
  laboratoryName: 'PTN A',
  sampleLotId: lot.id,
  sampleRouteId: route.id,
  status: 'RESULT_RETURNED',
  requestedAt: '2026-08-02T00:00:00.000Z',
  returnedResultId: 'result-1',
};

const result: ReturnedTestResult = {
  id: 'result-1',
  dossierId: dossier.id,
  labRequestId: request.id,
  round: 1,
  outcome: 'PASS',
  receivedAt: '2026-08-03T00:00:00.000Z',
};

const issuance: IssuancePackage = {
  id: 'issuance-1',
  dossierId: dossier.id,
  certificateTemplateCode: 'GCN-QC4',
  decisionTemplateCode: 'QD-QC4',
  documentType: 'CERTIFICATE',
  status: 'DRAFT',
  fileAssetIds: [],
};

function validSnapshot() {
  return {
    proposals: [proposal],
    dossiers: [dossier],
    sampleLots: [lot],
    sampleRoutes: [route],
    labRequests: [request],
    returnedResults: [result],
    issuancePackages: [issuance],
  };
}

test('valid PCN snapshot has no integrity issues', () => {
  const report = getPcnDataIntegrityReport(validSnapshot());

  assert.equal(report.issueCount, 0);
  assert.equal(report.affectedRecordCount, 0);
  assert.deepEqual(report.issues, []);
});

test('empty PCN customer records are reported without mutating the snapshot', () => {
  const snapshot = {
    ...validSnapshot(),
    customers: [{ id: 'KH-smoke', name: '', address: '', customerCode: '' }],
  };

  const report = getPcnDataIntegrityReport(snapshot as any);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'customers'
    && issue.entityId === 'KH-smoke'
    && issue.code === 'EMPTY_CUSTOMER_RECORD'
  )), true);
  assert.equal(snapshot.customers[0].id, 'KH-smoke');
});

test('duplicate identifiers within one collection are reported without mutating the snapshot', () => {
  const duplicateProposal = { ...proposal };
  const snapshot = validSnapshot();
  snapshot.proposals = [proposal, duplicateProposal];

  const report = getPcnDataIntegrityReport(snapshot);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'certificationProposals'
    && issue.entityId === proposal.id
    && issue.code === 'DUPLICATE_ID'
  )), true);
  assert.equal(snapshot.proposals.length, 2);
});

test('proposal-to-dossier backlink mismatches are reported without mutating the snapshot', () => {
  const snapshot = validSnapshot();
  snapshot.proposals = [{ ...proposal, dossierId: 'dossier-missing' }];

  const report = getPcnDataIntegrityReport(snapshot);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'certificationProposals'
    && issue.entityId === proposal.id
    && issue.code === 'MISSING_DOSSIER_LINK'
  )), true);
  assert.equal(snapshot.proposals[0].dossierId, 'dossier-missing');
});

test('multiple dossiers linked to one proposal are reported without mutating the snapshot', () => {
  const snapshot = validSnapshot();
  snapshot.dossiers = [dossier, { ...dossier, id: 'dossier-2', dossierCode: 'HS-002' }];

  const report = getPcnDataIntegrityReport(snapshot);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'certificationDossiers'
    && issue.entityId === 'dossier-2'
    && issue.code === 'DUPLICATE_PROPOSAL_LINK'
  )), true);
  assert.equal(snapshot.dossiers.length, 2);
});

test('returned result links are checked back to the referenced PYC', () => {
  const snapshot = validSnapshot();
  snapshot.labRequests = [request, { ...request, id: 'request-2', pycNumber: 'PYC-002', returnedResultId: undefined }];
  snapshot.returnedResults = [{ ...result, labRequestId: 'request-2' }];

  const report = getPcnDataIntegrityReport(snapshot);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'returnedResults'
    && issue.entityId === result.id
    && issue.code === 'MISSING_RESULT_LINK'
  )), true);
});

test('dossier sample and issuance pointers are checked back to their owning dossier', () => {
  const snapshot = validSnapshot();
  snapshot.dossiers = [{ ...dossier, sampleLotIds: ['lot-2'], issuancePackageId: 'issuance-2' }];
  snapshot.sampleLots = [lot, { ...lot, id: 'lot-2', lotCode: 'LOT-002', dossierId: 'dossier-other' }];
  snapshot.issuancePackages = [issuance, { ...issuance, id: 'issuance-2', dossierId: 'dossier-other' }];

  const report = getPcnDataIntegrityReport(snapshot);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'certificationDossiers'
    && issue.entityId === dossier.id
    && issue.code === 'MISSING_DOSSIER_LINK'
    && issue.message.includes('Lô mẫu lot-2')
  )), true);
  assert.equal(report.issues.some((issue) => (
    issue.collection === 'certificationDossiers'
    && issue.entityId === dossier.id
    && issue.code === 'MISSING_ISSUANCE_LINK'
  )), true);
});

test('PYC and KQTN must also appear in the owning dossier backlink arrays', () => {
  const snapshot = validSnapshot();
  snapshot.dossiers = [{ ...dossier, labRequestIds: [], returnedResultIds: [] }];

  const report = getPcnDataIntegrityReport(snapshot);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'labRequests'
    && issue.entityId === request.id
    && issue.code === 'MISSING_DOSSIER_LINK'
  )), true);
  assert.equal(report.issues.some((issue) => (
    issue.collection === 'returnedResults'
    && issue.entityId === result.id
    && issue.code === 'MISSING_DOSSIER_LINK'
  )), true);
});

test('malformed result is reported without throwing or mutating the snapshot', () => {
  const malformedResult = { id: 'demo' } as unknown as ReturnedTestResult;
  const report = getPcnDataIntegrityReport({
    ...validSnapshot(),
    dossiers: [{ ...dossier, returnedResultIds: [] }],
    labRequests: [{ ...request, returnedResultId: undefined }],
    returnedResults: [malformedResult],
  });

  assert.equal(report.affectedRecordCount, 1);
  assert.deepEqual(report.issues.map((issue) => issue.code), [
    'MISSING_DOSSIER_LINK',
    'MISSING_LAB_REQUEST_LINK',
    'INVALID_ROUND',
    'MISSING_RESULT_OUTCOME',
    'INVALID_RECEIVED_AT',
  ]);
  assert.equal(malformedResult.id, 'demo');
});

test('integrity report rejects impossible UTC calendar dates instead of trusting JavaScript normalization', () => {
  const report = getPcnDataIntegrityReport({
    ...validSnapshot(),
    returnedResults: [{ ...result, receivedAt: '2026-02-30T00:00:00.000Z' }],
  });

  assert.equal(report.issues.some((issue) => issue.collection === 'returnedResults' && issue.code === 'INVALID_RECEIVED_AT'), true);
});

test('cross-link mismatches identify the affected record and stable reason', () => {
  const brokenDossier = { ...dossier, proposalId: 'proposal-missing', returnedResultIds: ['result-missing'] };
  const brokenRequest = { ...request, dossierId: 'dossier-missing', sampleLotId: 'lot-missing', sampleRouteId: 'route-missing' };
  const report = getPcnDataIntegrityReport({
    proposals: [proposal],
    dossiers: [brokenDossier],
    sampleLots: [lot],
    sampleRoutes: [route],
    labRequests: [brokenRequest],
    returnedResults: [result],
    issuancePackages: [{ ...issuance, dossierId: 'dossier-missing' }],
  });

  assert.equal(report.issues.some((issue) => issue.collection === 'certificationDossiers' && issue.entityId === dossier.id && issue.code === 'MISSING_PROPOSAL_LINK'), true);
  assert.equal(report.issues.some((issue) => issue.collection === 'labRequests' && issue.entityId === request.id && issue.code === 'MISSING_DOSSIER_LINK'), true);
  assert.equal(report.issues.some((issue) => issue.collection === 'labRequests' && issue.code === 'MISSING_SAMPLE_LOT_LINK'), true);
  assert.equal(report.issues.some((issue) => issue.collection === 'issuancePackages' && issue.code === 'MISSING_DOSSIER_LINK'), true);
});

test('template without a private asset is reported for read-only review', () => {
  const report = getPcnDataIntegrityReport({
    ...validSnapshot(),
    templates: [{
      id: 'pcn-qc4-certificate-tool',
      fieldCode: 'QC4',
      documentKind: 'CERTIFICATE',
      displayName: 'GCN QC4',
      sourceLabel: 'Nguồn PCN',
      format: 'DOCX',
      status: 'DISCOVERED',
      placeholderKeys: [],
      requiredPlaceholderKeys: [],
      sourceFingerprint: { sourceRelativePath: 'GCN.docx', byteSize: 1 },
    }],
  } as any);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'pcnTemplateDefinitions'
    && issue.entityId === 'pcn-qc4-certificate-tool'
    && issue.code === 'MISSING_TEMPLATE_ASSET'
  )), true);
});

test('template with an unverified private asset is reported without changing the template', () => {
  const template = {
    id: 'pcn-qc9-certificate-method-1',
    fieldCode: 'QC9',
    documentKind: 'CERTIFICATE',
    displayName: 'GCN QC9',
    sourceLabel: 'Nguồn PCN',
    format: 'DOCX',
    status: 'NEEDS_ANNOTATION',
    placeholderKeys: [],
    requiredPlaceholderKeys: [],
    sourceFingerprint: { sourceRelativePath: 'GCN.docx', byteSize: 2, sha256: 'sha-template' },
    fileAssetId: 'asset-conflict',
    privateAssetVerified: false,
    privateAssetVerificationIssue: 'SHA256_MISMATCH',
  };
  const report = getPcnDataIntegrityReport({ ...validSnapshot(), templates: [template] } as any);

  assert.equal(report.issues.some((issue) => (
    issue.collection === 'pcnTemplateDefinitions'
    && issue.entityId === template.id
    && issue.code === 'INVALID_TEMPLATE_ASSET_POINTER'
  )), true);
  assert.equal(report.issues.find((issue) => issue.entityId === template.id)?.message.includes('SHA256_MISMATCH'), true);
  assert.equal(template.fileAssetId, 'asset-conflict');
});
