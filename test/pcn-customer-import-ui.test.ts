import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const viewSource = fs.readFileSync(new URL('../components/PcnCutoverVerificationView.tsx', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const apiPath = new URL('../utils/pcnCustomerImportApi.ts', import.meta.url);
const apiSource = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const contractSource = fs.readFileSync(new URL('../utils/pcnCustomerImportContract.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PCN customer import has an Admin-only server preview and apply boundary', () => {
  assert.match(serverSource, /app\.post\('\/api\/pcn\/customer-import\/preview', async/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/customer-import\/apply', async/);
  assert.match(serverSource, /customer-import\/preview'[\s\S]{0,120}requirePcnAdmin\(req, res\)/);
  assert.match(serverSource, /customer-import\/apply'[\s\S]{0,120}requirePcnAdmin\(req, res\)/);
  assert.match(serverSource, /requirePcnImportBackup/);
  assert.match(serverSource, /KHOI_TAO_DANH_MUC_PCN/);
  assert.match(serverSource, /targetHashBefore/);
  assert.match(serverSource, /withPgTransaction/);
});

test('PCN cutover UI exposes preview, alias review, and explicit import confirmation', () => {
  assert.match(viewSource, /previewPcnCustomerImport/);
  assert.match(viewSource, /Ứng viên alias cần xác nhận/);
  assert.match(viewSource, /PCN_ALIAS_KEEP_SOURCE_KEY/);
  assert.match(viewSource, /PCN_ALIAS_MAP_TO_TARGET/);
  assert.match(viewSource, /setAliasChoiceBySource/);
  assert.match(viewSource, /aliasChoiceBySource/);
  assert.match(viewSource, /aliasDecisions/);
  assert.match(viewSource, /Quyết định alias trước khi apply/);
  assert.doesNotMatch(viewSource, /Apply giữ nguyên khóa nguồn, không tự merge/);
  assert.match(viewSource, /KHOI_TAO_DANH_MUC_PCN/);
  assert.match(viewSource, /Apply danh mục khách hàng/);
  assert.match(workspaceSource, /PcnCutoverVerificationView[\s\S]{0,180}onImported=\{async \(\) => \{ await pcn\.load\(true\); \}\}/);
  assert.match(designSource, /Cổng nhập danh mục khách hàng PCN trong giao diện Admin/);
});

test('PCN customer import API keeps preview and apply separate', () => {
  assert.match(apiSource, /customer-import\/preview/);
  assert.match(apiSource, /customer-import\/apply/);
  assert.match(contractSource, /expectedSourceHash/);
  assert.match(contractSource, /expectedTargetHashBefore/);
  assert.doesNotMatch(apiSource, /\/api\/db\/customers/);
});

// --- End of pcn-customer-import-ui.test.ts ---
