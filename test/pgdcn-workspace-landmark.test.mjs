import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pgdWorkspace = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const pgdDraftingWorkspaceView = fs.readFileSync(new URL('../components/PgdDraftingWorkspaceView.tsx', import.meta.url), 'utf8');

test('PGD workspace selects WorkspaceRoot section with accessible label for embedded and main for standalone', () => {
  assert.ok(
    /(?:const|let)\s+WorkspaceRoot\s*=\s*embedded\s*\?\s*['"]section['"]\s*:\s*['"]main['"]/.test(pgdWorkspace),
    "Workspace must declare WorkspaceRoot selecting 'section' for embedded and 'main' for standalone",
  );

  const workspaceRootOpeningMatch = pgdWorkspace.match(/<WorkspaceRoot\b([\s\S]*?)>/);
  assert.ok(
    Boolean(workspaceRootOpeningMatch),
    'Workspace JSX must render opening <WorkspaceRoot ...> tag',
  );

  const workspaceRootAttributes = workspaceRootOpeningMatch ? workspaceRootOpeningMatch[1] : '';

  assert.ok(
    /aria-label=\{(?:embedded\s*\?\s*['"]Không gian làm việc PGD['"]\s*:\s*undefined|!embedded\s*\?\s*undefined\s*:\s*['"]Không gian làm việc PGD['"])\}/.test(workspaceRootAttributes),
    "Opening <WorkspaceRoot> tag must set accessible label 'Không gian làm việc PGD' when embedded",
  );

  assert.ok(
    /className=\{embedded\s*\?\s*['"]min-w-0['"]\s*:\s*['"]mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto['"]\}/.test(workspaceRootAttributes),
    'Opening <WorkspaceRoot> tag must preserve root className expression',
  );

  assert.ok(
    /<\/WorkspaceRoot>/.test(pgdWorkspace),
    'Workspace JSX must contain matching </WorkspaceRoot> closing tag',
  );
});
test('PGD drafting workspace uses section with accessible label for drafting-and-review wrapper and contains no main landmark', () => {
  assert.ok(
    /<section\b[^>]*?\baria-label=['"]Không gian soạn thảo PGD['"][^>]*?\bclassName=['"]min-w-0['"]|<section\b[^>]*?\bclassName=['"]min-w-0['"][^>]*?\baria-label=['"]Không gian soạn thảo PGD['"]/.test(pgdDraftingWorkspaceView),
    "Drafting-and-review wrapper must be a <section> with aria-label='Không gian soạn thảo PGD' and className='min-w-0'",
  );

  assert.ok(
    !/<main\b/.test(pgdDraftingWorkspaceView),
    'Component must not contain opening <main> tag',
  );

  assert.ok(
    !/<\/main>/.test(pgdDraftingWorkspaceView),
    'Component must not contain closing </main> tag',
  );
});

test('PGD hidden dossier detail wrapper uses labeled section and contains no main landmark before sibling aside', () => {
  const hiddenWrapperMatch = pgdWorkspace.match(
    /<div\b[^>]*?className=['"][^'"]*hidden mt-3 grid min-w-0 gap-3 lg:grid-cols-\[minmax\(0,1\.3fr\)_minmax\(18rem,0\.7fr\)\][^'"]*['"]>([\s\S]*?<\/aside>)\s*<\/div>/,
  );
  assert.ok(
    Boolean(hiddenWrapperMatch),
    'PGD workspace must contain uniquely identified hidden dossier detail wrapper',
  );

  const hiddenWrapperContent = hiddenWrapperMatch ? hiddenWrapperMatch[1] : '';

  assert.ok(
    /<section\b[^>]*?\baria-label=['"]Thông tin và xử lý hồ sơ PGD['"][^>]*?\bclassName=['"]min-w-0 space-y-3['"]|<section\b[^>]*?\bclassName=['"]min-w-0 space-y-3['"][^>]*?\baria-label=['"]Thông tin và xử lý hồ sơ PGD['"]/.test(hiddenWrapperContent),
    "Hidden dossier detail wrapper must use a <section> with aria-label='Thông tin và xử lý hồ sơ PGD' and className='min-w-0 space-y-3'",
  );

  assert.ok(
    !/<main\b/.test(hiddenWrapperContent),
    'Hidden dossier detail wrapper must not contain opening <main> tag',
  );

  assert.ok(
    !/<\/main>/.test(hiddenWrapperContent),
    'Hidden dossier detail wrapper must not contain closing </main> tag',
  );

  assert.ok(
    /<\/section>\s*<aside\b/.test(hiddenWrapperContent),
    'Hidden dossier detail wrapper must close that section before its sibling aside',
  );
});
