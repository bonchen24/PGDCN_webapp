import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPgdNotificationDraft } from '../utils/pgdcnNotification.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('PGD notification builder applies audience defaults for major events', () => {
  assert.equal(buildPgdNotificationDraft({
    entityType: 'PGD_REQUEST',
    action: 'CREATED',
    entityId: 'r-1',
    entityLabel: 'PGD-001',
    actorName: 'A',
  }).targetRole, 'staff');
  assert.equal(buildPgdNotificationDraft({
    entityType: 'PGD_APPROVAL',
    action: 'STATUS_CHANGED',
    entityId: 'a-1',
    entityLabel: 'PGD-001',
    actorName: 'A',
  }).targetRole, 'admin');
});

test('PGD activity writer persists one idempotent notification in the same path', () => {
  const activityStart = serverSource.indexOf('async function writePgdActivity');
  const activityEnd = serverSource.indexOf('/**', activityStart + 1);
  const writer = serverSource.slice(activityStart, activityEnd > activityStart ? activityEnd : activityStart + 8000);
  assert.match(writer, /input\.notify/);
  assert.match(writer, /pgd-notif-/);
  assert.match(writer, /'domain'\s*:\s*'PGD'|domain:\s*'PGD'/);
  assert.match(writer, /collection_name, document_id, data, updated_at/);
  assert.match(writer, /ON CONFLICT \(collection_name, document_id\) DO NOTHING/);
});

test('major PGD mutation routes pass explicit notification drafts', () => {
  for (const route of [
    '/api/pgd/requests',
    '/api/pgd/requests/:requestId/transition',
    '/api/pgd/assignments',
    '/api/pgd/field-inspections',
    '/api/pgd/samples/split',
    '/api/pgd/lab-requests',
    '/api/pgd/lab-results',
    '/api/pgd/reports',
    '/api/pgd/certificates',
    '/api/pgd/approvals',
  ]) {
    const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const routeMatch = new RegExp(`app\\.(?:get|post|put|patch|delete)\\((['"])${escapedRoute}\\1`).exec(serverSource);
    const routeStart = routeMatch?.index ?? -1;
    assert.ok(routeStart >= 0, `Missing route ${route}`);
    const routeEnd = serverSource.indexOf('app.', routeStart + route.length);
    const routeSource = serverSource.slice(routeStart, routeEnd > routeStart ? routeEnd : routeStart + 5000);
    assert.match(routeSource, /notify:/, `Missing notification draft for ${route}`);
  }
});

test('PGD notification event code keeps imports/restores and template-only work silent', () => {
  assert.match(serverSource, /IMPORT.*RESTORE|RESTORE.*IMPORT/);
  const templateStart = serverSource.indexOf('app.put("/api/pgd/document-templates/:templateId"');
  const requestStart = serverSource.indexOf('app.post("/api/pgd/requests"');
  const templateSource = serverSource.slice(templateStart, requestStart > templateStart ? requestStart : templateStart + 5000);
  assert.doesNotMatch(templateSource, /notify:/);
});
