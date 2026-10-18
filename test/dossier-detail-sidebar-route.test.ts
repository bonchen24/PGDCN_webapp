import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('PGD dossier detail has a dedicated route under the shared shell', () => {
  const page = read('app/pgdcn/pgd/dossiers/[requestId]/page.tsx');
  assert.match(page, /PgdcnAppShell/);
  assert.match(page, /initialDomain="PGD"/);
  assert.match(page, /initialPgdRequestId/);
  assert.match(page, /await params/);
  assert.match(page, /initialPgdRequestId=\{decodeURIComponent\(requestId\)\}/);
});

test('shared shell carries PGD detail context and keeps the domain sidebar visible', () => {
  const shell = read('components/PgdcnAppShell.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(shell, /initialPgdRequestId\?: string/);
  assert.match(shell, /initialPgdRequestId/);
  assert.match(shell, /PgdWorkspace embedded[^\n]*initialRequestId/);
  assert.match(shell, /<PgdcnSidebar/);
  assert.match(shell, /router\.push\(`\/pgdcn\/pgd\/dossiers/);
  assert.match(workspace, /standaloneRequest = embedded && Boolean\(initialRequestId\)/);
  assert.match(workspace, /standalone=\{standaloneRequest\}/);
  assert.match(workspace, /!standaloneRequest && requestDetail/);
  assert.match(workspace, /router\.push\(`\/pgdcn\/pgd\/dossiers/);
  assert.match(workspace, /if \(embedded\) setSelectedRequestId\(undefined\)/);
});

test('closing a PGD detail route returns to the PGD register', () => {
  const shell = read('components/PgdcnAppShell.tsx');
  assert.match(shell, /initialPgdRequestId/);
  assert.match(shell, /router\.replace\('\/pgdcn\/pgd'\)/);
});
