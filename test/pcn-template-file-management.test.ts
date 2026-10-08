import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const settingsSource = fs.readFileSync(new URL('../components/PcnSettingsView.tsx', import.meta.url), 'utf8');
const modalSource = fs.readFileSync(new URL('../components/PcnTemplateSettingsModal.tsx', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../utils/pcnTemplateApi.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('PCN template management surface exposes current-file upload/download and controlled review', () => {
  assert.match(settingsSource, /onUploadTemplate/);
  assert.match(settingsSource, /Tải xuống/);
  assert.match(settingsSource, /Tải bản mới/);
  assert.match(settingsSource, /onReviewTemplate/);
  assert.match(settingsSource, /PcnTemplateReviewAction/);
  assert.match(settingsSource, /Yêu cầu chỉnh sửa/);
  assert.doesNotMatch(modalSource, /onReviewTemplate|onAnnotateTemplate|mapping|placeholder/i);
});

test('template upload client targets the existing template id and sends DOCX as multipart data', () => {
  assert.match(apiSource, /uploadPcnTemplate/);
  assert.match(apiSource, /\/api\/pcn\/templates\/\$\{encodeURIComponent\(templateId\)\}\/file/);
  assert.match(apiSource, /form\.append\('file', file\)/);
});

test('template upload server overwrites the current asset and catalog pointer for the same template', () => {
  const routeStart = serverSource.indexOf("app.post('/api/pcn/templates/:templateId/file'");
  assert.ok(routeStart >= 0, 'template replacement upload route is missing');
  const route = serverSource.slice(routeStart, routeStart + 9000);
  assert.match(route, /requirePcnAdmin/);
  assert.match(route, /file\.buffer/);
  assert.match(route, /x-upsert|uploadObject/);
  assert.match(route, /ON CONFLICT \(id\) DO UPDATE SET/);
  assert.match(route, /UPDATE app_documents SET data/);
  assert.match(route, /pcnTemplateDefinitions/);
  assert.match(route, /same template|templateId|template id/i);
  assert.match(route, /privateAssetVerified: true/);
});

// --- End of pcn-template-file-management.test.ts ---
