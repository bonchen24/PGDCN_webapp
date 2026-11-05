import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { installDocumentDatabase, routeRequest } from './helpers/document-route-database.ts';
import { PGD_COLLECTIONS } from '../utils/pgdDomain.ts';

// Next bundles the server's existing CommonJS policy lookup. Supply Node's
// equivalent loader when invoking the real handler directly under tsx ESM.
(globalThis as any).require = createRequire(import.meta.url);

const createRoute = await import('../app/api/pgd/requests/route.ts');
const ownerRoute = await import('../app/api/pgd/requests/[requestId]/owner/route.ts');
const manager = { username: 'manager', name: 'Manager', systemRole: 'staff', role: 'staff', departmentScopes: ['PGD'], pgdRole: 'PGD_MANAGER' };
const employee = { username: 'new-owner', name: 'New Owner', systemRole: 'staff', role: 'staff', active: true, departmentScopes: ['PGD'], pgdRole: 'PGD_INSPECTOR' };
const ownerContext = { params: Promise.resolve({ requestId: 'request-1' }) };
const assign = (user: Record<string, any> | undefined = manager, ownerUsername = 'new-owner') => ownerRoute.PUT(routeRequest('/api/pgd/requests/request-1/owner', 'PUT', { ownerUsername }, user), ownerContext);

test('PGD POST leaves a new request unassigned despite creator and supplied owner values and remains idempotent', async (t) => {
  const db = installDocumentDatabase(t);
  const create = () => createRoute.POST(routeRequest('/api/pgd/requests', 'POST', { ...routeIntake, ownerUsername: 'injected-owner', ownerAssignedAt: '2026-01-01T00:00:00Z' }, manager));
  const response = await create();
  assert.equal(response.status, 201);
  const { request } = await response.json();
  assert.equal(request.ownerUsername, null);
  assert.equal(request.ownerAssignedAt, undefined);
  assert.equal(request.id, routeIntake.id);
  assert.equal(request.domain, 'pgd');
  assert.ok(request.dossierChecklist.length > 0);
  assert.equal(request.workflowTemplatePending, true);
  assert.deepEqual((await (await create()).json()).request, request);
  assert.equal(db.list(PGD_COLLECTIONS.requests).length, 1);
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 1);
  assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.ownerUsername, null);
});

test('PGD owner PUT rejects staff, viewers and non-PGD managers before opening a transaction', async (t) => {
  const db = installDocumentDatabase(t);
  for (const actor of [employee, { ...manager, pgdRole: 'PGD_VIEWER' }, { ...manager, departmentScopes: ['PCN'] }]) {
    assert.equal((await assign(actor)).status, 403);
  }
  const anonymous = await ownerRoute.PUT(routeRequest('/api/pgd/requests/request-1/owner', 'PUT', { ownerUsername: 'new-owner' }), ownerContext);
  assert.equal(anonymous.status, 401);
  assert.deepEqual(db.statements, []);
});

test('PGD owner PUT persists one ASSIGNED audit and targeted notification, with no effects for same-owner retries', async (t) => {
  const db = installDocumentDatabase(t);
  db.seed(PGD_COLLECTIONS.requests, 'request-1', { domain: 'pgd', requestCode: 'PGD-261105-01', status: 'DRAFT', ownerUsername: 'old-owner' });
  db.seed('systemUsers', employee.username, employee);
  const response = await assign();
  assert.equal(response.status, 200);
  const { request } = await response.json();
  assert.equal(request.ownerUsername, 'new-owner');
  assert.ok(request.ownerAssignedAt);
  assert.equal(request.id, 'request-1');
  const audit = db.list(PGD_COLLECTIONS.activityLogs);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].data.action, 'ASSIGNED');
  assert.equal(audit[0].data.actorUsername, 'manager');
  assert.ok(audit[0].data.changes.some((change: any) => change.field === 'ownerUsername' && change.before === 'old-owner' && change.after === 'new-owner'));
  const notifications = db.list('notifications');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].data.action, 'ASSIGNED');
  assert.deepEqual(notifications[0].data.targetUsernames, ['new-owner']);
  assert.equal(notifications[0].data.entityId, 'request-1');
  const firstStatements = db.statements.length;
  assert.deepEqual((await (await assign()).json()).request, request);
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 1);
  assert.equal(db.list('notifications').length, 1);
  assert.equal(db.statements.slice(firstStatements).some((sql) => /^(INSERT|UPDATE)/.test(sql)), false);
});

