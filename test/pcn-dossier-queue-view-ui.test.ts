import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';
import PcnDossierQueueView from '../components/PcnDossierQueueView';

test('PCN queue filters and empty results expose accessible, mobile-ready controls', () => {
  const markup = renderToStaticMarkup(React.createElement(PcnDossierQueueView, {
    rows: [],
    onOpenDossier: () => {},
  }));
  const $ = cheerio.load(markup);
  const source = fs.readFileSync(new URL('../components/PcnDossierQueueView.tsx', import.meta.url), 'utf8');

  const search = $('[role="search"] input[type="search"]');
  assert.equal(search.length, 1, 'search stays inside a named search landmark');
  assert.ok((search.attr('class') || '').includes('min-h-11'), 'search is easy to tap');
  assert.ok((search.attr('class') || '').includes('focus-visible:ring-2'), 'search has a visible keyboard focus ring');

  const chips = $('[role="group"][aria-label="Lọc hồ sơ theo trạng thái"] button');
  assert.equal(chips.length, 7, 'the existing filter chips remain available');
  chips.each((_, button) => {
    assert.ok(['true', 'false'].includes($(button).attr('aria-pressed') || ''), 'each chip announces whether it is selected');
    assert.ok(($(button).attr('class') || '').includes('min-h-11'), 'each chip meets the mobile touch target');
    assert.ok(($(button).attr('class') || '').includes('focus-visible:ring-2'), 'each chip has visible keyboard focus');
  });
  assert.equal(chips.filter((_, button) => $(button).text().includes('Tất cả')).attr('aria-pressed'), 'true');
  assert.equal(chips.filter((_, button) => $(button).text().includes('Quy chuẩn 4')).length, 1);
  assert.equal(chips.filter((_, button) => $(button).text().includes('Quy chuẩn 9')).length, 1);
  const selectedChip = chips.filter((_, button) => $(button).text().includes('Tất cả'));
  assert.ok((selectedChip.attr('class') || '').includes('bg-slate-900'), 'the active chip is visually distinct');
  assert.ok((selectedChip.attr('class') || '').includes('ring-2'), 'the active chip has a visible outline');
  assert.ok(source.includes("result = result.filter((r) => r.fieldCodes.includes('QC4'))"));
  assert.ok(source.includes("result = result.filter((r) => r.fieldCodes.includes('QC9'))"));

  const reset = $('[data-testid="pcn-filter-reset"]');
  assert.equal(reset.length, 1, 'empty results include a reset action');
  assert.equal(reset.text().trim(), 'Xóa tìm kiếm và bộ lọc');
  assert.ok((reset.attr('class') || '').includes('min-h-11'), 'the reset action meets the mobile touch target');
  assert.match(source, /const resetFilters = \(\) => \{[\s\S]*?setQuery\(''\)[\s\S]*?setActiveChip\('ALL'\)/);

  assert.ok(/className="flex min-w-0 max-w-full flex-col items-stretch[^"]*sm:flex-row sm:flex-wrap/.test(source), 'the toolbar wraps instead of clipping on narrow screens');
  assert.match(source, /data-testid="pcn-dossier-table-scroll"[\s\S]*?mobile-scroll-x min-w-0 max-w-full overflow-x-auto/);
  assert.ok(/role="region"\s+aria-label="Bảng hồ sơ PCN[^"]*"\s+tabIndex=\{0\}/.test(source), 'the scroll region can receive keyboard focus');
});

test('PCN queue view enforces table-only display and table data contains sample info', () => {
  const row = {
    dossierId: 'pcn-compact-1',
    dossierCode: 'HS-PCN-COMPACT-001',
    registrationCode: 'DN-PCN-COMPACT-001',
    customerName: 'Công ty Kiểm định Thiết bị Công nghiệp',
    sampleQuantity: 3,
    sampleLocations: [],
    productName: 'Thiết bị đo công suất',
    model: 'M-3',
    standardRefs: [],
    fieldCodes: ['QC4'],
    reportNumbers: [],
    testCriteria: [],
    labStatuses: [],
    dossierStatus: 'TESTING',
    stationKey: 'TESTING',
    stationTitle: 'Thử nghiệm tại phòng',
    stationActionLabel: 'Theo dõi KQTN',
    completenessScore: 60,
    requiredDocumentTotal: 5,
    requiredDocumentPresent: 3,
    missingRequiredCount: 2,
    stationDocumentTotal: 5,
    stationDocumentPresent: 3,
    missingRequiredByStage: [],
    stationMissingLabels: [],
  };
  const markup = renderToStaticMarkup(React.createElement(PcnDossierQueueView, {
    rows: [row as never],
    onOpenDossier: () => {},
  }));
  const $ = cheerio.load(markup);
  const switcher = $('[role="group"][aria-label="Chế độ hiển thị hồ sơ"]');
  assert.equal(switcher.length, 0, 'card switcher is removed in table-only design');

  const tableScroll = $('[data-testid="pcn-dossier-table-scroll"]');
  assert.equal(tableScroll.length, 1, 'table view is always rendered');
  assert.match(tableScroll.text(), /HS-PCN-COMPACT-001/);
  assert.match(tableScroll.text(), /Thiết bị đo công suất/);
});

