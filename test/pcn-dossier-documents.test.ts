import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
  buildPcnUploadedDossierAttachment,
  buildPcnGeneratedDossierAttachment,
  buildPcnDossierChecklist,
  buildPcnDossierDocumentId,
  getPcnGeneratedDocumentRequirementCode,
  getPcnDocumentRequirements,
  getPcnDossierRequirementsWithCustom,
  mergePcnDossierChecklist,
} from '../utils/pcnDossierDocuments.ts';
import { confirmPcnDossierDocument, confirmPcnGeneratedDocumentIntoChecklist, generateAndAttachPcnDossierNodeDocument, removeCurrentPcnDossierDocument, uploadPcnDossierDocument, waivePcnDossierDocument } from '../utils/pcnDossierDocumentApi.ts';
import type { CertificationDossier, PcnGeneratedDocument } from '../types.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const documentApiSource = fs.readFileSync(new URL('../utils/pcnDossierDocumentApi.ts', import.meta.url), 'utf8');
const dossierStoreSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const customConfirmRouteSource = fs.readFileSync(new URL('../app/api/pcn/dossiers/[dossierId]/documents/[requirementId]/confirm/route.ts', import.meta.url), 'utf8');

test('PCN document baseline contains only QC4 and QC9 field checklists', () => {
  const qc4 = getPcnDocumentRequirements(['QC4']);
  const qc9 = getPcnDocumentRequirements(['QC9']);
  const qc20 = getPcnDocumentRequirements(['QC20']);
  const combined = getPcnDocumentRequirements(['QC4', 'QC9']);

  assert.ok(qc4.some((item) => item.code === 'SAMPLE_HANDOVER'));
  assert.ok(qc9.some((item) => item.code === 'SAMPLE_RETURN'));
  assert.ok(qc9.some((item) => item.code === 'EXTENSION_LETTER' && item.required === false));
  assert.deepEqual(qc20, []);
  assert.equal(combined.length, qc4.length + qc9.length);
  assert.equal(DEFAULT_PCN_DOCUMENT_REQUIREMENTS.length, combined.length);
});

test('dossier checklist is warning-first and preserves document versions', () => {
  const initial = buildPcnDossierChecklist('dossier-1', ['QC4'], undefined, '2026-08-28T01:00:00.000Z');
  const proposalRequirement = initial.find((item) => item.requirementId === 'QC4-PROPOSAL');
  assert.ok(proposalRequirement);
  assert.equal(proposalRequirement?.status, 'MISSING');

  const existing = [{
    ...proposalRequirement!,
    currentVersionId: 'pcn-file-version-1',
    status: 'PRESENT' as const,
    versions: [{ assetId: 'pcn-file-version-1', fileName: 'de-nghi-v1.pdf', uploadedAt: '2026-08-28T02:00:00.000Z' }],
  }];
  const merged = mergePcnDossierChecklist(existing, 'dossier-1', ['QC4']);
  const mergedProposal = merged.find((item) => item.requirementId === 'QC4-PROPOSAL');
  assert.equal(mergedProposal?.currentVersionId, 'pcn-file-version-1');
  assert.equal(mergedProposal?.versions.length, 1);
  assert.equal(merged.filter((item) => item.status === 'MISSING').length > 0, true);
});

test('uploaded dossier documents retain a pointer-only attachment provenance record', () => {
  const requirement = DEFAULT_PCN_DOCUMENT_REQUIREMENTS.find((item) => item.id === 'QC9-TEST_REPORT')!;
  const attachment = buildPcnUploadedDossierAttachment({
    dossierId: 'dossier-1',
    requirement,
    assetId: 'pcn-file-report-1',
    fileName: 'kqtn.pdf',
    mimeType: 'application/pdf',
    byteSize: 123,
    sha256: 'a'.repeat(64),
    uploadedAt: '2026-08-28T05:00:00.000Z',
    uploadedBy: 'operator',
  });

  assert.equal(attachment.requirementId, requirement.id);
  assert.equal(attachment.mappingStatus, 'MANUAL_MAPPED');
  assert.equal(attachment.kind, 'TEST_REPORT');
  assert.equal(attachment.sourceRelativePath, 'PCN_UPLOAD/kqtn.pdf');
  assert.equal('bytes' in attachment, false);
  assert.equal('absolutePath' in attachment, false);
});

