import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PGD steps hand off source context to drafting and confirmation', () => {
  const stepPanel = read('components/PgdDossierStepWorkPanel.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  const drafting = read('components/PgdDraftingWorkspaceView.tsx');
  const generation = read('components/PgdDocumentGenerationPanel.tsx');
  assert.match(stepPanel, /onOpenDrafting/);
  assert.match(stepPanel, /Soạn thảo tài liệu/);
  assert.match(workspace, /initialDraftingRequestId|draftingRequestId/);
  assert.match(drafting, /initialRequestId|requestId/);
  assert.match(generation, /Xác nhận vào bộ hồ sơ/);
  assert.match(generation, /testId="pgd-document-readiness"/);
  assert.match(generation, /readinessIssues\.map/);
  assert.match(generation, /registrationNumber: request\.registryMetadata\?\.registrationNumber/);
  assert.match(generation, /receivedAt: request\.registryMetadata\?\.receivedAt/);
  assert.match(generation, /technicalDossierNote: request\.registryMetadata\?\.technicalDossierNote/);
});