test('PCN queue owner cell uses the confirmed PCN assignment control for managers and stays read-only for staff and viewers', () => {
  const manager = {
    username: 'pcn-manager', name: 'Quản lý PCN', role: 'admin', systemRole: 'admin',
    departmentRoleCode: 'PCN_MANAGER', departmentScopes: ['PCN'], fieldCodes: ['QC4'], active: true,
  };
  const staff = {
    username: 'pcn-staff', name: 'Nhân viên PCN', role: 'staff', systemRole: 'staff',
    departmentRoleCode: 'PCN_TECHNICAL', departmentScopes: ['PCN'], fieldCodes: ['QC4'], active: true,
  };
  const viewer = {
    username: 'pcn-viewer', name: 'Viewer PCN', role: 'viewer', systemRole: 'viewer',
    departmentRoleCode: 'PCN_VIEWER', departmentScopes: ['PCN'], fieldCodes: ['QC4'], active: true,
  };
  const users = [staff, { ...staff, username: 'wrong-field', name: 'Sai lĩnh vực', fieldCodes: ['QC9'] }, { ...staff, username: 'inactive', active: false }];
  const row = {
    dossierId: 'pcn-assignment-1',
    dossierCode: 'HS-PCN-ASSIGN-001',
    registrationCode: 'PCN-ASSIGN-001',
    customerName: 'Công ty PCN',
    sampleQuantity: 1,
    sampleLocations: [],
    productName: 'Sản phẩm PCN',
    model: 'M-1',
    standardRefs: [],
    fieldCodes: ['QC4'],
    reportNumbers: [],
    testCriteria: [],
    labStatuses: [],
    dossierStatus: 'INTAKE_REVIEW',
    stationKey: 'INTAKE',
    stationTitle: 'Tiếp nhận Đề nghị',
    stationActionLabel: 'Kiểm tra Đề nghị',
    completenessScore: 60,
    requiredDocumentTotal: 1,
    requiredDocumentPresent: 0,
    missingRequiredCount: 1,
    stationDocumentTotal: 1,
    stationDocumentPresent: 0,
    missingRequiredByStage: [],
    stationMissingLabels: [],
    ownerUsername: '',
  };
  const renderFor = (currentUser: typeof manager | typeof staff | typeof viewer, ownerUsername = '') => {
    return renderToStaticMarkup(React.createElement(PcnDossierQueueView, {
      rows: [{ ...row, ownerUsername } as never],
      onOpenDossier: () => {},
      users: users as any,
      currentUser: currentUser as any,
      onAssignDossier: async () => undefined,
    }));
  };

  const unassigned = renderFor(manager);
  assert.match(unassigned, /data-testid="pcn-dossier-assignment-control"/);
  assert.match(unassigned, /Phân công người thực hiện/);
  assert.match(unassigned, /Chưa gán người thực hiện/);

  const assigned = renderFor(manager, 'pcn-staff');
  assert.match(assigned, /Nhân viên PCN/);
  assert.match(assigned, /Chuyển người thực hiện/);

  for (const currentUser of [staff, viewer]) {
    const markup = renderFor(currentUser, '');
    assert.doesNotMatch(markup, /Phân công người thực hiện|Chuyển người thực hiện/);
    assert.match(markup, /Chưa gán người thực hiện/);
  }
});

test('PCN page passes its PCN users, actor, and existing dossier update mutation to the queue', () => {
  const source = fs.readFileSync(new URL('../app/(workspace)/pcn/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /<PcnDossierQueueView[\s\S]{0,350}users=\{pcn\.users\}[\s\S]{0,100}currentUser=\{currentUser\}/);
  assert.match(source, /onAssignDossier=\{\(dossierId, ownerUsername\) => pcn\.updateDossier\(dossierId, \{ ownerUsername \}\)\}/);
});
