import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const getRoute = readFileSync(new URL('../app/api/pgd/workflow-templates/route.ts', import.meta.url), 'utf8');
const mutationRoutes = [
  '../app/api/pgd/workflow-templates/route.ts',
  '../app/api/pgd/workflow-templates/[templateId]/route.ts',
  '../app/api/pgd/workflow-templates/[templateId]/publish/route.ts',
  '../app/api/pgd/workflow-templates/[templateId]/retire/route.ts',
  '../app/api/pgd/workflow-templates/[templateId]/revisions/route.ts',
].map((path) => ({ path, source: readFileSync(new URL(path, import.meta.url), 'utf8') }));

test('PGD workflow-template GET checks session and access before its scoped cache', () => {
  const sessionIndex = getRoute.indexOf('getPcnSessionUser(req)');
  const accessCheckIndex = getRoute.indexOf('if (!isPgdWorkflowManager(actor) && !canProposePgdWorkflow(actor))');
  const cacheIndex = getRoute.indexOf('readThroughRedisCache({');

  assert.ok(sessionIndex >= 0 && accessCheckIndex > sessionIndex && cacheIndex > accessCheckIndex);
  assert.match(getRoute, /app:\s*'pgd'/);
  assert.match(getRoute, /resource:\s*'workflow-templates'/);
  assert.match(getRoute, /username:\s*actor\.username/);
  for (const field of ['systemRole', 'managementRoleCode', 'professionalRoleCodes', 'departmentScopes', 'pgdRole', 'manager', 'canPropose']) {
    assert.match(getRoute, new RegExp(`${field}:`), `PGD cache scope must include ${field}`);
  }
  assert.doesNotMatch(getRoute, /scope\s*:\s*\{[^}]*sessionToken|scope\s*:\s*\{[^}]*cookie/i);
  assert.match(getRoute, /PGD_COLLECTIONS\.workflowTemplates/);
  assert.match(getRoute, /data->>'domain' = 'pgd'/);
  assert.match(getRoute, /return jsonOk\(\{\s*items(?::|\s*\})/);
});

test('every successful PGD workflow-template mutation invalidates after its database transaction', () => {
  for (const { path, source } of mutationRoutes) {
    const transactionIndex = source.indexOf('await withPgTransaction');
    const invalidateIndex = source.indexOf("await invalidateRedisCache('pgd', 'workflow-templates')");
    const responseIndex = Math.max(source.indexOf('return jsonCreated(result);'), source.indexOf('return jsonOk(result);'));

    assert.ok(transactionIndex >= 0, `${path} must keep its database transaction`);
    assert.ok(invalidateIndex > transactionIndex, `${path} must invalidate after persistence`);
    assert.ok(responseIndex > invalidateIndex, `${path} must return after best-effort invalidation`);
  }
});