test('dossier upload uses the canonical checklist document id for asset provenance', () => {
  assert.match(documentApiSource, /buildPcnDossierDocumentId/);
  assert.match(documentApiSource, /sourceDocumentId: documentId/);
  assert.match(serverSource, /const documentId = buildPcnDossierDocumentId\(dossierId, requirementId\)/);
  assert.match(serverSource, /assetRow\.source_document_id !== documentId/);
});

test('dossier upload client sends the same checklist id that the server verifies', async () => {
  const requirement = DEFAULT_PCN_DOCUMENT_REQUIREMENTS.find((item) => item.id === 'QC4-PROPOSAL')!;
  const expectedDocumentId = buildPcnDossierDocumentId('dossier-1', requirement.id);
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    calls.push({ input, init });
    if (String(input) === '/api/pcn/files') {
      return Response.json({ asset: {
        id: 'pcn-file-upload-1',
        bucketName: 'pcn-private',
        objectPath: 'pcnFiles/dossierDocuments/document',
        sourceCollection: 'dossierDocuments',
        sourceDocumentId: expectedDocumentId,
        sourceJsonPath: requirement.id,
        mimeType: 'application/pdf',
        byteSize: 1,
        sha256: 'a'.repeat(64),
      } });
    }
    return Response.json({ document: { id: expectedDocumentId }, asset: {}, dossier: {}, attachment: {}, activityLog: null });
  }) as typeof fetch;
  try {
    const file = Object.assign(new Blob(['x'], { type: 'application/pdf' }), { name: 'de-nghi.pdf' }) as unknown as File;
    await uploadPcnDossierDocument({ dossierId: 'dossier-1', requirement, file });
    const form = calls[0].init?.body as FormData;
    assert.equal(form.get('sourceCollection'), 'dossierDocuments');
    assert.equal(form.get('sourceDocumentId'), expectedDocumentId);
    assert.equal(form.get('sourceJsonPath'), requirement.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('custom PCN upload resolves its definition from the dossier snapshot and waits for confirmation', () => {
  assert.match(dossierStoreSource, /getPcnDossierRequirementsWithCustom\(dossier, get\(\)\.documentRequirements,[\s\S]*?\.find/);
  assert.match(documentApiSource, /\/documents\/\$\{encodeURIComponent\(input\.requirementId\)\}\/confirm/);
  assert.match(customConfirmRouteSource, /requirementDefinitions\?\.find\(\(item\) => item\.domain === 'PCN'/);
  assert.match(customConfirmRouteSource, /source_collection !== 'dossierDocuments'/);
  assert.match(customConfirmRouteSource, /source_json_path !== requirementId/);
  assert.match(customConfirmRouteSource, /lifecycleStatus: 'CONFIRMED'/);
});

test('conditional custom PCN requirements activate only for their allowlisted result and stay unique in projected catalogs', () => {
  const dossier = {
    fieldCodes: ['QC4'],
    workflowSnapshot: {
      templateCode: 'CUSTOM-CONDITIONAL',
      templateVersion: 1,
      nodes: [],
      transitions: [],
      capturedAt: '2026-10-10T00:00:00.000Z',
      capturedBy: 'admin',
      requirementDefinitions: [{
        domain: 'PCN' as const,
        id: 'pcn-custom-condition',
        code: 'CUSTOM_CONDITION',
        name: 'Bằng chứng khi không đạt',
        level: 'CONDITIONAL' as const,
        source: 'UPLOAD_EXTERNAL' as const,
        condition: 'RESULT_FAILED' as const,
        ownerRole: 'CUSTOMER' as const,
        multiplicity: 'SINGLE' as const,
      }],
    },
  } as CertificationDossier;
  const inactive = getPcnDossierRequirementsWithCustom(dossier);
  const active = getPcnDossierRequirementsWithCustom(dossier, DEFAULT_PCN_DOCUMENT_REQUIREMENTS, { resultOutcome: 'FAIL' });
  const reprojected = getPcnDossierRequirementsWithCustom(dossier, active, { resultOutcome: 'FAIL' });

  assert.equal(inactive.find((item) => item.id === 'pcn-custom-condition')?.required, false);
  assert.equal(active.find((item) => item.id === 'pcn-custom-condition')?.required, true);
  assert.equal(reprojected.filter((item) => item.id === 'pcn-custom-condition').length, 1);
});

test('custom dossier document confirmation calls the authorized server boundary', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: unknown; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    calls.push({ url: input, init });
    return new Response(JSON.stringify({ document: { id: 'doc-1', lifecycleStatus: 'CONFIRMED' } }), { status: 201, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await confirmPcnDossierDocument({ dossierId: 'dossier-1', requirementId: 'custom-1' });
    assert.equal(String(calls[0].url), '/api/pcn/dossiers/dossier-1/documents/custom-1/confirm');
    assert.equal(calls[0].init?.method, 'POST');
    assert.equal(result.document?.lifecycleStatus, 'CONFIRMED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated management forms expose only exact one-to-one checklist mappings', () => {
  assert.equal(getPcnGeneratedDocumentRequirementCode('PROPOSAL_FORM'), 'PROPOSAL');
  assert.equal(getPcnGeneratedDocumentRequirementCode('ASSIGNMENT_FORM'), 'ASSIGNMENT_FORM');
  assert.equal(getPcnGeneratedDocumentRequirementCode('EVALUATION_PLAN'), 'EVALUATION_PLAN');
  assert.equal(getPcnGeneratedDocumentRequirementCode('FIELD_INSPECTION'), 'FIELD_INSPECTION');
  assert.equal(getPcnGeneratedDocumentRequirementCode('SAMPLE_TAKING'), 'SAMPLE_HANDOVER');
  assert.equal(getPcnGeneratedDocumentRequirementCode('SAMPLE_CODING'), 'SAMPLE_CODING');
  assert.equal(getPcnGeneratedDocumentRequirementCode('SAMPLE_HANDOVER'), 'SAMPLE_HANDOVER');
  assert.equal(getPcnGeneratedDocumentRequirementCode('SAMPLE_RETURN'), 'SAMPLE_RETURN');
  assert.equal(getPcnGeneratedDocumentRequirementCode('LAB_REQUEST'), 'LAB_REQUEST');
  assert.equal(getPcnGeneratedDocumentRequirementCode('DOSSIER_COVER'), undefined);
  assert.equal(getPcnGeneratedDocumentRequirementCode('EVALUATION_REPORT'), undefined);
});

test('generated confirmation attachment keeps lineage visible without sharing the generated pointer', () => {
  const generated: PcnGeneratedDocument = {
    id: 'pcn-generated-dossier-1-assignment-form-pdf-context',
    dossierId: 'dossier-1',
    kind: 'ASSIGNMENT_FORM',
    format: 'PDF',
    fileAssetId: 'pcn-file-generated-assignment',
    fileName: 'dossier-1-phieu-phan-cong.pdf',
    mimeType: 'application/pdf',
    byteSize: 321,
    sha256: 'a'.repeat(64),
    contextHash: 'b'.repeat(64),
    generatedAt: '2026-08-29T02:00:00.000Z',
  };
  const requirement = DEFAULT_PCN_DOCUMENT_REQUIREMENTS.find((item) => item.id === 'QC4-ASSIGNMENT_FORM')!;
  const attachment = buildPcnGeneratedDossierAttachment({ dossierId: generated.dossierId, requirement, generated, assetId: 'pcn-file-confirmed-assignment' });
  assert.equal(attachment.requirementId, requirement.id);
  assert.equal(attachment.mappingStatus, 'MANUAL_MAPPED');
  assert.match(attachment.mappingReason || '', /ASSIGNMENT_FORM/);
  assert.match(attachment.sourceRelativePath, /PCN_GENERATED/);
  assert.equal(attachment.assetId, 'pcn-file-confirmed-assignment');
  assert.notEqual(attachment.assetId, generated.fileAssetId);
});

test('generated confirmation client sends an explicit generated document and checklist requirement', async () => {
  const requirement = DEFAULT_PCN_DOCUMENT_REQUIREMENTS.find((item) => item.id === 'QC4-ASSIGNMENT_FORM')!;
  const generated: PcnGeneratedDocument = {
    id: 'generated-assignment-1',
    dossierId: 'dossier-1',
    kind: 'ASSIGNMENT_FORM',
    format: 'PDF',
    fileAssetId: 'pcn-file-generated-assignment-1',
    fileName: 'assignment.pdf',
    mimeType: 'application/pdf',
    byteSize: 12,
    sha256: 'c'.repeat(64),
    contextHash: 'd'.repeat(64),
    generatedAt: '2026-08-29T02:00:00.000Z',
  };
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    calls.push({ input, init });
    return Response.json({ document: { id: 'dossier-document-1' }, asset: {}, dossier: {}, attachment: {}, activityLog: null });
  }) as typeof fetch;
  try {
    await confirmPcnGeneratedDocumentIntoChecklist({ dossierId: generated.dossierId, generated, requirement });
    assert.equal(calls.length, 1);
    assert.equal(String(calls[0].input), '/api/pcn/dossiers/dossier-1/documents/confirm-generated');
    assert.equal(JSON.parse(String(calls[0].init?.body)).generatedDocumentId, generated.id);
    assert.equal(JSON.parse(String(calls[0].init?.body)).requirementId, requirement.id);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('generated confirmation route copies into dossier provenance and audits the explicit boundary', () => {
  const route = serverSource.slice(serverSource.indexOf("app.post('/api/pcn/dossiers/:dossierId/documents/confirm-generated'"));
  assert.match(serverSource, /app\.post\('\/api\/pcn\/dossiers\/:dossierId\/documents\/confirm-generated'/);
  assert.match(route, /pcnGeneratedDocuments/);
  assert.match(route, /source_collection !== 'pcnGeneratedDocuments'/);
  assert.match(route, /downloadObject/);
  assert.match(route, /sourceCollection.*dossierDocuments|dossierDocuments.*sourceCollection/);
  assert.match(route, /Xác nhận bản sinh/);
  assert.match(route, /validateActivityLogPayload/);
});

test('node document boundaries keep waiver and remove-current operations explicit', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    calls.push({ input, init });
    return Response.json({ document: { id: 'dossier-document-1' }, dossier: {}, activityLog: null });
  }) as typeof fetch;
  try {
    await waivePcnDossierDocument({ dossierId: 'dossier-1', requirementId: 'QC4-COMMERCIAL', reason: 'Bổ sung sau' });
    await removeCurrentPcnDossierDocument({ dossierId: 'dossier-1', requirementId: 'QC4-COMMERCIAL' });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls.map((call) => `${call.init?.method} ${call.input}`), [
    'POST /api/pcn/dossiers/dossier-1/documents/QC4-COMMERCIAL/waive',
    'POST /api/pcn/dossiers/dossier-1/documents/QC4-COMMERCIAL/remove-current',
  ]);
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { reason: 'Bổ sung sau' });
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {});
});

test('server keeps current-document removal non-destructive and waiver audited', () => {
  assert.match(serverSource, /app\.post\('\/api\/pcn\/dossiers\/:dossierId\/documents\/:requirementId\/waive'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/dossiers\/:dossierId\/documents\/:requirementId\/remove-current'/);
  const removeRoute = serverSource.slice(serverSource.indexOf("app.post('/api/pcn/dossiers/:dossierId/documents/:requirementId/remove-current'"));
  assert.match(removeRoute, /currentVersionId/);
  assert.match(removeRoute, /versions/);
  assert.match(removeRoute, /validateActivityLogPayload/);
  assert.match(removeRoute, /MISSING/);
});

test('node work generation uses a dedicated generate-and-attach boundary', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    calls.push({ input, init });
    return Response.json({ generated: { id: 'generated-1' }, document: { id: 'document-1' }, activityLog: null });
  }) as typeof fetch;
  try {
    await generateAndAttachPcnDossierNodeDocument({ dossierId: 'dossier-1', nodeId: 'assignment', requirementId: 'QC4-ASSIGNMENT_FORM' });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(String(calls[0].input), '/api/pcn/dossiers/dossier-1/node-work/assignment/generate-and-attach');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { requirementId: 'QC4-ASSIGNMENT_FORM' });
  const route = serverSource.slice(serverSource.indexOf("app.post('/api/pcn/dossiers/:dossierId/node-work/:nodeId/generate-and-attach'"));
  assert.match(route, /getPcnNodeDocumentGenerationKind/);
  assert.match(route, /renderPcnNodeGeneratedDocx/);
  assert.match(route, /buildPcnGeneratedDossierAttachment/);
  assert.match(route, /Tự sinh và gắn/);
});

// --- End of pcn-dossier-documents.test.ts ---
