import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  DEFAULT_PGD_CATALOG,
  PGD_V1_PRODUCT_GROUPS,
  formatPgdRequestCode,
  getPgdActiveCatalog,
  getPgdApprovalRoleForStatus,
  getPgdVietnamDateKey,
  isPgdV1ProductGroup,
} from '../utils/pgdDomain.ts';

test('PGD exposes every source-derived inspection profile', () => {
  assert.deepEqual(PGD_V1_PRODUCT_GROUPS, ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER']);
  assert.deepEqual(getPgdActiveCatalog(DEFAULT_PGD_CATALOG).map((item) => item.code), ['GĐ-THEP-KG', 'GĐ-THEP-TT58', 'GĐ-MAY-01', 'GĐ-THAN-01', 'GĐ-NGOAI-01', 'GĐ-HH-01', 'GĐ-SL-KL-01', 'GĐ-TTXX-01', 'GĐ-THEP-CB', 'GĐ-MAY-TN', 'GĐ-NGOAI-CT']);
  assert.deepEqual([...new Set(getPgdActiveCatalog(DEFAULT_PGD_CATALOG).map((item) => item.productGroup))], ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER']);
  assert.equal(DEFAULT_PGD_CATALOG.find((item) => item.code === 'GĐ-THEP-TT58')?.name, 'Giám định thép / kim loại theo TT58');
  assert.equal(DEFAULT_PGD_CATALOG.find((item) => item.code === 'GĐ-NGOAI-01')?.name, 'Giám định ngoài');
});

test('PGD dossier selector exposes every active product group', () => {
  const selector = fs.readFileSync(path.join(process.cwd(), 'components/PgdDossierSelector.tsx'), 'utf8');
  assert.match(selector, /STEEL_METAL:\s*'Thép \/ kim loại'/);
  assert.match(selector, /MACHINERY_LINE:\s*'Máy \/ dây chuyền'/);
  assert.match(selector, /COAL:\s*'Than'/);
  assert.match(selector, /OTHER:\s*'Hàng hóa khác'/);
});

test('PGD visible dossiers include every active product group and exclude unknown groups', () => {
  assert.equal(isPgdV1ProductGroup('STEEL_METAL'), true);
  assert.equal(isPgdV1ProductGroup('MACHINERY_LINE'), true);
  assert.equal(isPgdV1ProductGroup('COAL'), true);
  assert.equal(isPgdV1ProductGroup('OTHER'), true);
});

test('PGD request code uses YYMMDD plus a two-digit serial reset each Vietnam calendar day', () => {
  const septemberFifth = new Date('2026-09-04T17:00:00.000Z');
  const septemberSixth = new Date('2026-09-05T17:00:00.000Z');
  assert.equal(formatPgdRequestCode(1, septemberFifth), 'PGD-260905-01');
  assert.equal(formatPgdRequestCode(42, septemberSixth), 'PGD-260906-42');
  assert.equal(formatPgdRequestCode(99, septemberFifth), 'PGD-260905-99');
  assert.throws(() => formatPgdRequestCode(0, septemberFifth), /serial/i);
  assert.throws(() => formatPgdRequestCode(100, septemberFifth), /serial/i);
  assert.equal(getPgdVietnamDateKey(new Date('2026-09-04T16:59:59.000Z')), '260904');
  assert.equal(getPgdVietnamDateKey(new Date('2026-09-04T17:00:00.000Z')), '260905');
});

test('PGD approval has separate technical and leadership steps', () => {
  assert.equal(getPgdApprovalRoleForStatus('TECHNICAL_REVIEW'), 'TECHNICAL_REVIEW');
  assert.equal(getPgdApprovalRoleForStatus('LEADERSHIP_APPROVAL'), 'LEADERSHIP_APPROVAL');
});

test('PGD intake and approval UI/API use the server-issued number and two approval gates', () => {
  const root = path.resolve(process.cwd());
  const workspace = fs.readFileSync(path.join(root, 'components/PgdWorkspace.tsx'), 'utf8');
  const stationForms = fs.readFileSync(path.join(root, 'components/PgdStationFormsPanel.tsx'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server.legacy.ts'), 'utf8');
  assert.doesNotMatch(workspace, /form\.requestCode|PYC-GD-/);
  assert.match(workspace, /MACHINERY_LINE/);
  assert.match(workspace, /COAL/);
  assert.match(workspace, /Hệ thống tự cấp theo ngày:.*PGD-YYMMDD-TT/);
  assert.match(workspace, /Đã phê duyệt chuyên môn và trình lãnh đạo/i);
  assert.match(workspace, /workflowSchemaVersion === 2 \? 'Phê duyệt lãnh đạo' : 'Phê duyệt lãnh đạo \/ ký'/);
  assert.match(stationForms, /props\.workflowSchemaVersion === 2 \? 'Phê duyệt lãnh đạo' : 'Phê duyệt lãnh đạo \/ ký'/);
  assert.match(workspace, /getPgdApprovalRoleForStatus/);
  assert.match(server, /getPgdVietnamDateKey\(new Date\(now\)\)/);
  assert.match(server, /pgd-request-sequence:/);
  assert.match(server, /pgd-request-sequence:\$\{vietnamDateKey\}/);
  assert.match(server, /\^PGD-\$\{vietnamDateKey\}-\[0-9\]\{2\}\$/);
  assert.match(server, /formatPgdRequestCode\(nextSerial, new Date\(now\)\)/);
  assert.match(server, /!\['TECHNICAL_REVIEW', 'LEADERSHIP_APPROVAL'\]\.includes\(step\.role\)/);
});

test('PGD workspace exposes the system-manager hard-delete flow with confirmation', () => {
  const root = path.resolve(process.cwd());
  const api = fs.readFileSync(path.join(root, 'utils/pgdApi.ts'), 'utf8');
  const workspace = fs.readFileSync(path.join(root, 'components/PgdWorkspace.tsx'), 'utf8');
  const store = fs.readFileSync(path.join(root, 'store-pgd.ts'), 'utf8');
  assert.match(api, /deletePgdInspection/);
  assert.match(store, /deleteRequest/);
  assert.match(workspace, /Xóa hồ sơ/);
  assert.match(workspace, /window\.prompt/);
  assert.match(workspace, /isPgdSystemManager/);
  assert.match(workspace, /XÓA VĨNH VIỄN/);
  assert.match(api, /confirmationCode/);
});

test('PGD coal numeric fields preserve decimal source measurements', () => {
  const fields = fs.readFileSync(path.join(process.cwd(), 'components/PgdProductGroupFields.tsx'), 'utf8');
  assert.match(fields, /label="Độ tro \(%\)" type="number" step="any"/);
  assert.match(fields, /label="Lưu huỳnh \(%\)" type="number" step="any"/);
});
