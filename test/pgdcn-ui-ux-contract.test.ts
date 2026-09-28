import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('shared PGDCN UI primitives define accessible compact surfaces', () => {
  const primitivePath = new URL('../components/PgdcnUiPrimitives.tsx', import.meta.url);
  assert.equal(fs.existsSync(primitivePath), true);
  const source = fs.readFileSync(primitivePath, 'utf8');
  for (const marker of ['PgdcnPageHeader', 'PgdcnToolbar', 'PgdcnStatusBadge', 'PgdcnWorkflowRail', 'PgdcnStatePanel', 'min-w-0', 'mobile-touch-target', 'aria-current', 'mobile-scroll-x']) {
    assert.ok(source.includes(marker), `Missing UI primitive marker: ${marker}`);
  }
});

test('PCN and PGD surfaces use the shared presentation rhythm', () => {
  for (const path of ['../components/PcnOperationsRegisterView.tsx', '../components/PgdWorkspace.tsx', '../components/PcnDossierDetailView.tsx', '../components/PgdDossierOperationsPanel.tsx']) {
    const source = read(path);
    assert.match(source, /PgdcnUiPrimitives|PgdcnPageHeader|PgdcnToolbar|PgdcnWorkflowRail|PgdcnStatePanel/);
  }
});

test('dossier detail exposes a horizontally scrollable workflow rail', () => {
  const source = read('../components/PcnDossierDetailView.tsx');
  assert.match(source, /PgdcnWorkflowRail|mobile-scroll-x/);
});

test('Official/Superneat surfaces preserve state tones and restrained elevation', () => {
  const primitives = read('../components/PgdcnUiPrimitives.tsx');
  assert.match(primitives, /const surfaceClass = 'min-w-0 rounded-xl border border-slate-200 shadow-sm';/);
  assert.match(primitives, /const whiteSurfaceClass = 'bg-white';/);
  assert.doesNotMatch(primitives, /const surfaceClass = '[^']*bg-white/);
  assert.match(primitives, /PgdcnStatePanel[\s\S]*surfaceClass[\s\S]*statePanelToneClass/);

  const sidebar = read('../components/PgdcnSidebar.tsx');
  assert.doesNotMatch(sidebar, /shadow-lg/);
  assert.match(sidebar, /shadow-sm/);
});

test('shared navigation puts expansion state on its controls and exposes keyboard focus', () => {
  const shell = read('../components/PgdcnAppShell.tsx');
  const sidebar = read('../components/PgdcnSidebar.tsx');
  const desktopToggle = shell.match(/aria-label="Thu gọn \/ Mở rộng thanh điều hướng" aria-expanded={!collapsed} aria-controls="pgdcn-sidebar" className="[^"]*"/)?.[0];
  assert.ok(desktopToggle, 'Missing desktop sidebar toggle');
  assert.match(desktopToggle, /aria-expanded={!collapsed}/);
  assert.match(desktopToggle, /aria-controls="pgdcn-sidebar"/);
  assert.match(desktopToggle, /focus-visible:ring-2/);

  const mobileToggle = shell.match(/aria-label="Mở menu phòng" aria-expanded={mobileOpen} aria-controls="pgdcn-sidebar" className="[^"]*"/)?.[0];
  assert.ok(mobileToggle, 'Missing mobile sidebar toggle');
  assert.match(mobileToggle, /aria-expanded={mobileOpen}/);
  assert.match(mobileToggle, /aria-controls="pgdcn-sidebar"/);

  const nav = sidebar.match(/<nav\b[^>]*>/)?.[0] || '';
  assert.doesNotMatch(nav, /aria-expanded=/, 'Expansion state belongs to the control, not the navigation landmark');
  const closeControl = sidebar.match(/<button(?=[^>]*onCloseMobile)[^>]*>/)?.[0];
  assert.ok(closeControl, 'Missing mobile sidebar close control');
  assert.match(closeControl, /aria-expanded={mobileOpen}/);
  assert.match(closeControl, /aria-controls="pgdcn-sidebar"/);
  assert.match(sidebar, /aria-current={active \? 'page' : undefined}/);
  const settingsControl = sidebar.match(/<button(?=[^>]*onOpenPersonalSettings)[^>]*>/)?.[0];
  assert.ok(settingsControl, 'Missing personal settings control');
  assert.match(settingsControl, /focus-visible:ring-2/);
});

test('common high-impact controls use a visible focus ring and readable decision text', () => {
  const sources = [
    '../components/ActivityLogView.tsx',
    '../components/PgdcnAssistantView.tsx',
    '../components/PcnAssistantView.tsx',
    '../components/PcnApprovalModal.tsx',
  ].map(read);

  for (const source of sources) {
    for (const match of source.matchAll(/className="([^"]*(?:outline-none|focus:border)[^"]*)"/g)) {
      assert.match(match[1], /focus-visible:ring-2/, `Control lacks a focus-visible ring: ${match[1]}`);
    }
  }

  const primitives = read('../components/PgdcnUiPrimitives.tsx');
  assert.match(primitives, /text-\[11px\] font-black">\{step\.label\}/);
  assert.match(primitives, /max-w-md text-\[11px\] leading-4">\{description\}/);

  const activity = sources[0];
  assert.match(activity, /text-\[11px\] font-black text-slate-600">Tìm kiếm nhật ký/);
  assert.match(activity, /text-\[11px\] font-black uppercase text-emerald-700[^\n]*Tải thêm/);

  const pgdAssistant = sources[1];
  assert.match(pgdAssistant, /text-\[11px\] font-black text-white[^\n]*Bắt đầu soát xét hồ sơ/);
  assert.match(pgdAssistant, /text-\[11px\] font-black text-blue-800[^\"]*focus-visible:ring-2[^\n]*Tổng hợp phiên hiện trường/);

  const pcnAssistant = sources[2];
  assert.match(pcnAssistant, /text-\[11px\] font-black text-white[^\n]*Xác nhận hồ sơ/);
  assert.match(pcnAssistant, /text-\[11px\] font-black text-rose-800[^\"]*focus-visible:ring-2[^\n]*Hồ sơ còn thiếu/);

  const approval = sources[3];
  assert.match(approval, /text-\[11px\] font-black uppercase tracking-wide[^\n]*Ý kiến quyết định bước 5/);
  assert.match(approval, /text-\[11px\] font-black text-white[^\n]*Phê duyệt bước 5/);
});
