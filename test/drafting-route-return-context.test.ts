import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

function assertRoutePropagatesReturnTo(routePath: string, shellProp: string): void {
  const source = read(routePath);

  assert.match(
    source,
    /searchParams\?: \{[^}]*returnTo\?: string \| string\[\]/,
    `${routePath} must accept the returnTo search parameter`,
  );
  assert.match(
    source,
    new RegExp(`${shellProp}=\\{scalar\\(searchParams\\?\\.returnTo\\)\\}`),
    `${routePath} must pass the parsed returnTo value into ${shellProp}`,
  );
  assert.match(source, /function scalar\(value: string \| string\[\] \| undefined\)/);
  assert.match(source, /return candidate\?\.trim\(\) \|\| undefined;/);
}

test('PCN and PGD drafting routes explicitly propagate returnTo into the shared shell', () => {
  assertRoutePropagatesReturnTo('app/pgdcn/pcn/drafting/page.tsx', 'initialPcnDraftReturnTo');
  assertRoutePropagatesReturnTo('app/pgdcn/pgd/drafting/page.tsx', 'initialPgdDraftReturnTo');

  const shell = read('components/PgdcnAppShell.tsx');
  assert.match(shell, /initialPcnDraftReturnTo\?: string/);
  assert.match(shell, /initialPgdDraftReturnTo\?: string/);
  assert.match(shell, /initialDraftReturnTo=\{initialPcnDraftReturnTo\}/);
  assert.match(shell, /initialDraftReturnTo=\{initialPgdDraftReturnTo\}/);
});

// --- End of drafting-route-return-context.test.ts ---
