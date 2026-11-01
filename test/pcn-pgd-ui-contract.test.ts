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
  assert.doesNotMatch(workspace, /PCN_CERTIFICATION_FIELD_CODES|usePcnStore/);
  assert.match(workspace, /PGD_GROUP_LABELS|pgd-selected-group-code/);
  assert.match(workspace, /PgdDossierFlow/);
  assert.match(workspace, /PgdDossierStepWorkPanel/);
  assert.doesNotMatch(workspace, /PgdWorkflowMap|PcnArchifyWorkflowEmbed/);
  assert.match(workspace, /getPgdOperationalStepAccess/);
  assert.match(workspace, /validatePgdResultValues/);
  assert.match(workspace, /buildPgdFieldInspection/);
  assert.match(workspace, /nonconformities/);
  assert.match(workspace, /id: assignment\?\.id \|\| makeId\('pgd-assignment'\)/);
});

test('PGD and PCN navigation are visible as distinct department workspaces', () => {
  const pcnRoute = read('app/pgdcn/pcn/page.tsx');
  const pgdRoute = read('app/pgdcn/pgd/page.tsx');
  const navigation = read('utils/pgdcnNavigation.ts');
  assert.match(pcnRoute, /PgdcnAppShell initialDomain="PCN" initialPcnSection/);
  assert.match(pgdRoute, /PgdcnAppShell initialDomain="PGD" initialPgdSection/);
  assert.match(navigation, /PCN_NAVIGATION_ITEMS:[\s\S]*?domain: 'PCN'/);
  assert.match(navigation, /PGD_NAVIGATION_ITEMS:[\s\S]*?domain: 'PGD'/);
  assert.match(read('components/PcnSidebar.tsx'), /PHÒNG GIÁM ĐỊNH, CHỨNG NHẬN, PHÁT TRIỂN THỊ TRƯỜNG/);
  assert.match(read('components/PgdSidebar.tsx'), /PHÒNG GIÁM ĐỊNH/);
});

test('PGD keeps the shared reader read-only while preserving native evidence and document regions', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(workspace, /<PgdDossierFlow status=\{request\.status\} evidence=\{context\}/);
  assert.match(workspace, /<PgdDossierStepWorkPanel/);
  assert.doesNotMatch(workspace, /onStartTask|onCompleteTask|onReturnTask/);
  assert.match(workspace, /PgdCaseEvidencePanel/);
  assert.match(workspace, /PgdSourceFormsPanel/);
});

test('PCN user administration exposes the shared PCN/PGD scope and PGD role', () => {
  const source = read('components/PcnUserManagementView.tsx');
  assert.match(source, /departmentScopes/);
  assert.match(source, /pgdRole/);
  assert.match(source, /PGD_ADMIN|PGD_MANAGER/);
});

test('PCN and PGD dossier details use native workflows without Archify server routes', () => {
  const pcnDetail = read('components/PcnDossierWorkflowPanel.tsx');
  const pgdDetail = read('components/PgdWorkspace.tsx');
  const server = read('server.legacy.ts');
  assert.match(pcnDetail, /import PcnDossierFlow.*from ['"]\.\/PcnDossierFlow['"]/);
  assert.match(pcnDetail, /<PcnDossierFlow\b/);
  assert.match(pgdDetail, /import PgdDossierFlow.*from ['"]\.\/PgdDossierFlow['"]/);
  assert.match(pgdDetail, /import PgdDossierStepWorkPanel from ['"]\.\/PgdDossierStepWorkPanel['"]/);
  assert.match(pgdDetail, /<PgdDossierFlow\b/);
  assert.match(pgdDetail, /<PgdDossierStepWorkPanel\b/);
  assert.doesNotMatch(pcnDetail, /PcnArchifyWorkflowEmbed|PgdWorkflowMap/);
  assert.doesNotMatch(pgdDetail, /PcnArchifyWorkflowEmbed|PgdWorkflowMap/);
  assert.doesNotMatch(server, /archify/i);
});
