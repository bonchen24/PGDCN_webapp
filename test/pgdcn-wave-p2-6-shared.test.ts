import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnCustomersView, {
  filterCustomersBySearch,
  filterPgdCustomers,
  PgdCustomerSearchProjection,
} from '../components/PgdcnCustomersView';
import PgdcnAssistantView, {
  countCompletedPgdAssistantCriteria,
} from '../components/PgdcnAssistantView';
import PgdcnSystemSettingsView from '../components/PgdcnSystemSettingsView';
import { PgdcnStatusBadge, PgdcnStatePanel } from '../components/PgdcnUiPrimitives';
import { PGD_ASSISTANT_CRITERION_DEFINITIONS, PGD_ASSISTANT_CRITERION_ORDER } from '../utils/pgdAssistant';
import type { CustomerRef, PcnUserAccount } from '../types';

test('Wave P2-6: Semantic design tokens in index.css adhere to Superneat visual contract', () => {
  const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const primitives = fs.readFileSync(new URL('../components/PgdcnUiPrimitives.tsx', import.meta.url), 'utf8');

  // Neutral surfaces, borders, radius, shadow
  assert.ok(css.includes('--pcn-surface:'), 'Must define --pcn-surface');
  assert.ok(css.includes('--pcn-border:'), 'Must define --pcn-border');
  assert.ok(css.includes('--pcn-radius:'), 'Must define --pcn-radius');
  assert.ok(css.includes('--pcn-shadow:'), 'Must define --pcn-shadow');

  // Tokens are consumed by the shared component layer, not left as unused variables.
  assert.match(css, /\.pgdcn-semantic-surface\s*\{[^}]*var\(--pcn-surface\)[^}]*var\(--pcn-border\)[^}]*var\(--pcn-radius-lg\)[^}]*var\(--pcn-shadow\)/s);
  assert.ok(primitives.includes('pgdcn-semantic-surface'), 'Shared surface primitives must use the semantic surface class');

  // Distinct domain colors
  assert.ok(css.includes('--domain-pcn:') || css.includes('#059669'), 'Must define PCN domain emerald color');
  assert.ok(css.includes('--domain-pgd:') || css.includes('#2563eb'), 'Must define PGD domain blue color');

  // Accessibility: focus-visible and reduced-motion
  assert.ok(css.includes(':focus-visible'), 'Must define accessible focus-visible');
  assert.ok(css.includes('prefers-reduced-motion'), 'Must support prefers-reduced-motion');
});

test('Wave P2-6: PgdcnUiPrimitives provides accessible status badges and unified state panels', () => {
  // Status badge always renders accompanying text, never color alone
  const badgeMarkup = renderToStaticMarkup(
    React.createElement(PgdcnStatusBadge, {
      label: 'Đang xử lý',
      tone: 'info',
    })
  );
  const $b = cheerio.load(badgeMarkup);
  assert.equal($b('[data-status-tone="info"]').text().trim(), 'Đang xử lý');

  // State panel supports loading, empty, error, success
  const states: Array<'loading' | 'empty' | 'error' | 'success'> = ['loading', 'empty', 'error', 'success'];
  for (const st of states) {
    const panelMarkup = renderToStaticMarkup(
      React.createElement(PgdcnStatePanel, {
        tone: st,
        title: `Tiêu đề ${st}`,
        description: `Mô tả ${st}`,
      })
    );
    const $p = cheerio.load(panelMarkup);
    assert.ok($p('section').length > 0, `Section element for state ${st}`);
    assert.match($p('h2').text(), new RegExp(`Tiêu đề ${st}`));
    if (st === 'error') {
      assert.equal($p('section').attr('role'), 'alert');
    } else if (st === 'loading') {
      assert.equal($p('section').attr('role'), 'status');
    }
  }
});