test('PGD owner PUT rejects missing, inactive, out-of-scope and viewer assignees without mutation', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  db.seed(PGD_COLLECTIONS.requests, 'request-1', { domain: 'pgd', requestCode: 'PGD-261105-01', status: 'DRAFT' });
  assert.equal((await assign()).status, 400);
  for (const invalid of [{ active: false }, { departmentScopes: ['PCN'] }, { pgdRole: 'PGD_VIEWER' }, { systemRole: 'viewer', role: 'viewer' }]) {
    db.seed('systemUsers', employee.username, { ...employee, ...invalid });
    assert.equal((await assign()).status, 400);
  }
  assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.ownerUsername, undefined);
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);
  assert.equal(db.list('notifications').length, 0);
});

test('PGD owner PUT keeps signed, returned and archived requests locked', async (t) => {
  t.mock.method(console, 'error', () => {});
  const db = installDocumentDatabase(t);
  db.seed('systemUsers', employee.username, employee);
  for (const status of ['SIGNED', 'RESULT_RETURNED', 'ARCHIVED']) {
    db.seed(PGD_COLLECTIONS.requests, 'request-1', { domain: 'pgd', status, ownerUsername: 'old-owner' });
    assert.equal((await assign()).status, 400);
    assert.equal(db.list(PGD_COLLECTIONS.requests)[0].data.ownerUsername, 'old-owner');
  }
  assert.equal(db.list(PGD_COLLECTIONS.activityLogs).length, 0);
  assert.equal(db.list('notifications').length, 0);
});

test('PGD same-owner PUT preserves the original assignment timestamp without writes', async (t) => {
  const db = installDocumentDatabase(t);
  db.seed(PGD_COLLECTIONS.requests, 'request-1', { domain: 'pgd', status: 'DRAFT', ownerUsername: 'new-owner', ownerAssignedAt: '2026-01-01T00:00:00Z' });
  db.seed('systemUsers', employee.username, employee);
  const response = await assign();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).request.ownerAssignedAt, '2026-01-01T00:00:00Z');
  assert.equal(db.statements.some((sql) => /^(INSERT|UPDATE)/.test(sql)), false);
});

