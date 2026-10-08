import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createPcnIssuanceBundle, actOnPcnApprovalStep, deliverPcnIssuance, archivePcnIssuance, attachPcnIssuanceFile } from '../utils/pcnIssuanceApi.ts';
import { issuePcnIssuance } from '../utils/pcnSignerDelegationApi.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const issuanceUiSource = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PCN issuance lifecycle mutations use dedicated atomic boundaries', () => {
  for (const route of [
    "app.post('/api/pcn/issuance'",
    "app.post('/api/pcn/issuance/:issuanceId/approval/:stepId'",
    "app.post('/api/pcn/issuance/:issuanceId/issue'",
    "app.post('/api/pcn/issuance/:issuanceId/deliver'",
    "app.post('/api/pcn/issuance/:issuanceId/archive'",
  ]) {
    assert.match(serverSource, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const issuanceBoundary = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/issuance'") ,
    serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'") ,
  );
  assert.match(issuanceBoundary, /withPgTransaction/);
  assert.match(issuanceBoundary, /FOR UPDATE/);
  assert.match(issuanceBoundary, /approvalSteps/);
  assert.match(issuanceBoundary, /isPcnApprovalComplete/);
  assert.match(issuanceBoundary, /idempotencyKey/);
  assert.match(issuanceBoundary, /activityLogs/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/issuance\/:issuanceId\/file'/);
  assert.match(serverSource, /source_collection.*issuancePackages/);
  assert.match(serverSource, /getPcnIssuanceOfficialDocumentReadiness/);
  assert.match(serverSource, /source_collection === 'pcnTemplateDefinitions'/);
  assert.match(storeSource, /preflightOfficialDocuments/);
  assert.match(designSource, /Cổng readiness phát hành chỉ kiểm tra snapshot hồ sơ PCN hiện tại/);

  for (const method of ['createIssuanceBundle', 'actOnApprovalStep', 'issuePackage', 'deliverPackage', 'archivePackage', 'attachIssuanceFile']) {
    const start = storeSource.indexOf(`${method}: async`);
    const end = storeSource.indexOf('\n  },', start);
    const slice = storeSource.slice(start, end);
    assert.doesNotMatch(slice, /saveDoc\('/);
    assert.doesNotMatch(slice, /writePcnActivity/);
  }
  assert.match(storeSource, /createPcnIssuanceBundle|createPcnIssuance/);
  assert.match(storeSource, /actOnPcnApprovalStep|updatePcnApproval/);
  assert.match(designSource, /POST \/api\/pcn\/issuance/);
  assert.match(designSource, /idempotencyKey/);
});

test('PCN issuance API clients send stable operation payloads', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Response.json({ issuance: { id: 'issuance-1' }, dossier: { id: 'dossier-1' }, steps: [], activityLogs: [] });
  }) as typeof fetch;

  try {
    await createPcnIssuanceBundle('dossier-1', 'issuance-create-1');
    await actOnPcnApprovalStep('issuance-1', 'approval-1', 'APPROVE', undefined, 'approval-1');
    await issuePcnIssuance('issuance-1', { issuanceNumber: 'GCN-001', signerUsername: 'admin', issuedAt: '2026-08-28' }, 'issue-1');
    await deliverPcnIssuance('issuance-1', { recipient: 'Khách hàng' }, 'deliver-1');
    await archivePcnIssuance('issuance-1', 'archive-1');
    await attachPcnIssuanceFile('issuance-1', 'pcn-file-1', 'certificate.pdf', 'file-1');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(calls.map((call) => [call.url, JSON.parse(String(call.init?.body))]), [
    ['/api/pcn/issuance', { dossierId: 'dossier-1', idempotencyKey: 'issuance-create-1' }],
    ['/api/pcn/issuance/issuance-1/approval/approval-1', { decision: 'APPROVE', idempotencyKey: 'approval-1' }],
    ['/api/pcn/issuance/issuance-1/issue', { issuanceNumber: 'GCN-001', signerUsername: 'admin', issuedAt: '2026-08-28', idempotencyKey: 'issue-1' }],
    ['/api/pcn/issuance/issuance-1/deliver', { recipient: 'Khách hàng', idempotencyKey: 'deliver-1' }],
    ['/api/pcn/issuance/issuance-1/archive', { idempotencyKey: 'archive-1' }],
    ['/api/pcn/issuance/issuance-1/file', { assetId: 'pcn-file-1', fileName: 'certificate.pdf', idempotencyKey: 'file-1' }],
  ]);
});

test('issuance readiness verifies official template assets belong to the private PCN bucket', () => {
  const issueRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/issue'"),
    serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"),
  );

  assert.match(issueRoute, /SELECT id, bucket_name, source_collection, source_document_id, source_json_path, mime_type/);
  assert.match(issueRoute, /String\(asset\.bucket_name\) === getPcnStorageBucket\(\)/);
});

test('issuance creation binds an existing bundle to the original idempotency key', () => {
  const createRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/issuance'") ,
    serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/approval/:stepId'") ,
  );

  assert.match(createRoute, /pcn-issuance-create:\$\{dossierId\}/);
  assert.match(createRoute, /idempotencyFingerprint/);
  assert.match(createRoute, /existingActivity\.idempotencyKey[\s\S]*idempotencyKey/);
  assert.match(createRoute, /idempotencyKey đã được dùng cho lần tạo bộ phát hành khác/);
});

test('issuance mutation forms guard duplicate submissions and keep rejected modals open', () => {
  assert.match(issuanceUiSource, /submittingIssueId/);
  assert.match(issuanceUiSource, /submittingDeliveryId/);
  assert.match(issuanceUiSource, /archivingIssuanceId/);
  assert.match(issuanceUiSource, /archiveIssuance/);
  assert.match(issuanceUiSource, /\.catch\(\(\) => undefined\)/);
  assert.match(issuanceUiSource, /disabled=\{isSubmitting\}/);
  assert.match(designSource, /khóa nút xác nhận trong khi request đang chờ/);
});

// --- End of pcn-issuance-boundary.test.ts ---
