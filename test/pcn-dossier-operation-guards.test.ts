import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const serverSource = fs.readFileSync(path.resolve('server.ts'), 'utf8');

test('dossier mutations use the shared operator guard', () => {
  const guardCalls = serverSource.match(/assertPcnDossierOperator\(dossier, actor\)/g) ?? [];

  assert.ok(
    guardCalls.length >= 10,
    `expected the shared guard at all dossier mutation boundaries, found ${guardCalls.length}`,
  );
});

test('dossier mutations do not use an owner-present-only authorization bypass', () => {
  assert.doesNotMatch(
    serverSource,
    /if\s*\(\s*dossier\.ownerUsername\s*&&\s*dossier\.ownerUsername\.trim\(\)\.toLowerCase\(\)\s*!==\s*actor\.username\.trim\(\)\.toLowerCase\(\)/,
  );
});

test('proposal mutation is protected by the dossier operator policy', () => {
  const proposalRouteStart = serverSource.indexOf("app.post('/api/pcn/proposals/");
  assert.notEqual(proposalRouteStart, -1, 'proposal route should exist');

  const proposalRoute = serverSource.slice(proposalRouteStart, proposalRouteStart + 12000);
  assert.match(proposalRoute, /assertPcnDossierOperator\(dossier, actor\)/);
});
