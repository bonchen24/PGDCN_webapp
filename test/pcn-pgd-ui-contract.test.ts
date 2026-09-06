import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGDCN routes expose separate PCN and PGD workspaces', () => {
  const routeFiles = [
    'app/pgdcn/page.tsx',
    'app/pgdcn/pcn/page.tsx',
    'app/pgdcn/pgd/page.tsx',
  ];
  for (const file of routeFiles) assert.equal(fs.existsSync(path.join(root, file)), true, file);
  assert.match(read('app/pgdcn/pcn/page.tsx'), /PcnAppShell/);
  assert.match(read('app/pgdcn/pgd/page.tsx'), /PgdAppShell/);
});

test('PGD workspace has its own shell/sidebar and does not import PCN catalog state', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(read('components/PgdAppShell.tsx'), /PgdWorkspace/);
  assert.match(read('components/PgdSidebar.tsx'), /PGD/);
  assert.match(workspace, /usePgdStore/);
  assert.match(read('store-pgd.ts'), /fetchPgdBootstrap|\/api\/pgd/);
  assert.doesNotMatch(workspace, /PCN_CERTIFICATION_FIELD_CODES|QC20|usePcnStore/);
  assert.match(workspace, /PgdWorkflowMap/);
  assert.match(read('components/PgdWorkflowMap.tsx'), /PcnArchifyWorkflowEmbed/);
  assert.match(workspace, /getPgdOperationalStepAccess/);
  assert.match(workspace, /validatePgdResultValues/);
  assert.match(workspace, /buildPgdFieldInspection/);
  assert.match(workspace, /nonconformities/);
  assert.match(workspace, /id: assignment\?\.id \|\| makeId\('pgd-assignment'\)/);
});

test('PGD and PCN navigation are visible as distinct department workspaces', () => {
  const landing = read('app/pgdcn/page.tsx');
  assert.match(landing, /pgdcn\/pcn/);
  assert.match(landing, /pgdcn\/pgd/);
  assert.match(read('components/PcnSidebar.tsx'), /PHÒNG GIÁM ĐỊNH - CHỨNG NHẬN/);
  assert.match(read('components/PgdSidebar.tsx'), /PHÒNG GIÁM ĐỊNH/);
});

test('PCN user administration exposes the shared PCN/PGD scope and PGD role', () => {
  const source = read('components/PcnUserManagementView.tsx');
  assert.match(source, /departmentScopes/);
  assert.match(source, /pgdRole/);
  assert.match(source, /PGD_ADMIN|PGD_MANAGER/);
});
