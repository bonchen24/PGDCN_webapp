import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('PGD exposes a dedicated sample management ledger beside the summary register', () => {
  const sidebar = read('../components/PgdcnSidebar.tsx');
  const pgdSidebar = read('../components/PgdSidebar.tsx');
  const workspace = read('../components/PgdWorkspace.tsx');
  const ledger = read('../components/PgdSampleOperationsView.tsx');

  assert.match(sidebar, /sample-operations/);
  assert.match(sidebar, /Sổ quản lý mẫu/);
  assert.match(pgdSidebar, /sample-operations/);
  assert.match(workspace, /PgdSampleOperationsView/);
  assert.match(workspace, /activeSection === 'sample-operations'/);
  assert.match(ledger, /data-testid="pgd-sample-register"/);
  assert.match(ledger, /Mẫu PGD/);
  assert.match(ledger, /Mở hồ sơ/);
  assert.match(ledger, /mobile-scroll-x/);
});

test('PGD sample identifiers stay compact, fully inspectable, and copyable', () => {
  const ledger = read('../components/PgdSampleOperationsView.tsx');

  assert.match(ledger, /function CopyableIdentifier/);
  assert.match(ledger, /value=\{sample\.sampleCode\}/);
  assert.match(ledger, /value=\{sample\.sealNumber\}/);
  assert.match(ledger, /truncate/);
  assert.match(ledger, /max-w-/);
  assert.match(ledger, /<details/);
  assert.match(ledger, /<summary/);
  assert.match(ledger, /break-all/);
  assert.match(ledger, /type="button"/);
  assert.match(ledger, /Sao chép/);
  assert.match(ledger, /aria-label=/);
  assert.match(ledger, /focus-visible:ring/);
  assert.match(ledger, /navigator\.clipboard\.writeText\(value\)/);
  assert.match(ledger, /toast\.success/);
  assert.match(ledger, /toast\.error/);
});

test('authenticated app applies the shared 10 percent type scale without zooming layout', () => {
  const css = read('../index.css');
  assert.match(css, /--app-font-scale:\s*1\.0/);
  assert.match(css, /font-size:\s*calc\([^;]*var\(--app-font-scale\)/);
  assert.doesNotMatch(css, /\.app-compact\s*\{[^}]*zoom\s*:/s);
});

// --- End of pcn-pgd-sample-ledger-ui.test.ts ---
