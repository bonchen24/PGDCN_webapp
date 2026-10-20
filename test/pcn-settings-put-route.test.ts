import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { pool } from '../lib/server/db.ts';
import { getSessionSecret } from '../lib/server/auth.ts';
import { createPcnSessionToken } from '../utils/pcnAuth.ts';

process.env.DATABASE_PROFILE = 'pcn';
process.env.PCN_SESSION_SECRET = 'pcn-settings-route-test-secret';

const route = await import('../app/api/pcn/settings/route.ts') as unknown as {
  GET: (request: NextRequest) => Promise<Response>;
  PUT: (request: NextRequest) => Promise<Response>;
};

type TestDocument = { document_id: string; data: Record<string, any> };

function createDatabase() {
  const durable = new Map<string, TestDocument>();
  const statements: string[] = [];
  let transaction: Map<string, TestDocument> | null = null;
  const current = () => transaction || durable;
  const key = (collection: string, id: string) => `${collection}:${id}`;

  const query = async (sql: string, params: any[] = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    statements.push(normalized);

    if (/^BEGIN$/i.test(normalized)) {
      transaction = new Map(durable);
      return { rows: [] };
    }
    if (/^COMMIT$/i.test(normalized)) {
      if (transaction) {
        durable.clear();
        for (const [documentKey, document] of transaction) durable.set(documentKey, document);
      }
      transaction = null;
      return { rows: [] };
    }
    if (/^ROLLBACK$/i.test(normalized)) {
      transaction = null;
      return { rows: [] };
    }
    if (/^SELECT document_id, data FROM app_documents/i.test(normalized)) {
      const collection = normalized.match(/collection_name = '([^']+)'/i)?.[1];
      const id = String(params[0] ?? '');
      const document = collection ? current().get(key(collection, id)) : undefined;
      return { rows: document ? [{ ...document }] : [] };
    }
    if (/^INSERT INTO app_documents/i.test(normalized)) {
      const collection = normalized.match(/VALUES \('([^']+)', \$1/i)?.[1];
      assert.ok(collection, `Unexpected app_documents insert: ${normalized}`);
      const documentId = String(params[0]);
      const data = JSON.parse(String(params[1]));
      const document = { document_id: documentId, data };
      const documentKey = key(collection, documentId);
      if (normalized.includes('DO NOTHING')) {
        if (!current().has(documentKey)) current().set(documentKey, document);
      } else {
        current().set(documentKey, document);
      }
      return { rows: [] };
    }

    throw new Error(`Unexpected SQL in PCN settings route test: ${normalized}`);
  };

  return {
    durable,
    statements,
    client: { query, release() {} },
    query,
  };
}

function installDatabase(t: TestContext) {
  const database = createDatabase();
  t.mock.method(pool as any, 'connect', async () => database.client as any);
  t.mock.method(pool as any, 'query', async (sql: string, params?: any[]) => database.query(sql, params));
  return database;
}

function request(user?: { username: string; name: string; role: string; systemRole: string }, settings?: unknown) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (user) {
    const token = createPcnSessionToken({ ...user, active: true } as any, getSessionSecret());
    headers.set('cookie', `pcn_certification_session=${token}`);
  }

  return new NextRequest('http://localhost/api/pcn/settings', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ settings }),
  });
}

const admin = { username: 'pcn-admin', name: 'PCN Admin', role: 'admin', systemRole: 'admin' };

test('PCN settings PUT requires an authenticated system admin before opening a transaction', async (t) => {
  const database = installDatabase(t);

  const unauthenticated = await route.PUT(request());
  assert.equal(unauthenticated.status, 401);

  const staff = await route.PUT(request({ username: 'staff', name: 'Staff', role: 'staff', systemRole: 'staff' }, {}));
  assert.equal(staff.status, 403);
  assert.deepEqual(database.statements, []);
});

test('PCN settings PUT persists normalized settings and audit atomically for an admin', async (t) => {
  const database = installDatabase(t);
  const response = await route.PUT(request(admin, {
    fieldCodes: ['qc4', 'QC20'],
    labRoutes: { QC4: ['emc', 'UNKNOWN'] },
    checklist: { requireFilesBeforeAdvance: false },
    coding: { proposalPrefix: ' DN-2026 ' },
    ocr: { enabled: false, confidenceThreshold: 2 },
    storage: { bucket: 'pcn-private', privateOnly: false },
  }));

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.settings.id, 'pcn-settings');
  assert.deepEqual(payload.settings.fieldCodes, ['QC4']);
  assert.deepEqual(payload.settings.labRoutes.QC4, ['EMC']);
  assert.equal(payload.settings.checklist.requireFilesBeforeAdvance, false);
  assert.equal(payload.settings.coding.proposalPrefix, 'DN-2026');
  assert.equal(payload.settings.ocr.confidenceThreshold, 1);
  assert.equal(payload.settings.storage.privateOnly, true);
  assert.equal(payload.settings.updatedBy, admin.username);

  const storedSettings = database.durable.get('systemConfig:pcn-settings');
  assert.ok(storedSettings, 'settings must be committed to systemConfig/pcn-settings');
  assert.equal('id' in storedSettings.data, false);
  assert.equal(storedSettings.data.updatedBy, admin.username);
  const auditEntries = [...database.durable.values()].filter((entry) => entry.document_id.startsWith('activity-pcn-settings-update-'));
  assert.equal(auditEntries.length, 1, 'the settings update must be audited in the same transaction');
  assert.equal(auditEntries[0].data.actorUsername, admin.username);
  assert.ok(database.statements.includes('BEGIN'));
  assert.ok(database.statements.includes('COMMIT'));
  assert.equal(database.statements.includes('ROLLBACK'), false);

  const readback = await route.GET(new NextRequest('http://localhost/api/pcn/settings', {
    headers: { cookie: request(admin, {}).headers.get('cookie') || '' },
  }));
  assert.equal(readback.status, 200);
  assert.deepEqual((await readback.json()).settings, payload.settings);
});
