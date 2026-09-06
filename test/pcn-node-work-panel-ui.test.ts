import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/PcnDossierNodeWorkPanel.tsx', import.meta.url), 'utf8');

test('node work panel exposes only node-scoped document and business actions', () => {
  assert.match(source, /PcnDossierNodeWorkProjection/);
  assert.match(source, /data-testid="pcn-node-work-panel"/);
  assert.match(source, /UPLOAD/);
  assert.match(source, /CREATE_FROM_FORM/);
  assert.match(source, /REMOVE_CURRENT/);
  assert.match(source, /WAIVE/);
  assert.match(source, /Tiếp tục/);
  assert.match(source, /onOpenBusiness/);
});

test('node work panel keeps completed nodes editable through explicit rework-aware actions', () => {
  assert.match(source, /requiresReworkOnMutation/);
  assert.match(source, /Thay phiên bản/);
  assert.match(source, /Xóa tài liệu hiện tại/);
  assert.match(source, /Tạo theo biểu mẫu/);
  assert.match(source, /Lý do bỏ qua/);
});
