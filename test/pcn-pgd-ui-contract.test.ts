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

test('PCN and PGD Archify routes preserve auth-before-query validation and all diagram types', () => {
  const server = read('server.ts');
  assert.match(server, /ARCHIFY_DIAGRAM_TYPES/);
  assert.match(server, /from ['"]\.\/utils\/archifyDiagram\.ts['"]/);

  for (const [route, guard, idCheck] of [
    ['/api/pcn/dossiers/:dossierId/archify', 'requirePcnSession', 'isSafePcnSampleKey'],
    ['/api/pgd/requests/:requestId/archify', 'requirePgdSession', 'requestId.length > 240'],
  ]) {
    const start = server.indexOf(`app.get('${route}'`);
    assert.ok(start >= 0, route);
    const body = server.slice(start, server.indexOf("\n  });", start) + 5);
    assert.ok(body.indexOf(guard) < body.indexOf('parseArchifyDiagramType'), `${route} parses only after auth`);
    assert.match(body, new RegExp(idCheck.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(body, /build(?:Pcn|Pgd)ArchifyDiagramSuite/);
    assert.match(body, /suite\[diagramType\]/);
    assert.match(body, /private, no-store/);
    assert.match(body, /status\(409\)\.json\(\{ error, diagram: diagramType, reason \}\)/);
  }
});
