import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspace = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const detail = workspace.slice(workspace.indexOf('function PgdRequestDetail'), workspace.indexOf('export type PgdWorkspaceProps'));

test('PGD dossier fetch failures stay visible, retry safely, and do not report unknown documents as missing', () => {
  assert.match(detail, /role="alert"/);
  assert.match(detail, /\{dossierError\}/);
  assert.match(detail, /Không thể tải trạng thái chứng từ/);
  assert.match(detail, /Các mục chưa có dữ liệu chưa thể xác định là thiếu/);
  assert.match(detail, /Tải lại tài liệu/);
  assert.match(detail, /onClick=\{\(\) => void loadDossierDocuments\(\)\}/);
  assert.match(detail, /disabled=\{dossierLoading\}/);
  assert.match(detail, /dossierLoading \? 'Đang tải lại tài liệu…' : 'Tải lại tài liệu'/);
  assert.match(detail, /pgd\.fetchDossierDocuments\(requestId\)/);
  assert.match(detail, /setDossierError\(null\)/);
  assert.match(detail, /dossierFetchSequence\.current !== fetchSequence/);
  assert.match(detail, /dossierFetchSequence\.current \+= 1/);
  assert.doesNotMatch(detail, /setDossierRequirements\(getPgdDossierRequirements\(request\.productGroup\)\)/);
});
