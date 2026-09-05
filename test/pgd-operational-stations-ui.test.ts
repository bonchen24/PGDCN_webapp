import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('each operational station stays inside the dossier workspace contract', () => {
  const workspace = read('components/PgdOperationalStationWorkspace.tsx');
  for (const marker of ['Bộ chọn hồ sơ PGD', 'PgdInspectionRequest', 'PGD_OPERATIONAL_STATIONS', 'Mở hồ sơ đầy đủ']) {
    assert.match(workspace, new RegExp(marker));
  }
  const pgdWorkspace = read('components/PgdWorkspace.tsx');
  assert.match(pgdWorkspace, /data-testid="pgd-dossier-focus-shell"/);
  assert.match(pgdWorkspace, /const operationProjection/);
  for (const station of ['preparation', 'field', 'labs', 'results']) assert.doesNotMatch(pgdWorkspace, new RegExp(`activeSection === '${station}'`));
});

test('PGD selector keeps one-dossier-per-PYC fields visible', () => {
  const selector = read('components/PgdDossierSelector.tsx');
  for (const marker of ['requestCode', 'customerSnapshot', 'productName', 'lotCode', 'inspectionLocation', 'method', 'onSelect']) {
    assert.match(selector, new RegExp(marker));
  }
});