test('PGD assignment notification persists transactionally and targets only the new owner', async (t) => {
  const db = installDocumentDatabase(t);
  db.seed(PGD_COLLECTIONS.requests, 'request-1', { domain: 'pgd', requestCode: 'PGD-261105-01', status: 'DRAFT', ownerUsername: 'old-owner' });
  db.seed('systemUsers', employee.username, employee);
  assert.equal((await assign()).status, 200);
  const notifications = db.list('notifications');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].data.action, 'ASSIGNED');
  assert.deepEqual(notifications[0].data.targetUsernames, ['new-owner']);
  assert.equal(notifications[0].data.domain, 'PGD');
  assert.ok(db.statements.includes('COMMIT'));
});

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGD dossier operations expose owner, generated-document attachment, and package APIs', () => {
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  const server = read('server.legacy.ts');
  assert.match(api, /requests\/\$\{encodeURIComponent\(requestId\)\}\/owner/);
  assert.match(api, /attachPgdGeneratedDocument/);
  assert.match(api, /getPgdDossierPackageUrl/);
  assert.match(store, /assignOwner/);
  assert.match(store, /attachGeneratedDocument/);
  assert.match(server, /api\/pgd\/requests\/:requestId\/owner/);
  assert.match(server, /split_part\(lower\(COALESCE\(data->>'username'/);
  assert.match(server, /attach-generated/);
  assert.match(server, /api\/pgd\/requests\/:requestId\/package/);
  assert.match(server, /buildPgdDossierPackageManifest/);
  assert.match(server, /buildPgdDossierPackageSnapshot/);
  assert.match(server, /const manifest = error\?\.manifest/);
  assert.match(server, /assetId: entry\.assetId/);
  assert.match(server, /packageManifestHash/);
  assert.match(server, /ROW_NUMBER\(\) OVER/);
  assert.match(server, /resolvePgdTemplateSourcePath/);
});

const routeIntake = {
  id: 'pgd-request-operations-1',
  requestCode: 'PGD-2026-OPS-001',
  intakeChannel: 'EMAIL' as const,
  requester: { name: 'Công ty A', address: 'Hà Nội', contactPerson: 'Nguyễn Văn A', phone: '0900000000' },
  customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' },
  productGroup: 'STEEL_METAL' as const,
  catalogItemId: 'STEEL_LOT_INSPECTION',
  productName: 'Thép tấm không gỉ',
  quantity: 10,
  unit: 'tấn',
  inspectionScope: 'Kiểm tra lô hàng và lấy mẫu thử nghiệm',
  inspectionLocation: 'Kho khách hàng',
  standards: ['QCVN 20:2019/BKHCN'],
  method: 'TT58',
  assessmentMethod: 'METHOD_7' as const,
  lotCode: 'LOT-001',
  productDetails: {
    productForm: 'Thép tấm',
    grade: '304',
    dimensions: '2 x 1000 x 2000 mm',
    productStandard: 'JIS G4305',
    origin: 'Việt Nam',
    countryOfOrigin: 'Việt Nam',
    manufacturer: 'Nhà máy A',
    manufacturerLotCode: 'MFG-LOT-001',
    importer: 'Công ty A',
    hsCode: '7219.32.00',
    lotDefinition: 'SHIPMENT_LOT' as const,
    customsDocuments: [{ document: 'Tờ khai hải quan', number: 'HQ-001' }],
  },
};
test('custom PGD checklist confirmation verifies the current file provenance before satisfying the gate', () => {
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  const confirmRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/confirm/route.ts');
  assert.match(api, /confirmPgdDossierDocument/);
  assert.match(store, /confirmDossierDocument/);
  assert.match(confirmRoute, /requirePgdCollectionMutation/);
  assert.match(confirmRoute, /assertPgdRequestStationMutationAllowed/);
  assert.match(confirmRoute, /requirement\.customDefinition/);
  assert.match(confirmRoute, /ORDER BY COALESCE\(\(data->>'version'\)::int, 0\) DESC/);
  assert.match(confirmRoute, /source_collection/);
  assert.match(confirmRoute, /source_document_id/);
  assert.match(confirmRoute, /source_json_path/);
  assert.match(confirmRoute, /sha256/);
  assert.match(confirmRoute, /'CONFIRMED'/);
  assert.match(confirmRoute, /requirement\.stageLabel/);
});

test('custom PGD upload and generated attachment preserve stage context in the audit log', () => {
  const uploadRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/route.ts');
  const attachRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/attach-generated/route.ts');
  const confirmRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/confirm/route.ts');
  for (const route of [uploadRoute, attachRoute, confirmRoute]) {
    assert.match(route, /workflowSnapshot\?\.stages/);
    assert.match(route, /getPgdDossierRequirementStationKeyForSnapshot/);
  }
  for (const route of [uploadRoute, attachRoute]) {
    assert.match(route, /requirement\.stageLabel/);
    assert.match(route, /writePgdActivity/);
  }
});

test('final PGD lab review persists conditional checklist applicability in the request snapshot', () => {
  const reviewRoute = read('app/api/pgd/lab-result-reviews/route.ts');
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  assert.match(reviewRoute, /applyPgdDossierConditionalRequirements/);
  assert.match(reviewRoute, /dossierChecklist/);
  assert.match(reviewRoute, /getDocumentPayload\(nextRequest\)/);
  assert.match(api, /request: payload\.request as PgdInspectionRequest/);
  assert.match(store, /if \(result\.request\) mergeRequest/);
});
