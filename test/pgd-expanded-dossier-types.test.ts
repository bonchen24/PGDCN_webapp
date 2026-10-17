import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_PGD_CATALOG,
  getPgdActiveCatalog,
  getPgdCatalogItemLabel,
} from '../utils/pgdDomain.ts';

test('PGD catalog resolves Vietnamese labels for every source-aligned dossier type', () => {
  const activeCodes = getPgdActiveCatalog(DEFAULT_PGD_CATALOG).map((item) => item.code);
  for (const code of ['GĐ-THEP-KG', 'GĐ-THEP-TT58', 'GĐ-MAY-01', 'GĐ-NGOAI-CT', 'GĐ-THAN-01', 'GĐ-HH-01']) {
    assert.ok(activeCodes.includes(code), `Thiếu loại hồ sơ PGD ${code}`);
    assert.match(getPgdCatalogItemLabel(code), new RegExp(`^${code} · .+`));
  }
});

test('PGD catalog label keeps legacy ids visible when no current catalog row matches', () => {
  assert.equal(getPgdCatalogItemLabel('LEGACY-PGD-TYPE', []), 'LEGACY-PGD-TYPE');
  assert.equal(getPgdCatalogItemLabel('', []), 'Chưa chọn loại hồ sơ');
});

test('PGD queue projects resolved type labels while detail and register retain type filters', () => {
  const root = process.cwd();
  const workspace = fs.readFileSync(`${root}/components/PgdWorkspace.tsx`, 'utf8');
  const queue = fs.readFileSync(`${root}/components/PgdDossierQueueView.tsx`, 'utf8');
  const selector = fs.readFileSync(`${root}/components/PgdDossierSelector.tsx`, 'utf8');
  const register = fs.readFileSync(`${root}/components/PgdSummaryRegisterView.tsx`, 'utf8');

  assert.match(workspace, /Lọc loại hồ sơ PGD/);
  assert.match(workspace, /catalogItemId/);
  assert.match(queue, /catalogLabel/);
  assert.match(queue, /fieldOrCatalogBadge: row\.catalogLabel/);
  assert.match(queue, /row\.catalogLabel\.includes\('Thép'\)/);
  assert.match(queue, /row\.catalogLabel\.includes\('Máy'\)/);
  assert.match(queue, /row\.catalogLabel\.includes\('Than'\)/);
  assert.match(selector, /Lọc loại hồ sơ PGD/);
  assert.match(selector, /getPgdCatalogItemLabel/);
  assert.match(register, /Lọc loại hồ sơ Sổ tổng hợp PGD/);
  assert.match(register, /getPgdCatalogItemLabel/);
});
