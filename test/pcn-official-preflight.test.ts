import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnOfficialGenerationContextHash } from '../utils/pcnOfficialTemplateGeneration.ts';
import { generatePcnOfficialDocuments } from '../utils/pcnOfficialDocumentApi.ts';

const apiSource = fs.readFileSync(new URL('../utils/pcnOfficialDocumentApi.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const issuanceSource = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
const issuancePolicySource = fs.readFileSync(new URL('../utils/pcnIssuance.ts', import.meta.url), 'utf8');
const browserPolicySource = fs.readFileSync(new URL('../utils/pcnOfficialTemplatePolicy.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('official generation context hash is stable across requested-kind ordering', () => {
  const first = buildPcnOfficialGenerationContextHash([
    { documentKind: 'CERTIFICATE', contextHash: 'a'.repeat(64) },
    { documentKind: 'DECISION', contextHash: 'b'.repeat(64) },
  ]);
  const repeated = buildPcnOfficialGenerationContextHash([
    { documentKind: 'DECISION', contextHash: 'b'.repeat(64) },
    { documentKind: 'CERTIFICATE', contextHash: 'a'.repeat(64) },
  ]);
  const changed = buildPcnOfficialGenerationContextHash([
    { documentKind: 'CERTIFICATE', contextHash: 'c'.repeat(64) },
    { documentKind: 'DECISION', contextHash: 'b'.repeat(64) },
  ]);

  assert.equal(first, repeated);
  assert.notEqual(first, changed);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('official generation exposes a read-only preflight and binds generation to its result', () => {
  assert.match(apiSource, /preflightPcnOfficialDocuments/);
  assert.match(apiSource, /expectedContextHash/);
  assert.match(serverSource, /dryRun/);
  assert.match(serverSource, /expectedContextHash/);
  assert.match(serverSource, /statusCode: 409/);
  assert.match(storeSource, /preflightOfficialDocuments/);
  assert.match(issuanceSource, /Kiểm tra dữ liệu chính thức/);
  assert.match(issuanceSource, /preflightOfficialDocuments/);
  assert.match(designSource, /dryRun=true.*readiness riêng cho từng loại tài liệu/);
});

test('issuance readiness keeps browser policy separate from Node document rendering', () => {
  assert.doesNotMatch(issuancePolicySource, /pcnOfficialTemplateGeneration/);
  assert.match(issuancePolicySource, /pcnOfficialTemplatePolicy/);
  assert.doesNotMatch(browserPolicySource, /node:crypto|docxtemplater|pizzip/);
});

test('official generation requires a server-validated hash and asset provenance', () => {
  const officialRoute = serverSource.slice(serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"));
  assert.match(officialRoute, /!dryRun && !expectedContextHash/);
  assert.match(officialRoute, /MISSING_PRIVATE_ASSET/);
  assert.match(serverSource, /source_collection === 'pcnTemplateDefinitions'/);
  assert.match(serverSource, /source_json_path === 'fileAssetId'/);
  assert.match(designSource, /privateAssetVerified.*projection read-only/i);
});

test('official document client refuses to call generation without a valid preflight hash', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return Response.json({});
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => generatePcnOfficialDocuments('issuance-1', ['CERTIFICATE'], ['DOCX'], ''),
      /expectedContextHash|kiểm tra dữ liệu/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(calls, 0);
});

test('official generation context hash binds the requested output formats', () => {
  const items = [
    { documentKind: 'CERTIFICATE' as const, contextHash: 'a'.repeat(64) },
    { documentKind: 'DECISION' as const, contextHash: 'b'.repeat(64) },
  ];
  const hash = buildPcnOfficialGenerationContextHash as unknown as (
    inputItems: Array<{ documentKind: 'CERTIFICATE' | 'DECISION'; contextHash: string }>,
    formats?: Array<'DOCX' | 'PDF'>,
  ) => string;
  assert.notEqual(hash(items, ['DOCX']), hash(items, ['PDF']));
  assert.equal(hash(items, ['PDF', 'DOCX']), hash(items, ['DOCX', 'PDF']));
});

// --- End of pcn-official-preflight.test.ts ---