test('Wave P2-6: Customer view preserves RBAC, Excel import/export contracts, and compact grid layout', () => {
  const pcnViewSource = fs.readFileSync(new URL('../components/PcnCustomersManagementView.tsx', import.meta.url), 'utf8');
  const sharedViewSource = fs.readFileSync(new URL('../components/PgdcnCustomersView.tsx', import.meta.url), 'utf8');

  // Import preview and sequential import preserved
  assert.ok(pcnViewSource.includes('prepareCustomerImportPreview'), 'Must keep Excel preview preparer');
  assert.ok(pcnViewSource.includes('executeCustomerImport'), 'Must keep sequential import executor');
  assert.ok(pcnViewSource.includes('PcnCustomerImportPreview'), 'Must keep import preview dialog');
  assert.ok(pcnViewSource.includes('PcnCustomerExportModal'), 'Must keep export modal');

  // RBAC permissions preserved: only canEditCustomers can add, edit, delete, or import
  assert.ok(pcnViewSource.includes('canEditCustomers'), 'Must enforce canEditCustomers permission');

  // Desktop table / compact grid and mobile cards
  assert.ok(pcnViewSource.includes('hidden md:table') || pcnViewSource.includes('md:table'), 'PCN desktop table layout');
  assert.ok(pcnViewSource.includes('md:hidden'), 'PCN mobile card layout');

  // Shared Customer search projection has desktop compact table and mobile cards
  assert.ok(sharedViewSource.includes('md:table') || sharedViewSource.includes('hidden md:table'), 'PGD projection desktop table layout');
  assert.ok(sharedViewSource.includes('md:hidden'), 'PGD projection mobile card layout');

  // Scopes routing: PCN users get PcnCustomersManagementView, others get search projection
  assert.ok(sharedViewSource.includes("scopes.includes('PCN')"), 'Route PCN scopes to management view');
});

test('Wave P2-6: AI Assistant preserves all 11 PGD criteria, evidence links, and safe error handling', () => {
  assert.equal(PGD_ASSISTANT_CRITERION_DEFINITIONS.length, 11, 'Must have exactly 11 PGD assistant criteria');
  assert.equal(PGD_ASSISTANT_CRITERION_ORDER.length, 11, 'Criterion order must contain all 11 criteria');

  const source = fs.readFileSync(new URL('../components/PgdcnAssistantView.tsx', import.meta.url), 'utf8');

  // Read-only disclaimers
  assert.match(source, /Chế độ chỉ đọc|Phiên chỉ đọc/);
  assert.match(source, /không phê duyệt, không đổi trạng thái/);

  // Safe error handling using classifyPcnAssistantError, no raw error dumping
  assert.ok(source.includes('classifyPcnAssistantError'), 'Must classify assistant errors safely');
  assert.doesNotMatch(source, /JSON\.stringify\(error\)/, 'Never dump raw error JSON to user');

  // Evidence opening links
  assert.ok(source.includes('openEvidence'), 'Must provide evidence viewer link');
  assert.ok(source.includes('ExternalLink'), 'Must render evidence link icon');

  // Progress counter
  assert.equal(countCompletedPgdAssistantCriteria([{ id: 'REQUEST_IDENTITY' }, { id: 'PRODUCT_PROFILE' }]), 2);
});

test('Wave P2-6: Activity log view clarifies filter controls, distinct domain colors, and state handling', () => {
  const source = fs.readFileSync(new URL('../components/ActivityLogView.tsx', import.meta.url), 'utf8');

  // Filters: domain, search, actors, action, entityType, period
  assert.ok(source.includes("updateFilter('domain'"), 'Domain filter');
  assert.ok(source.includes("updateFilter('search'"), 'Search filter');
  assert.ok(source.includes('selectedActors'), 'Actor filter');
  assert.ok(source.includes("updateFilter('action'"), 'Action filter');
  assert.ok(source.includes("updateFilter('entityType'"), 'Entity filter');
  assert.ok(source.includes("updateFilter('period'"), 'Period filter');

  // Domain distinction
  assert.ok(source.includes('PCN') && source.includes('PGD'), 'Supports both PCN and PGD domains');

  // States: loading, error, empty
  assert.ok(source.includes('isLoading'), 'Handles loading state');
  assert.ok(source.includes('role="alert"'), 'Handles error alert');
});

test('Wave P2-6: System settings restricts access strictly to authorized roles and scopes', () => {
  const source = fs.readFileSync(new URL('../components/PgdcnSystemSettingsView.tsx', import.meta.url), 'utf8');

  // Gating policies
  assert.ok(source.includes('canViewSystemSettings'), 'Check view permission');
  assert.ok(source.includes('canManageSystemUsers'), 'Check manage permission');
  assert.ok(source.includes('Tài khoản hiện tại không có quyền xem Cài đặt hệ thống.'), 'Display access denied message');

  // Test unauthorized user
  const unauthorizedUser: PcnUserAccount = {
    username: 'staff1',
    name: 'Nhân viên',
    role: 'staff',
    systemRole: 'staff',
    departmentScopes: ['PCN'],
    departmentRoleCode: 'DOCUMENT_CLERK',
    fieldCodes: [],
    active: true,
  };
  const markup = renderToStaticMarkup(
    React.createElement(PgdcnSystemSettingsView, {
      currentUser: unauthorizedUser,
      users: [],
      roles: [],
      fields: [],
      onCreate: async () => {},
      onUpdate: async () => {},
      onDelete: async () => {},
      onResetPassword: async () => {},
    })
  );
  assert.match(markup, /không có quyền xem Cài đặt hệ thống/);
});
