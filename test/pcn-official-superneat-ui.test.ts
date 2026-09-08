import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('PGDCN viewport keeps zoom available and global CSS handles motion/focus', () => {
  assert.doesNotMatch(read('../app/layout.tsx'), /maximumScale/);
  const css = read('../index.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});

test('audited surfaces keep the official icon and visual direction', () => {
  assert.doesNotMatch(read('../components/PgdcnAppShell.tsx'), />\u2630</);
  for (const path of ['../components/PcnLoginScreen.tsx', '../components/PgdLoginScreen.tsx']) {
    const source = read(path);
    assert.match(source, /focus-visible/);
    assert.doesNotMatch(source, /radial-gradient|backdrop-blur/);
    assert.match(source, /aria-label=\{showPassword \? 'Ẩn mật khẩu' : 'Hiện mật khẩu'\}/);
    assert.match(source, /role="alert"/);
    assert.match(source, /disabled=\{(?:isSubmitting|busy|isLoading)\}/);
    assert.doesNotMatch(source, /uppercase[^\n]*tracking-widest/);
  }
});

test('login controls keep accessible error and touch-target contracts', () => {
  const surfaces = [
    read('../components/PcnLoginScreen.tsx'),
    read('../components/PgdLoginScreen.tsx'),
  ];

  for (const source of surfaces) {
    assert.match(source, /min-h-11/);
    assert.match(source, /min-w-11/);
    assert.match(source, /focus-visible:ring-2/);
  }

  for (const source of [surfaces[0]]) {
    assert.match(source, /aria-invalid=\{hasUsernameError\}/);
    assert.match(source, /aria-describedby=\{/);
  }
});

test('login errors bind ARIA state only to the affected field', () => {
  const pcn = read('../components/PcnLoginScreen.tsx');
  assert.match(pcn, /aria-invalid=\{hasUsernameError\}/);
  assert.match(pcn, /aria-describedby=\{hasUsernameError \? 'pcn-login-error' : undefined\}/);
  assert.doesNotMatch(pcn, /hasPasswordError/);
  const pcnPassword = pcn.slice(pcn.indexOf('id="pcn-password"'), pcn.indexOf('id="pcn-login-error"'));
  assert.doesNotMatch(pcnPassword, /aria-invalid|aria-describedby/);

  const pgd = read('../components/PgdLoginScreen.tsx');
  assert.doesNotMatch(pgd, /aria-invalid|aria-describedby/);

});

test('PGDCN shell and sidebar expose accessible official navigation controls', () => {
  const shell = read('../components/PgdcnAppShell.tsx');
  assert.match(shell, /from ['"]lucide-react['"]/);
  assert.match(shell, /Menu/);
  assert.match(shell, /aria-label="Mở menu phòng"/);
  assert.doesNotMatch(shell, />☰</);

  const sidebar = read('../components/PgdcnSidebar.tsx');
  assert.match(sidebar, /aria-current/);
  assert.match(sidebar, /aria-expanded/);
  assert.match(sidebar, /focus-visible/);
});

test('Vietnamese-safe typography remains explicit in the global stack', () => {
  const css = read('../index.css');
  assert.match(css, /Roboto/);
  assert.match(css, /Segoe UI|Arial|sans-serif/);
});

test('PGDCN dashboard keeps official styling and interaction contracts', () => {
  const dashboard = read('../components/PgdcnDashboardView.tsx');
  const renderBlock = dashboard.slice(dashboard.lastIndexOf('export default function PgdcnDashboardView'));
  const renderedMarkers = [
    '<CommandHeader',
    'data-testid="pgdcn-dashboard-kpi-grid"',
    '<AttentionQueue',
    '<DomainPipeline',
    '<UpcomingMilestones',
    '<SharedNotifications',
  ];

  for (const marker of renderedMarkers) {
    assert.match(renderBlock, new RegExp(marker));
  }

  const renderedPositions = renderedMarkers.map((marker) => renderBlock.indexOf(marker));
  assert.deepEqual(renderedPositions, [...renderedPositions].sort((a, b) => a - b));
  assert.doesNotMatch(dashboard, /radial-gradient|backdrop-blur|shadow-lg/);
  assert.match(dashboard, /mobile-touch-target/);
  assert.match(dashboard, /focus-visible/);
  assert.doesNotMatch(dashboard, /focus:outline-none/);
  assert.match(dashboard, /Mở thông báo \$\{notification\.title\} · \$\{notification\.read \? 'Đã đọc' : 'Chưa đọc'\}/);
});

test('focused PCN controls and modal surfaces keep touch, focus and scroll contracts', () => {
  const combobox = read('../components/PcnCatalogCombobox.tsx');
  assert.match(combobox, /role="listbox"/);
  assert.match(combobox, /aria-label/);
  assert.match(combobox, /focus-visible/);
  assert.match(combobox, /mobile-touch-target/);
  const comboboxInput = combobox.slice(combobox.indexOf('<input'), combobox.indexOf('/>', combobox.indexOf('<input')));
  assert.match(comboboxInput, /aria-label=\{hideLabel \? label : undefined\}/);

  for (const path of [
    '../components/PcnDocumentOutputModal.tsx',
    '../components/PcnProposalDetailModal.tsx',
    '../components/PcnResultDetailModal.tsx',
    '../components/PcnLabRequestDetailModal.tsx',
  ]) {
    const source = read(path);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /aria-labelledby/);
    assert.match(source, /max-h-\[[^\]]+\]/);
    assert.match(source, /min-h-0/);
    assert.match(source, /mobile-scroll-y/);
    assert.match(source, /shrink-0/);
    assert.match(source, /focus-visible/);
    assert.match(source, /mobile-touch-target/);
  }
});

test('PCN document links keep visible focus and mobile touch affordances', () => {
  const links = [
    ['../components/PcnResultDetailModal.tsx', ['Mở file KQTN']],
    ['../components/PcnLabRequestDetailModal.tsx', ['Mở PYC DOCX', 'Mở PYC PDF']],
  ] as const;

  for (const [path, labels] of links) {
    const source = read(path);
    for (const label of labels) {
      const labelIndex = source.indexOf(label);
      const linkStart = source.lastIndexOf('<a', labelIndex);
      const linkEnd = source.indexOf('</a>', labelIndex) + '</a>'.length;
      const link = source.slice(linkStart, linkEnd);
      assert.ok(labelIndex >= 0 && linkStart >= 0 && linkEnd > linkStart, `${path} should expose ${label}`);
      assert.match(link, /target="_blank"/);
      assert.match(link, /rel="noreferrer"/);
      assert.match(link, /mobile-touch-target/);
      assert.match(link, /min-h-11/);
      assert.match(link, /focus-visible:ring-2/);
    }
  }
});

test('PCN multi-action modal footers stack on mobile and become rows at sm', () => {
  const documentModal = read('../components/PcnDocumentOutputModal.tsx');
  const documentFooter = documentModal.slice(documentModal.indexOf('<footer'), documentModal.indexOf('</footer>') + '</footer>'.length);
  assert.match(documentFooter, /className="flex shrink-0 flex-col items-stretch[^"]*sm:flex-row/);
  assert.match(documentFooter, /mobile-touch-target min-h-11 w-full[^"]*sm:w-auto/);

  const labModal = read('../components/PcnLabRequestDetailModal.tsx');
  const labFooter = labModal.slice(labModal.indexOf('<footer'), labModal.indexOf('</footer>') + '</footer>'.length);
  assert.match(labFooter, /className="flex shrink-0 flex-col items-stretch[^"]*sm:flex-row/);
  const labButtonCount = labFooter.match(/<button/g)?.length || 0;
  const responsiveLabButtonCount = labFooter.match(/w-full sm:w-auto/g)?.length || 0;
  assert.ok(labButtonCount > 0, 'lab footer should keep its actions');
  assert.equal(responsiveLabButtonCount, labButtonCount, 'every lab footer action should be full-width on mobile and auto-width at sm');
});

test('PGD register rows expose one clear interactive owner for opening a dossier', () => {
  const workspace = read('../components/PgdWorkspace.tsx');
  const registerTable = workspace.slice(workspace.indexOf('function PgdRegisterTable'), workspace.indexOf('function PgdRequestDetail'));
  assert.ok(registerTable.length > 0, 'PGD register table should be present');
  assert.doesNotMatch(registerTable, /<tr[^>]*onClick=/);
  assert.match(registerTable, /<button[^>]*onClick=\{\(\) => onOpen\(request\.id\)\}/);
  assert.match(registerTable, /aria-label=\{`Mở hồ sơ \$\{request\.requestCode\}`\}/);
});
