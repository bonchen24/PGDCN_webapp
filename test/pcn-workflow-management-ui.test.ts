import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('workflow template management is a manager/admin surface with revision and publish controls', () => {
  const view = read('components/PcnWorkflowTemplateManagementView.tsx');
  assert.match(view, /workflowTemplates/);
  assert.match(view, /onCreateWorkflowRevision/);
  assert.match(view, /onPublishWorkflowTemplate/);
  assert.match(view, /onRetireWorkflowTemplate/);
  assert.match(view, /nodes|transitions/);
  assert.match(view, /Chỉ Admin hoặc Quản lý PCN/);
});

test('shared settings passes the workflow catalog and manager-only actions to the workflow surface', () => {
  const settings = read('components/PgdcnSystemSettingsView.tsx');
  assert.match(settings, /PcnWorkflowTemplateManagementView/);
  assert.match(settings, /workflowTemplates/);
  assert.match(settings, /canManageWorkflow/);
});
