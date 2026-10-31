import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { filterPgdcnDossierLibrary, type PgdcnDossierLibraryEntry } from '../utils/pgdcnDossierLibrary.ts';
import PgdcnDossierLibraryView from '../components/PgdcnDossierLibraryView.tsx';
import type { CertificationDossier, PcnUserAccount } from '../types.ts';

const entries: PgdcnDossierLibraryEntry[] = [
  { domain: 'PCN', id: 'pcn-1', code: 'PCN-001', customerName: 'Công ty Ánh Dương', status: 'WAITING_APPROVAL', ownerUsername: 'linh', updatedAt: '2026-10-30' },
  { domain: 'PGD', id: 'pgd-1', code: 'PGD-001', customerName: 'Công ty Bình Minh', status: 'RESULTS_REVIEW', ownerUsername: 'an', updatedAt: '2026-10-31' },
  { domain: 'PGD', id: 'pgd-2', code: 'PGD-002', customerName: 'Công ty Ánh Dương', status: 'PREPARING', ownerUsername: 'linh', updatedAt: '2026-10-29' },
];

test('dossier library filters canonical rows by domain, owner and review state', () => {
  assert.deepEqual(filterPgdcnDossierLibrary(entries, { view: 'PCN', username: 'linh' }).map((entry) => entry.id), ['pcn-1']);
  assert.deepEqual(filterPgdcnDossierLibrary(entries, { view: 'MINE', username: 'linh' }).map((entry) => entry.id), ['pcn-1', 'pgd-2']);
  assert.deepEqual(filterPgdcnDossierLibrary(entries, { view: 'REVIEW', username: 'linh' }).map((entry) => entry.id), ['pgd-1', 'pcn-1']);
  assert.deepEqual(filterPgdcnDossierLibrary(entries, { view: 'ALL', username: 'linh', query: 'ánh dương' }).map((entry) => entry.id), ['pcn-1', 'pgd-2']);
  assert.deepEqual(filterPgdcnDossierLibrary(entries, { view: 'MINE', username: '' }), []);
});

test('shared library renders canonical PCN rows in desktop and mobile layouts', () => {
  const dossier = {
    id: 'pcn-1', dossierCode: 'PCN-001', proposalId: 'proposal-1', customerSnapshot: { name: 'Công ty Ánh Dương' },
    fieldCodes: ['QC4'], method: 'METHOD_7', status: 'WAITING_APPROVAL', labRequestIds: [], returnedResultIds: [],
    ownerUsername: 'linh', updatedAt: '2026-10-30T00:00:00.000Z',
  } as unknown as CertificationDossier;
  const currentUser = {
    username: 'linh', name: 'Linh', role: 'staff', systemRole: 'staff', departmentRoleCode: 'STAFF', fieldCodes: ['QC4'], active: true,
  } as unknown as PcnUserAccount;
  const markup = renderToStaticMarkup(createElement(PgdcnDossierLibraryView, {
    scopes: ['PCN'], currentUser, pcnDossiers: [dossier], pcnProposals: [{ id: 'proposal-1', productName: 'Động cơ mẫu' }], pgdRequests: [],
    onOpenPcn: () => undefined, onOpenPgd: () => undefined,
  }));
  assert.match(markup, /data-testid="pgdcn-dossier-library"/);
  assert.match(markup, /Chọn góc nhìn hồ sơ/);
  assert.match(markup, /PCN-001/);
  assert.match(markup, /Công ty Ánh Dương/);
  assert.match(markup, /Động cơ mẫu/);
  assert.match(markup, /hidden overflow-x-auto md:block/);
  assert.match(markup, /md:hidden/);

  const shell = readFileSync(new URL('../components/PgdcnAppShell.tsx', import.meta.url), 'utf8');
  assert.match(shell, /router\.push\(`\/pgdcn\/pcn\/dossiers\//);
  assert.match(shell, /router\.push\(`\/pgdcn\/pgd\/dossiers\//);
});
