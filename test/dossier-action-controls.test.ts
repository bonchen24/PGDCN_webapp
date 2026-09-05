import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { isPgdDossierActionViewer } from '../utils/pgdDomain.ts';

const pcnDetailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const pgdDetailSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');

test('PCN dossier detail exposes manager edit and delete actions in the header action group', () => {
  assert.match(pcnDetailSource, /const dossierEditAction = isSystemManager \?/);
  assert.match(pcnDetailSource, /Chỉnh sửa hồ sơ/);
  assert.match(pcnDetailSource, /aria-label="Thao tác hồ sơ PCN"/);
  assert.match(pcnDetailSource, /dossierEditAction/);
  assert.match(pcnDetailSource, /dossierDeleteAction/);
});

test('PGD dossier detail keeps the manager action group visible with status-denied controls', () => {
  assert.match(pgdDetailSource, /aria-label="Thao tác hồ sơ PGD"/);
  assert.match(pgdDetailSource, /Sửa thông tin hồ sơ PGD/);
  assert.match(pgdDetailSource, /Xóa hồ sơ/);
  assert.match(pgdDetailSource, /deletionDenial/);
});

test('PGD operational managers can see dossier actions without gaining hard-delete authority', () => {
  assert.equal(isPgdDossierActionViewer({ pgdRole: 'PGD_MANAGER' }), true);
  assert.equal(isPgdDossierActionViewer({ pgdRole: 'PGD_ADMIN' }), true);
  assert.equal(isPgdDossierActionViewer({ pgdRole: 'PGD_VIEWER' }), false);
});

// --- End of dossier-action-controls.test.ts ---
