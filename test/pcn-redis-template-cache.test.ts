import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const getRoute = readFileSync(new URL('../app/api/pcn/workflow-templates/route.ts', import.meta.url), 'utf8');
const mutationRoutes = [
  '../app/api/pcn/workflow-templates/route.ts',
  '../app/api/pcn/workflow-templates/[templateId]/route.ts',
  '../app/api/pcn/workflow-templates/[templateId]/publish/route.ts',
  '../app/api/pcn/workflow-templates/[templateId]/retire/route.ts',
  '../app/api/pcn/workflow-templates/[templateId]/revisions/route.ts',
].map((path) => ({ path, source: readFileSync(new URL(path, import.meta.url), 'utf8') }));

test('PCN workflow-template GET checks session and access before its scoped cache', () => {
  const sessionIndex = getRoute.indexOf('getPcnSessionUser(req)');
  const accessCheckIndex = getRoute.indexOf('if (!manager && !canViewPcn)');
  const cacheIndex = getRoute.indexOf('readThroughRedisCache({');

  assert.ok(sessionIndex >= 0 && accessCheckIndex > sessionIndex && cacheIndex > accessCheckIndex);
  assert.match(getRoute, /app:\s*'pcn'/);
  assert.match(getRoute, /resource:\s*'workflow-templates'/);
  assert.match(getRoute, /username:\s*actor\.username/);
  for (const field of ['systemRole', 'managementRoleCode', 'professionalRoleCodes', 'fieldCodes', 'departmentScopes', 'manager', 'canPropose', 'canViewPcn']) {
    assert.match(getRoute, new RegExp(`${field}:`), `PCN cache scope must include ${field}`);
  }
  assert.doesNotMatch(getRoute, /scope\s*:\s*\{[^}]*sessionToken|scope\s*:\s*\{[^}]*cookie/i);
  assert.match(getRoute, /SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnWorkflowTemplates'/);
  assert.match(getRoute, /jsonOk\(\{\s*items:/);
});

test('every successful PCN workflow-template mutation invalidates after its database transaction', () => {
  for (const { path, source } of mutationRoutes) {
    const transactionIndex = source.indexOf('await withPgTransaction');
    const invalidateIndex = source.indexOf("await invalidateRedisCache('pcn', 'workflow-templates')");
    const responseIndex = Math.max(source.indexOf('return jsonCreated(result);'), source.indexOf('return jsonOk(result);'));

    assert.ok(transactionIndex >= 0, `${path} must keep its database transaction`);
    assert.ok(invalidateIndex > transactionIndex, `${path} must invalidate after persistence`);
    assert.ok(responseIndex > invalidateIndex, `${path} must return after best-effort invalidation`);
  }
});
