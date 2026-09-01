import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/PcnWorkflowMap.tsx', import.meta.url), 'utf8');

test('renders workflow nodes as accessible graphic buttons', () => {
  assert.match(source, /aria-label/);
  assert.match(source, /aria-current/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /onSelectNode/);
  assert.match(source, /COMPLETED|CURRENT|FUTURE|EXCEPTION/);
  assert.match(source, /returned|blocked|overdue/i);
  assert.match(source, /overflow-x-auto|overflow-y-auto/);
  assert.doesNotMatch(source, /StationColumn|Trạm \$\{|Mỗi cột/);
});

test('workflow graphic exposes a separate exception branch and uses no business-state timer', () => {
  assert.match(source, /EXCEPTIONS/);
  assert.match(source, /Ngoại lệ/);
  assert.doesNotMatch(source, /setInterval|setTimeout/);
  assert.doesNotMatch(source, /onUpdateStatus|fetch\(/);
});

test('active PCN work surfaces use workflow-step language instead of station UI', () => {
  const files = [
    'PcnPipelineBoard.tsx',
    'PcnDossierDetailView.tsx',
    'PcnWorkQueueView.tsx',
    'PcnApprovalModal.tsx',
  ];
  for (const file of files) {
    const content = fs.readFileSync(new URL(`../components/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(content, /trạm/i, `${file} still exposes station wording`);
  }
});
