import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { updatePcnDossier } from '../utils/pcnDossierApi.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PCN dossier metadata mutations use a dedicated atomic boundary', () => {
  const dossierUpdate = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/dossiers/:dossierId'") ,
    serverSource.indexOf("app.post('/api/pcn/results'") ,
  );
  assert.match(dossierUpdate, /requirePcnMutation/);
  assert.match(dossierUpdate, /withPgTransaction/);
  assert.match(dossierUpdate, /certificationDossiers[\s\S]*FOR UPDATE/);
  assert.match(dossierUpdate, /isPcnDossierTransitionAllowed/);
  assert.match(dossierUpdate, /evaluatorUsername/);
  assert.match(dossierUpdate, /reviewerUsername/);
  assert.match(dossierUpdate, /ownerUsername/);
  assert.match(dossierUpdate, /exceptionReason/);
  assert.match(dossierUpdate, /getPcnDossierExceptionReasonDenial/);
  assert.match(dossierUpdate, /targetDate/);
  assert.match(dossierUpdate, /evaluationAt/);
  assert.match(dossierUpdate, /effectiveAt/);
  assert.match(dossierUpdate, /rawUpdates\.method/);
  assert.match(dossierUpdate, /METHOD_1.*METHOD_5.*METHOD_7/);
  assert.match(dossierUpdate, /getPcnDossierAssignmentDenial/);
  assert.match(dossierUpdate, /getPcnOwnerAssignmentAuthorityDenial/);
  assert.match(dossierUpdate, /actorDepartmentRoleCode/);
  assert.match(dossierUpdate, /hasAssignmentChange/);
  assert.match(dossierUpdate, /action: hasAssignmentChange \? 'ASSIGNED'/);
  assert.match(dossierUpdate, /getPcnDossierStatusMutationDenial/);
  assert.match(dossierUpdate, /DELIVERED/);
  assert.match(dossierUpdate, /ARCHIVED/);
  assert.match(dossierUpdate, /collection_name = 'systemUsers'/);
  assert.match(dossierUpdate, /dossierFieldCodes/);
  assert.match(dossierUpdate, /getPcnDossierDateDenial/);
  assert.match(dossierUpdate, /targetDate.*evaluationAt.*effectiveAt/);
  assert.match(dossierUpdate, /updatedAt/);
  assert.match(dossierUpdate, /activityLogs/);
  assert.match(dossierUpdate, /idempotent/);

  const updateStart = storeSource.indexOf('updateDossier: async');
  const updateEnd = storeSource.indexOf('reviewHistoricalDossier:', updateStart);
  const storeUpdate = storeSource.slice(updateStart, updateEnd);
  assert.match(storeUpdate, /updatePcnDossier/);
  assert.doesNotMatch(storeUpdate, /saveDoc\('certificationDossiers'/);
  assert.doesNotMatch(storeUpdate, /writePcnActivity/);
  assert.match(designSource, /POST \/api\/pcn\/dossiers\/:dossierId/);
  assert.match(designSource, /whitelist/);
  assert.match(designSource, /control giới hạn ở `METHOD_1`, `METHOD_5` hoặc `METHOD_7`/);
  assert.match(designSource, /exceptionReason/);
});

test('PCN dossier API client sends a controlled update and retry key', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Response.json({ dossier: { id: 'dossier-1' }, activityLog: null, idempotent: false });
  }) as typeof fetch;

  try {
    await updatePcnDossier('dossier-1', { status: 'ASSIGNED', method: 'METHOD_5', ownerUsername: 'owner-qc4', evaluatorUsername: 'reviewer', reviewerUsername: 'technical-reviewer', targetDate: null }, 'dossier-update-1');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/pcn/dossiers/dossier-1');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    updates: { status: 'ASSIGNED', method: 'METHOD_5', ownerUsername: 'owner-qc4', evaluatorUsername: 'reviewer', reviewerUsername: 'technical-reviewer', targetDate: null },
    idempotencyKey: 'dossier-update-1',
  });
});

// --- End of pcn-dossier-api-contract.test.ts ---
