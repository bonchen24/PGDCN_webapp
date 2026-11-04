import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnSidebar from '../components/PgdcnSidebar';
import PgdcnQuickViewDrawer from '../components/PgdcnQuickViewDrawer';
import type { PcnUserAccount } from '../types';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

const mockUser = {
  username: 'staff1',
  name: 'Trần Văn Chuyên Viên',
  role: 'staff',
  systemRole: 'staff',
  departmentScopes: ['PCN', 'PGD'],
  professionalRoleCodes: ['CERTIFICATION_EXPERT'],
  managementRoleCode: 'NONE',
  fieldCodes: ['QC4', 'QC9'],
  active: true,
} as PcnUserAccount;

test('PgdcnSidebar organizes navigation into 4 standard functional groups', () => {
  const source = read('../components/PgdcnSidebar.tsx');

  // Verify the 4 functional groups exist as sections with standard labels
  assert.match(source, /aria-label="Công việc"/);
  assert.match(source, /aria-label="Nghiệp vụ"/);
  assert.match(source, /aria-label="Tài liệu"/);
  assert.match(source, /aria-label="Quản trị"/);

  // Group 1: Công việc
  assert.match(source, /'Tổng quan'/);
  assert.match(source, /'Việc của tôi'/);
  assert.match(source, /'Khách hàng'/);
  assert.match(source, /'Trợ lý AI'/);

  // Group 2: Nghiệp vụ (with PCN and PGD separation)
  assert.match(source, /aria-label="Chứng nhận PCN"/);
  assert.match(source, /aria-label="Giám định PGD"/);

  // Group 3: Tài liệu
  assert.match(source, /'Soạn thảo văn bản'/);
  assert.match(source, /'Hồ sơ mẫu'/);

  // Group 4: Quản trị
  assert.match(source, /'Cài đặt hệ thống'/);
  assert.match(source, /'Phân quyền RBAC'/);
  assert.match(source, /'Nhật ký hệ thống'/);

  // Render check
  const markup = renderToStaticMarkup(createElement(PgdcnSidebar, {
    currentUser: mockUser,
    activeTarget: { domain: 'department', section: 'department-dashboard' },
    collapsed: false,
    mobileOpen: false,
    onToggle: () => undefined,
    onNavigate: () => undefined,
    onCloseMobile: () => undefined,
    onLogout: () => undefined,
  }));

  assert.ok(markup.includes('Công việc'), 'Sidebar markup must include Công việc group header');
  assert.ok(markup.includes('Nghiệp vụ'), 'Sidebar markup must include Nghiệp vụ group header');
  assert.ok(markup.includes('Tài liệu'), 'Sidebar markup must include Tài liệu group header');
  assert.ok(markup.includes('Quản trị'), 'Sidebar markup must include Quản trị group header');
});

test('PgdcnAppShell integrates Breadcrumb, Quick Search trigger and QuickViewDrawer', () => {
  const source = read('../components/PgdcnAppShell.tsx');

  // Breadcrumb verification
  assert.match(source, /aria-label="Breadcrumb"/);
  assert.match(source, /breadcrumbCrumbs/);
  assert.match(source, /Trang chủ/);
  assert.match(source, /Nghiệp vụ PCN/);
  assert.match(source, /Nghiệp vụ PGD/);

  // Quick Search trigger verification
  assert.match(source, /Tìm kiếm nhanh hồ sơ, khách hàng \(Ctrl\+K\)/);
  assert.match(source, /⌘K/);

  // QuickViewDrawer wiring verification
  assert.match(source, /PgdcnQuickViewDrawer/);
  assert.match(source, /quickViewDrawer/);
  assert.match(source, /openQuickView/);
  assert.match(source, /closeQuickView/);
  assert.match(source, /pgdcn:quickview/);
});

test('PgdcnQuickViewDrawer renders accessible slide-over with summary, stages and checklist', () => {
  const drawerMarkup = renderToStaticMarkup(createElement(PgdcnQuickViewDrawer, {
    open: true,
    item: {
      dossierCode: 'HS-2026-TEST-001',
      domain: 'PCN',
      customerName: 'Công ty Cổ phần Thép Việt',
      productName: 'Thép tròn xây dựng CB400',
      dossierType: 'QC4 - Phương thức 5',
      status: 'FIELD_EVALUATION',
      statusLabel: 'Đánh giá hiện trường',
      assigneeName: 'Nguyễn Văn Đánh Giá',
      targetDate: '2026-12-31',
      stages: [
        { id: 'intake', label: 'Tiếp nhận', status: 'completed' },
        { id: 'eval', label: 'Đánh giá', status: 'active' },
        { id: 'review', label: 'Soát xét', status: 'upcoming' },
        { id: 'approval', label: 'Phê duyệt', status: 'upcoming' },
        { id: 'issuance', label: 'Cấp chứng chỉ', status: 'upcoming' },
      ],
      checklist: [
        { id: 'doc-1', label: 'Giấy đề nghị chứng nhận', required: true, status: 'APPROVED', stage: 'Tiếp nhận' },
        { id: 'doc-2', label: 'Kế hoạch đánh giá tại chỗ', required: true, status: 'CONFIRMED', stage: 'Đánh giá' },
        { id: 'doc-3', label: 'Biên bản lấy mẫu hiện trường', required: true, status: 'MISSING', stage: 'Hiện trường' },
      ],
    },
    onClose: () => undefined,
  }));

  // Dialog ARIA contracts
  assert.ok(drawerMarkup.includes('role="dialog"'), 'Must have role=dialog');
  assert.ok(drawerMarkup.includes('aria-modal="true"'), 'Must have aria-modal=true');
  assert.ok(drawerMarkup.includes('aria-labelledby="pgdcn-quickview-title"'), 'Must have aria-labelledby');
  assert.ok(drawerMarkup.includes('data-testid="pgdcn-quick-view-drawer"'), 'Must have test ID');

  // Content assertions
  assert.ok(drawerMarkup.includes('HS-2026-TEST-001'), 'Must render dossier code');
  assert.ok(drawerMarkup.includes('Công ty Cổ phần Thép Việt'), 'Must render customer name');
  assert.ok(drawerMarkup.includes('Thép tròn xây dựng CB400'), 'Must render product name');
  assert.ok(drawerMarkup.includes('Đánh giá hiện trường'), 'Must render status label');

  // Stages assertions
  assert.ok(drawerMarkup.includes('Tiếp nhận'), 'Must render stage labels');
  assert.ok(drawerMarkup.includes('Đánh giá'), 'Must render active stage');

  // Checklist assertions
  assert.ok(drawerMarkup.includes('Giấy đề nghị chứng nhận'), 'Must render document requirement title');
  assert.ok(drawerMarkup.includes('Biên bản lấy mẫu hiện trường'), 'Must render document requirement title');
  assert.ok(drawerMarkup.includes('Bắt buộc'), 'Must render required badge');
  assert.ok(drawerMarkup.includes('Đã duyệt'), 'Must render approved badge');
  assert.ok(drawerMarkup.includes('Chưa có'), 'Must render missing badge');
});
