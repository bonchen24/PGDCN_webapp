import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnDashboardView from '../components/PgdcnDashboardView';

const renderDashboard = (overrides: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PgdcnDashboardView, {
  scopes: ['PCN', 'PGD'],
  pcnDossiers: [],
  pgdRequests: [],
  currentUser: { username: 'lan', name: 'Lan', role: 'staff' },
  notifications: [],
  onOpenPcn: () => undefined,
  onOpenPgd: () => undefined,
  onOpenPcnWorkspace: () => undefined,
  onOpenPgdWorkspace: () => undefined,
  onOpenNotifications: () => undefined,
  onSelectNotification: () => undefined,
  ...overrides,
} as never));

const dossier = (overrides: Record<string, unknown> = {}) => ({
  id: 'pcn-1',
  dossierCode: 'HS-PCN-001',
  status: 'AWAITING_DOCUMENTS',
  ownerUsername: 'lan',
  targetDate: '2000-01-01',
  customerSnapshot: { name: 'Công ty An Bình' },
  ...overrides,
});

const expectMarkup = (markup: string, pattern: RegExp, message: string) => {
  assert.ok(pattern.test(markup), message);
};

const myWorkMarkup = (markup: string) => markup.match(/<section data-testid="pgdcn-dashboard-my-work"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
const textContent = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('next-step guidance is distinct from the button that opens the dossier', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier()] });

  expectMarkup(textContent(myWorkMarkup(markup)), /Bước tiếp theo: Bổ sung hồ sơ/, 'The projected business step should be visible as guidance.');
  expectMarkup(textContent(myWorkMarkup(markup)), /Mở hồ sơ · Bổ sung hồ sơ/, 'The primary button should describe opening the dossier and its destination context.');
  expectMarkup(markup, /aria-describedby="pgdcn-action-hint-PCN-pcn-1"/, 'Assistive technology should receive a description that the button opens the dossier.');
  expectMarkup(markup, /Chọn để mở hồ sơ và thực hiện bước tiếp theo: Bổ sung hồ sơ\./, 'The accessible description should name the navigation behavior.');
});

test('overdue work shows a textual overdue marker alongside its due date', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier()] });

  expectMarkup(textContent(myWorkMarkup(markup)), /Quá hạn · 01\/01\/2000/, 'The work row should show an overdue text label beside the due date.');
});

test('unknown workflow status explains that the employee should inspect the dossier', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier({ status: 'UNRECOGNIZED_STATUS' })] });

  expectMarkup(textContent(myWorkMarkup(markup)), /Trạng thái chưa xác định\. Mở hồ sơ để kiểm tra bước phù hợp\./, 'Unknown workflow states should explain the next safe step.');
  expectMarkup(textContent(myWorkMarkup(markup)), /Tiếp tục hồ sơ/, 'Unknown workflow states should retain the projection fallback action.');
});

test('empty work state distinguishes no assigned work from dossiers waiting on another person', () => {
  const markup = renderDashboard({
    pcnDossiers: [dossier({ ownerUsername: 'mai', targetDate: undefined })],
  });

  expectMarkup(textContent(myWorkMarkup(markup)), /Hiện chưa có hồ sơ đến lượt bạn xử lý\./, 'An empty actionable queue should not imply that there are no records at all.');
  expectMarkup(textContent(myWorkMarkup(markup)), /1 hồ sơ đang chờ người khác xử lý/, 'The empty message should identify work waiting on another person.');
  expectMarkup(textContent(myWorkMarkup(markup)), /Đang chờ người khác · 1 hồ sơ/, 'Waiting work should remain available through the existing disclosure.');
});

test('dashboard work and no-scope states use clear headings and permission language', () => {
  const markup = renderDashboard({ scopes: [], pcnDossiers: [], pgdRequests: [] });

  expectMarkup(markup, /<h2[^>]*>Việc của tôi<\/h2>/, 'My work should be a real section heading.');
  expectMarkup(markup, /chưa được cấp quyền truy cập miền PCN hoặc PGD/i, 'An empty domain list should explain that no domain scope is available.');
  expectMarkup(myWorkMarkup(markup), /Bạn chưa có hồ sơ đến lượt xử lý\./, 'The empty actionable queue should explain that no work is assigned now.');
});

test('work rows remain mobile-first and keyboard reachable with accessible table headings', () => {
  const markup = renderDashboard({ pcnDossiers: [dossier(), dossier({ id: 'pcn-2', ownerUsername: 'mai' })] });

  expectMarkup(markup, /grid-cols-1[^\"]*lg:grid-cols-\[/, 'Work rows should stack at mobile widths and gain columns on wide screens.');
  expectMarkup(markup, /mobile-touch-target[^\"]*min-h-11[^\"]*w-full/, 'The primary work action should remain a full-width touch target on mobile.');
  expectMarkup(markup, /focus-visible:ring-2/, 'Keyboard users should see focus on work actions.');
  expectMarkup(markup, /<summary class="mobile-touch-target min-h-11 w-full[^\"]*focus-visible:ring-2/, 'The waiting-work disclosure should remain keyboard operable and visibly focused.');
  expectMarkup(markup, /role="row" class="sr-only lg:not-sr-only[^\"]*"[^>]*>[\s\S]*?role="columnheader"/, 'Table labels should remain available to screen readers when hidden visually on mobile.');
});
