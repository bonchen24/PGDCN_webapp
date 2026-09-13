import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PGD drafting derives checklist linkage from the selected template', () => {
  const source = readFileSync('components/PgdDraftingWorkspaceView.tsx', 'utf8');
  assert.match(source, /attachGeneratedDocument\(request\.id, \{ documentId: document\.id, requirementCode: requirement\.code \}\)/);
  assert.doesNotMatch(source, /requirementCode: initialRequirementCode \|\| requirement\.code/);
});
