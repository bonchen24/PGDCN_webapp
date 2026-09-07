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
  for (const path of ['../components/PcnLoginScreen.tsx', '../components/PgdLoginScreen.tsx', '../components/LoginScreen.tsx']) {
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
    read('../components/LoginScreen.tsx'),
  ];

  for (const source of surfaces) {
    assert.match(source, /min-h-11/);
    assert.match(source, /min-w-11/);
    assert.match(source, /focus-visible:ring-2/);
  }

  for (const source of [surfaces[0], surfaces[2]]) {
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

  const legacy = read('../components/LoginScreen.tsx');
  assert.match(legacy, /aria-invalid=\{hasUsernameError\}/);
  assert.match(legacy, /aria-describedby=\{hasUsernameError \? 'legacy-login-error' : undefined\}/);
  assert.doesNotMatch(legacy, /hasPasswordError/);
  const legacyPassword = legacy.slice(legacy.indexOf('id="password"'), legacy.indexOf('id="legacy-login-error"'));
  assert.doesNotMatch(legacyPassword, /aria-invalid|aria-describedby/);
  assert.match(legacy, /aria-invalid=\{hasResetUsernameError\}/);
  assert.match(legacy, /aria-invalid=\{hasResetFullNameError\}/);
  assert.match(legacy, /aria-invalid=\{hasResetContactError\}/);
  assert.match(legacy, /hasResetUsernameError = \/tên đăng nhập\|không tìm thấy tài khoản này\//);
});

test('legacy login hides decorative icons without hiding action icons', () => {
  const legacy = read('../components/LoginScreen.tsx');
  for (const icon of ['User', 'Lock', 'Phone', 'AlertCircle', 'CheckCircle2', 'ShieldCheck', 'Loader2']) {
    assert.match(legacy, new RegExp(`<${icon} aria-hidden="true"`));
  }
  assert.match(legacy, /<EyeOff size=\{16\}|<Eye size=\{16\}/);
  assert.match(legacy, /<ArrowLeft size=\{18\}|<ArrowLeft size=\{14\}/);
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
