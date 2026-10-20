import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));

test('active product has no legacy Vite/DDT entrypoint', () => {
  for (const relativePath of ['App.tsx', 'index.tsx', 'index.html', 'vite.config.ts', 'store.ts', 'scripts/native-dev.cjs']) {
    assert.equal(exists(relativePath), false, `legacy runtime file must be removed: ${relativePath}`);
  }
});

test('PCN and PGD template boundaries are session-protected App Router handlers', () => {
  const pcnPath = 'app/api/pcn/workflow-templates/route.ts';
  const pgdPath = 'app/api/pgd/document-templates/route.ts';
  assert.equal(exists(pcnPath), true, `PCN route handler must exist: ${pcnPath}`);
  assert.equal(exists(pgdPath), true, `PGD route handler must exist: ${pgdPath}`);

  const pcnRoute = read(pcnPath);
  assert.match(pcnRoute, /export async function GET\(req: NextRequest\)/);
  assert.match(pcnRoute, /const actor = getPcnSessionUser\(req\)/);
  assert.match(pcnRoute, /if \(!actor\)\s*\{\s*return jsonUnauthorized/);
  assert.match(pcnRoute, /if \(!isPcnWorkflowManager\(actor\)\)\s*\{\s*return jsonForbidden/);

  const pgdRoute = read(pgdPath);
  assert.match(pgdRoute, /export async function GET\(req: NextRequest\)/);
  assert.match(pgdRoute, /const sessionError = requirePgdSession\(req\)/);
  assert.match(pgdRoute, /if \(sessionError\) return sessionError/);
});

test('PCN keeps the external DDT laboratory integration contract', () => {
  const integration = read('utils/pcnLabIntegration.ts');
  const compose = read('docker-compose.pcn.yml');
  assert.match(integration, /DDT/);
  assert.match(compose, /PCN_LAB_DDT_SECRET/);
  assert.match(compose, /PCN_LAB_INTEGRATIONS_JSON/);
});
