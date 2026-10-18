import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pcnWorkspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const pcnDraftingWorkspaceView = fs.readFileSync(new URL('../components/PcnDraftingWorkspaceView.tsx', import.meta.url), 'utf8');

test('PCN workspace selects div for embedded mode and main for standalone mode without role=main on div', () => {
  const selectsDivOrMain =
    /(?:embedded\s*\?\s*['"]div['"]\s*:\s*['"]main['"]|!embedded\s*\?\s*['"]main['"]\s*:\s*['"]div['"])/.test(pcnWorkspace) ||
    /embedded\s*\?[\s\S]*?<div\b[\s\S]*?\{content\}[\s\S]*?:[\s\S]*?<main\b[\s\S]*?\{content\}/.test(pcnWorkspace);

  assert.ok(
    selectsDivOrMain,
    'Workspace content element must be selected from embedded mode (div for embedded, main for standalone)',
  );

  assert.doesNotMatch(
    pcnWorkspace,
    /<div\b[^>]*\brole=(?:["']main["']|\{['"]main['"]\})/,
    'Workspace must not assign role="main" to a div',
  );
});
test('PCN drafting workspace view uses labeled section and contains no main landmark', () => {
  assert.match(
    pcnDraftingWorkspaceView,
    /<section\s+aria-label="Không gian soạn thảo PCN"\s+className="min-w-0 space-y-4">/,
    'Drafting workspace view must enclose drafting workspace with section aria-label="Không gian soạn thảo PCN" className="min-w-0 space-y-4"',
  );

  assert.doesNotMatch(
    pcnDraftingWorkspaceView,
    /<\/?main\b/,
    'Drafting workspace view must not contain <main> or </main> tags',
  );
});
