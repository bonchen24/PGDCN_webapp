import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/PcnArchifyWorkflowEmbed.tsx', import.meta.url), 'utf8');

test('both domains embed the upstream Archify reader and keep the PCN action bridge compact', () => {
  assert.match(source, /\/api\/\$\{domain === 'pcn' \? 'pcn\/dossiers' : 'pgd\/requests'\}/);
  assert.match(source, /<iframe/);
  assert.match(source, /#focus=\$\{encodeURIComponent\(initialNodeId\)\}/);
  assert.match(source, /event\.origin !== window\.location\.origin/);
  assert.match(source, /source !== 'pcn-archify'/);
  assert.match(source, /pcn-archify-action-dock/);
  assert.match(source, /Bắt đầu node/);
  assert.match(source, /Hoàn tất node/);
  assert.match(source, /Trả về node/);
  assert.doesNotMatch(source, /ArrowDown/);
});
