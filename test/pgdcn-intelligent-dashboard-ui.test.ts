import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnDashboardView from '../components/PgdcnDashboardView';

const dashboardProps = (overrides: Record<string, unknown> = {}) => ({
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
} as never);

const renderDashboard = (overrides: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(PgdcnDashboardView, dashboardProps(overrides)));

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
const renderedHostElements = (node: unknown, tagName: string): Array<{ type: unknown; props: Record<string, unknown> }> => {
  if (Array.isArray(node)) return node.flatMap((child) => renderedHostElements(child, tagName));
  if (!node || typeof node !== 'object' || !('type' in node)) return [];
  const element = node as { type: unknown; props: Record<string, unknown> };
  if (typeof element.type === 'function') {
    return renderedHostElements((element.type as (props: Record<string, unknown>) => unknown)(element.props), tagName);
  }
  return [
    ...(element.type === tagName ? [element] : []),
    ...renderedHostElements(element.props.children, tagName),
  ];
};
const reactTextContent = (node: unknown): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(reactTextContent).join(' ');
  if (node && typeof node === 'object' && 'props' in node) {
    return reactTextContent((node as { props: { children?: unknown } }).props.children);
  }
  return '';
};

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

test('waiting disclosure includes every dossier and names the handler or shows the unassigned fallback', () => {
  const waitingDossiers = Array.from({ length: 9 }, (_, index) => dossier({
    id: `pcn-waiting-${index + 1}`,
    dossierCode: `HS-PCN-WAIT-${String(index + 1).padStart(3, '0')}`,
    ownerUsername: index === 8 ? undefined : 'mai',
    targetDate: undefined,
  }));
  const waitingRequests = Array.from({ length: 3 }, (_, index) => ({
    id: `pgd-waiting-${index + 1}`,
    requestCode: `PYC-PGD-WAIT-${String(index + 1).padStart(3, '0')}`,
    status: 'CAPABILITY_REVIEW',
    ownerUsername: 'mai',
  }));
  const markup = renderDashboard({ pcnDossiers: waitingDossiers, pgdRequests: waitingRequests });
  const waitingMarkup = myWorkMarkup(markup);
  const waitingText = textContent(waitingMarkup);

  for (let index = 1; index <= waitingDossiers.length; index += 1) {
    expectMarkup(waitingText, new RegExp(`HS-PCN-WAIT-${String(index).padStart(3, '0')}`), `Waiting dossier ${index} should remain visible beyond the first six.`);
  }
  for (let index = 1; index <= waitingRequests.length; index += 1) {
    expectMarkup(waitingText, new RegExp(`PYC-PGD-WAIT-${String(index).padStart(3, '0')}`), `Waiting request ${index} should remain visible beyond the first six across domains.`);
  }
  expectMarkup(waitingText, /Chờ bổ sung hồ sơ/, 'Each waiting dossier should retain its current workflow status.');
  expectMarkup(waitingText, /Người xử lý: mai/, 'The existing assigned username should be identified as the handler.');
  expectMarkup(waitingText, /Người xử lý: Chưa phân công/, 'Missing assignment data should use the explicit unassigned fallback.');
  expectMarkup(waitingMarkup, /<summary class="mobile-touch-target min-h-11[^\"]*">Xem thêm 6 hồ sơ<\/summary>/, 'The disclosure should reveal additional dossiers through a compact, keyboard-operable show-more control.');
  expectMarkup(waitingMarkup, /<button type="button"[^>]*mobile-touch-target min-h-11[^>]*focus-visible:ring-2/, 'Waiting dossiers should remain keyboard-focusable buttons with a full touch target.');
});

test('waiting dossier actions open the matching PCN or PGD record', () => {
  const openedPcn: string[] = [];
  const openedPgd: string[] = [];
  const component = PgdcnDashboardView as unknown as (props: Record<string, unknown>) => unknown;
  const tree = component(dashboardProps({
    pcnDossiers: [dossier({ id: 'pcn-wait-callback', dossierCode: 'HS-PCN-WAIT-CALLBACK', ownerUsername: 'mai', targetDate: undefined })],
    pgdRequests: [{ id: 'pgd-wait-callback', requestCode: 'PYC-PGD-WAIT-CALLBACK', status: 'CAPABILITY_REVIEW', ownerUsername: 'mai' }],
    onOpenPcn: (id: string) => openedPcn.push(id),
    onOpenPgd: (id: string) => openedPgd.push(id),
  }));
  const waitingButtons = renderedHostElements(tree, 'button');
  const pcnButton = waitingButtons.find((button) => reactTextContent(button.props.children).includes('HS-PCN-WAIT-CALLBACK'));
  const pgdButton = waitingButtons.find((button) => reactTextContent(button.props.children).includes('PYC-PGD-WAIT-CALLBACK'));

  assert.ok(pcnButton, 'The PCN waiting record should render as an action button.');
  assert.ok(pgdButton, 'The PGD waiting record should render as an action button.');
  (pcnButton.props.onClick as () => void)();
  (pgdButton.props.onClick as () => void)();
  assert.deepEqual(openedPcn, ['pcn-wait-callback']);
  assert.deepEqual(openedPgd, ['pgd-wait-callback']);
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
  expectMarkup(markup, /role="row" class="grid min-w-0 grid-cols-1[^\"]*py-2[^\"]*lg:grid-cols-\[[^\]]+\][^\"]*lg:py-1\.5/, 'Work rows should keep complete mobile content while using compact vertical spacing at both breakpoints.');
});
