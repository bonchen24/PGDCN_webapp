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
  assert.match(primitives, /const surfaceClass = 'pgdcn-semantic-surface min-w-0 border';/);
  assert.doesNotMatch(primitives, /whiteSurfaceClass/);
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
  const primaryAssistantAction = pcnAssistant.match(/<button type="button" onClick=\{\(\) => void startReview\(\)\}[^>]*>[\s\S]*?<\/button>/);
  assert.ok(primaryAssistantAction, 'PCN assistant primary review action should be present');
  assert.match(primaryAssistantAction[0], /starting \? 'Đang soát xét bằng AI\.\.\.' : 'Bắt đầu soát xét bằng AI'/);
  assert.match(primaryAssistantAction[0], /w-full/);
  assert.match(primaryAssistantAction[0], /text-base/);
  assert.match(pcnAssistant, /Chỉ đọc: AI đọc hồ sơ và đánh giá hỗ trợ; không xác nhận hồ sơ hoặc thay đổi trạng thái\./);
  assert.doesNotMatch(pcnAssistant, /bấm Xác nhận/);
  assert.match(pcnAssistant, /text-\[11px\] font-black text-rose-800[^\"]*focus-visible:ring-2[^\n]*Hồ sơ còn thiếu/);

  const approval = sources[3];
  assert.match(approval, /text-\[11px\] font-black uppercase tracking-wide[^\n]*Ý kiến quyết định bước 5/);
  assert.match(approval, /text-\[11px\] font-black text-white[^\n]*Phê duyệt bước 5/);
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PgdcnSidebar from '../components/PgdcnSidebar';
import PcnLoginScreen from '../components/PcnLoginScreen';
import PgdcnWindowsWorkflowModal from '../components/PgdcnWindowsWorkflowModal';
import type { PcnUserAccount } from '../types';
import type { PgdcnNavigationTarget } from '../components/PgdcnSidebar';

test('login renders the two real organization logos and a short responsive form heading', () => {
  const markup = renderToStaticMarkup(createElement(PcnLoginScreen));
  assert.match(markup, /src="\/icons\/iemm-logo-192\.png"[^>]*alt="Logo IEMM"/);
  assert.match(markup, /src="\/icons\/tvci-icon-192\.png"[^>]*alt="Logo TVCI"/);
  assert.match(markup, /<h1[^>]*>Đăng nhập<\/h1>/);
  // Before: this expected a hyphen where the rendered tagline uses “và”.
  const organizationTagline = markup.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)?.[1] || '';
  assert.match(organizationTagline, /Phòng Giám định/);
  assert.match(organizationTagline, /Chứng nhận/);
  assert.match(organizationTagline, /Phát triển thị trường/);
  assert.match(markup, /max-w-md/);
  assert.match(markup, /min-h-11 w-full/);
  assert.doesNotMatch(markup, /admin@example\.com|password123|Mật khẩu mẫu/i);
});

const sidebarMarkup = (activeTarget: PgdcnNavigationTarget) => renderToStaticMarkup(createElement(PgdcnSidebar, {
  currentUser: {
    username: 'reviewer',
    name: 'Nguyễn An',
    role: 'admin',
    systemRole: 'admin',
    pgdRole: 'PGD_ADMIN',
    departmentScopes: ['PCN', 'PGD'],
    professionalRoleCodes: [],
  } as PcnUserAccount,
  activeTarget,
  collapsed: true,
  mobileOpen: true,
  onToggle: () => undefined,
  onNavigate: () => undefined,
  onCloseMobile: () => undefined,
  onLogout: () => undefined,
}));

const buttonWithLabel = (markup: string, label: string) => markup.match(new RegExp(`<button(?=[^>]*aria-label="${label}")[^>]*>`))?.[0] || '';

test('domain navigation keeps aria-current and uses distinct PCN, PGD, and shared active tones', () => {
  const pcnMarkup = sidebarMarkup({ domain: 'PCN', section: 'operations' });
  const pgdMarkup = sidebarMarkup({ domain: 'PGD', section: 'operations' });
  const sharedMarkup = sidebarMarkup({ domain: 'department', section: 'department-dashboard' });
  const pcnButton = buttonWithLabel(pcnMarkup, 'Sổ dữ liệu PCN');
  const pgdButton = buttonWithLabel(pgdMarkup, 'Sổ dữ liệu PGD');
  const sharedButton = buttonWithLabel(sharedMarkup, 'Tổng quan');

  assert.match(pcnButton, /aria-current="page"/);
  assert.match(pcnButton, /bg-emerald-700/);
  assert.match(pgdButton, /aria-current="page"/);
  assert.match(pgdButton, /bg-blue-600/);
  assert.match(sharedButton, /aria-current="page"/);
  assert.match(sharedButton, /bg-slate-(700|800)/);
  assert.match(pcnMarkup, /title="Sổ dữ liệu PCN"/);
});

test('mobile navigation drawer has a dismissible backdrop and keyboard focus lifecycle', () => {
  const markup = sidebarMarkup({ domain: 'PCN', section: 'operations' });
  const sidebar = read('../components/PgdcnSidebar.tsx');
  const backdrop = markup.match(/<button(?=[^>]*data-testid="pgdcn-sidebar-backdrop")[^>]*>/)?.[0] || '';

  assert.match(backdrop, /aria-label="Đóng menu phòng"/);
  assert.match(backdrop, /lg:hidden/);
  assert.match(sidebar, /transition-\[width,transform\] duration-200/);
  assert.match(sidebar, /event\.key === 'Escape'/);
  assert.match(sidebar, /event\.key !== 'Tab'/);
  assert.match(sidebar, /closeButtonRef\.current\?\.focus\(\)/);
  assert.match(sidebar, /returnFocusRef\.current\?\.focus\(\)/);
});

test('mobile shell exposes the active context while page scroll remains locally contained', () => {
  const shell = read('../components/PgdcnAppShell.tsx');
  assert.match(shell, /data-testid="pgdcn-mobile-context"/);
  assert.match(shell, /<span className="lg:hidden">PGDCN · TVCI<\/span>/);
  assert.match(shell, /<span className="hidden lg:inline">Phòng Giám định - Chứng nhận và Phát triển thị trường · TVCI<\/span>/);
  assert.match(shell, /mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto/);
  assert.match(shell, /app-compact flex h-\[100dvh\] w-full overflow-hidden/);
});

test('shared workflow modal keeps dialog semantics, a single body scroller, focus trap, and a vector icon', () => {
  const modalMarkup = renderToStaticMarkup(createElement(PgdcnWindowsWorkflowModal, {
    open: true,
    title: 'Tạo PYC',
    eyebrow: 'Tiếp nhận hồ sơ',
    description: 'Nhập dữ liệu cần thiết để bắt đầu hồ sơ.',
    testId: 'contract-modal',
    titleId: 'contract-modal-title',
    onClose: () => undefined,
    onMinimize: () => undefined,
    onRestore: () => undefined,
    footer: createElement('button', { type: 'button' }, 'Hủy'),
    children: createElement('label', null, 'Mã hồ sơ', createElement('input', { type: 'text' })),
  }));
  const modal = read('../components/PgdcnWindowsWorkflowModal.tsx');
  const modalIconStyles = read('../index.css');

  assert.match(modalMarkup, /role="dialog" aria-modal="true" aria-labelledby="contract-modal-title"/);
  assert.match(modalMarkup, /data-testid="contract-modal-body" class="mobile-scroll-y min-h-0 flex-1 overflow-x-hidden overflow-y-auto"/);
  assert.match(modal, /event\.key !== 'Tab'/);
  assert.match(modal, /first\.focus\(\)/);
  assert.match(modal, /last\.focus\(\)/);
  assert.match(modal, /aria-hidden="true"><span className="text-sm font-black">▣<\/span>/);
  assert.match(modalIconStyles, /section\[role="dialog"\] > header > div:first-child > span\[aria-hidden="true"\] > span\.text-sm\.font-black/);
  assert.match(modalIconStyles, /--pgdcn-workflow-modal-file-icon:\s*url\("data:image\/svg\+xml,/);
  assert.match(modalIconStyles, /mask:\s*var\(--pgdcn-workflow-modal-file-icon\)/);});

test('compact UI raises tiny utility text to a readable 11px floor', () => {
  const css = read('../index.css');
  for (const size of ['9px', '10px']) {
    const ruleStart = css.indexOf(`.app-compact [class~="text-[${size}]"]`);
    const nextRule = css.indexOf('\n  .app-compact [class~="text-[', ruleStart + 1);
    const rule = css.slice(ruleStart, nextRule < 0 ? undefined : nextRule);
    assert.ok(ruleStart >= 0, `Missing compact utility rule for ${size}`);
    assert.match(rule, /font-size:\s*max\(0\.6875rem,/);
  }
});

test('summary grid preserves sticky identifiers/actions and keyboard sorting/edit affordances', () => {
  const source = read('../components/PgdcnDossierSummaryGrid.tsx');
  assert.match(source, /aria-sort=/);
  assert.match(source, /sticky left-0/);
  assert.match(source, /sticky right-0/);
  assert.match(source, /aria-label=\{'Sắp xếp theo '/);
  assert.match(source, /event\.key === 'Enter'|event\.key === 'Tab'/);
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /py-4 md:py-1\.5/);
  assert.match(source, /tabIndex={column.editable && isRowEditable\(row.id\) \? 0 : undefined}/);
  assert.match(source, /event.key === 'Enter'[\s\S]*?startEdit\(row, column\)/);
});
test('dashboard keeps its action hierarchy while using a restrained palette', () => {
  const source = read('../components/PgdcnDashboardView.tsx');
  const kpiTones = [...source.matchAll(/tone="([^"]+)"/g)].map((match) => match[1]);
  const pipelineToneBlock = source.match(/const PIPELINE_TONE_CLASS:[\s\S]*?= \{([\s\S]*?)\n\};/)?.[1] || '';
  const pipelineTones = [...pipelineToneBlock.matchAll(/:\s*'([^']+)'/g)].map((match) => match[1]);
  const attentionPosition = source.indexOf('<AttentionQueue');
  const referencePosition = source.indexOf('<DomainPipeline summaries=');

  assert.ok(new Set(kpiTones).size <= 4, 'KPI tone palette should stay to domain, neutral, and attention colors');
  assert.ok(new Set(pipelineTones).size <= 5, 'pipeline segments should reuse semantic colors');
  assert.ok(attentionPosition >= 0 && referencePosition > attentionPosition, 'attention queue precedes pipeline reference content');
  assert.match(source, /data-testid="pgdcn-dashboard-kpi-grid"/);
});
