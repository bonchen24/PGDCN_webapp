import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('shared toolbar keeps search and filters on one horizontal line with local mobile overflow', () => {
  const css = read('../index.css');

  assert.match(css, /\.pgdcn-toolbar-nowrap\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*nowrap;[\s\S]*overflow-x:\s*auto;/);
  assert.match(css, /\.pgdcn-toolbar-search/);
  assert.match(css, /\.pgdcn-toolbar-filter/);
});

test('primary PCN and PGD management surfaces use the shared one-line toolbar', () => {
  const sourceFiles = [
    '../components/PcnWorkspace.tsx',
    '../components/PcnDossierQueueView.tsx',
    '../components/PcnLabOperationsView.tsx',
    '../components/PgdWorkspace.tsx',
    '../components/PgdSampleOperationsView.tsx',
    '../components/PgdDossierSelector.tsx',
    '../components/PgdcnDossierSummaryGrid.tsx',
    '../components/PgdcnDossierTemplateManagementView.tsx',
    '../components/PgdcnUiPrimitives.tsx',
    '../components/ActivityLogView.tsx',
  ];

  for (const sourceFile of sourceFiles) assert.match(read(sourceFile), /pgdcn-toolbar-nowrap/);
});

// --- End of toolbar-single-row-ui.test.ts ---
