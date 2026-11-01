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

test('PCN sample ledger keeps distinct lot, sample, PTN/PYC, result identity, location and collapsed disclosure', () => {
  const source = read('../components/PcnLabOperationsView.tsx');

  // Distinct identities present
  assert.match(source, /row\.lotCode/);
  assert.match(source, /row\.sampleCode/);
  assert.match(source, /cell\.pycNumber/);
  assert.match(source, /cell\.labSampleCode/);
  assert.match(source, /cell\.resultOutcome/);
  assert.match(source, /row\.currentLocation/);

  // Lab details collapsed by default (no open attribute on details)
  assert.match(source, /<details className=/);
  assert.doesNotMatch(source, /<details[^>]*open/);

  // Accessible search and filter controls
  assert.match(source, /aria-label="Tìm trong Sổ quản lý mẫu"/);
  assert.match(source, /aria-label="Lọc theo phòng thử nghiệm"/);
});

test('PGD sample ledger maintains distinct identities for lot, sample, PTN/PYC, result, and location', () => {
  const ledger = read('../components/PgdSampleOperationsView.tsx');

  // Distinct identities
  assert.match(ledger, /sample\.sampleCode/);
  assert.match(ledger, /request\?\.requestCode/);
  assert.match(ledger, /request\?\.lotCode/);
  assert.match(ledger, /sample\.samplingLocation|request\?\.inspectionLocation/);
  assert.match(ledger, /labRequest\.status/);
  assert.match(ledger, /result\?\.reportNumber/);

  // Disclosure collapsed by default
  assert.match(ledger, /<details className="rounded-md/);
  assert.doesNotMatch(ledger, /<details[^>]*open/);

  // Meaningful labels >= 11px and mobile touch targets >= 44px
  assert.match(ledger, /text-\[11px\] font-black text-slate-600/);
  assert.match(ledger, /mobile-touch-target/);
});
