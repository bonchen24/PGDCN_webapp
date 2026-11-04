import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnQuickViewDrawer, {
  type QuickViewDossierItem,
} from '../components/PgdcnQuickViewDrawer';
import PgdcnSidebar, {
  type PgdcnNavigationTarget,
} from '../components/PgdcnSidebar';
import type { PcnUserAccount } from '../types';

const baseMockUser = {
  username: 'staff_tester',
  name: 'Nguyễn Văn Kiểm Thử',
  role: 'staff',
  systemRole: 'staff',
  departmentRoleCode: 'STAFF',
  departmentScopes: ['PCN', 'PGD'],
  professionalRoleCodes: ['CERTIFICATION_EXPERT'],
  managementRoleCode: 'NONE',
  fieldCodes: ['QC4'],
  active: true,
} as unknown as PcnUserAccount;

test('CHALLENGE 1: PgdcnQuickViewDrawer - Full pre-built PCN payload rendering', () => {
  const pcnItem: QuickViewDossierItem = {
    id: 'dossier-pcn-01',
    dossierCode: 'PCN-2026-VAL-01',
    domain: 'PCN',
    customerName: 'Công ty Cổ phần Thép Miền Trung',
    productName: 'Thép cốt bê tông CB300-V',
    dossierType: 'QC4 - Phương thức 5',
    status: 'FIELD_EVALUATION',
    statusLabel: 'Đánh giá hiện trường',
    assigneeName: 'chuyenvien_pcn',
    targetDate: '2026-12-15',
    stages: [
      { id: 'intake', label: 'Tiếp nhận', status: 'completed' },
      { id: 'eval', label: 'Đánh giá', status: 'active' },
      { id: 'review', label: 'Soát xét', status: 'upcoming' },
      { id: 'approval', label: 'Phê duyệt', status: 'upcoming' },
      { id: 'issuance', label: 'Cấp chứng chỉ', status: 'upcoming' },
    ],
    checklist: [
      { id: 'req-01', label: 'Giấy đề nghị chứng nhận hợp quy', required: true, status: 'APPROVED', stage: 'Tiếp nhận' },
      { id: 'req-02', label: 'Biên bản kiểm tra điều kiện sản xuất', required: true, status: 'MISSING', stage: 'Đánh giá' },
      { id: 'req-03', label: 'Đơn xin miễn kiểm tra', required: false, status: 'WAIVED', stage: 'Tiếp nhận' },
    ],
  };

  const markup = renderToStaticMarkup(
    createElement(PgdcnQuickViewDrawer, {
      open: true,
      item: pcnItem,
      onClose: () => undefined,
      onOpenFullDetail: () => undefined,
    })
  );

  assert.ok(markup.includes('PCN-2026-VAL-01'), 'Must display PCN dossierCode');
  assert.ok(markup.includes('Công ty Cổ phần Thép Miền Trung'), 'Must display customerName');
  assert.ok(markup.includes('Thép cốt bê tông CB300-V'), 'Must display productName');
  assert.ok(markup.includes('Đánh giá hiện trường'), 'Must display statusLabel');
  assert.ok(markup.includes('chuyenvien_pcn'), 'Must display assigneeName');
  assert.ok(markup.includes('QC4 - Phương thức 5'), 'Must display dossierType');
  assert.ok(markup.includes('2026-12-15'), 'Must display targetDate');
  assert.ok(markup.includes('Giấy đề nghị chứng nhận hợp quy'), 'Must display checklist item 1');
  assert.ok(markup.includes('Biên bản kiểm tra điều kiện sản xuất'), 'Must display checklist item 2');
  assert.ok(markup.includes('Đã duyệt'), 'Must render APPROVED badge');
  assert.ok(markup.includes('Chưa có'), 'Must render MISSING badge');
  assert.ok(markup.includes('Được miễn'), 'Must render WAIVED badge');
  assert.ok(markup.includes('1/3 hoàn thành'), 'Must render correct completion counter');
  assert.ok(markup.includes('Mở chi tiết'), 'Must display open full detail CTA button');
});

test('CHALLENGE 2: PgdcnQuickViewDrawer - Full pre-built PGD payload rendering', () => {
  const pgdItem: QuickViewDossierItem = {
    id: 'pgd-req-01',
    dossierCode: 'PGD-2026-REQ-88',
    domain: 'PGD',
    customerName: 'Tập đoàn Than Khoáng Sản',
    productName: 'Than cám nhiệt điện 6a.1',
    dossierType: 'Than - Khoáng sản',
    status: 'FIELD_INSPECTION',
    statusLabel: 'Giám định hiện trường',
    assigneeName: 'giamdinhvien_pgd',
    stages: [
      { id: 'intake', label: 'Tiếp nhận', status: 'completed' },
      { id: 'prep', label: 'Chuẩn bị', status: 'completed' },
      { id: 'field', label: 'Hiện trường & Mẫu', status: 'active' },
      { id: 'review', label: 'Soát xét KQTN', status: 'upcoming' },
      { id: 'issuance', label: 'Phê duyệt & Cấp', status: 'upcoming' },
    ],
    checklist: [
      { id: 'pgd-doc-01', label: 'Biên bản lấy mẫu than tại cảng', required: true, status: 'CONFIRMED' },
    ],
  };

  const markup = renderToStaticMarkup(
    createElement(PgdcnQuickViewDrawer, {
      open: true,
      item: pgdItem,
      onClose: () => undefined,
      onOpenFullDetail: () => undefined,
    })
  );

  assert.ok(markup.includes('PGD-2026-REQ-88'), 'Must display PGD requestCode');
  assert.ok(markup.includes('Tập đoàn Than Khoáng Sản'), 'Must display customerName');
  assert.ok(markup.includes('Than cám nhiệt điện 6a.1'), 'Must display productName');
  assert.ok(markup.includes('Giám định hiện trường'), 'Must display statusLabel');
  assert.ok(markup.includes('giamdinhvien_pgd'), 'Must display assignee');
  assert.ok(markup.includes('Biên bản lấy mẫu than tại cảng'), 'Must display checklist document label');
  assert.ok(markup.includes('Đã xác nhận'), 'Must render CONFIRMED badge');
});

test('CHALLENGE 3: PgdcnQuickViewDrawer - Unknown or non-existent dossierCode fallback', () => {
  const markup = renderToStaticMarkup(
    createElement(PgdcnQuickViewDrawer, {
      open: true,
      dossierCode: 'NON-EXISTENT-CODE-99999',
      domain: 'PCN',
      onClose: () => undefined,
    })
  );

  assert.ok(markup.includes('NON-EXISTENT-CODE-99999'), 'Must render provided code');
  assert.ok(markup.includes('Hồ sơ chuyên ngành'), 'Must render fallback customer name');
  assert.ok(markup.includes('Đang xử lý'), 'Must render fallback status');
  assert.ok(markup.includes('Chưa có danh mục checklist tài liệu cho hồ sơ này'), 'Must render fallback empty checklist state');
});

test('CHALLENGE 4: PgdcnQuickViewDrawer - Empty / undefined dossierCode and null item resilience', () => {
  let markup = renderToStaticMarkup(
    createElement(PgdcnQuickViewDrawer, {
      open: true,
      dossierCode: undefined,
      item: null,
      onClose: () => undefined,
    })
  );
  assert.ok(markup.includes('Xem nhanh hồ sơ'), 'Must render fallback header title');
  assert.ok(markup.includes('Chưa có thông tin'), 'Must render fallback customer');

  markup = renderToStaticMarkup(
    createElement(PgdcnQuickViewDrawer, {
      open: true,
      dossierCode: '   ',
      item: undefined,
      onClose: () => undefined,
    })
  );
  assert.ok(markup.includes('Xem nhanh hồ sơ'), 'Must handle whitespace-only dossierCode');
});

test('CHALLENGE 5: PgdcnQuickViewDrawer - Extreme content and boundary resilience', () => {
  const extremeCustomerName = 'CÔNG TY TNHH '.repeat(40) + ' SIÊU DÀI TẬN CÙNG';
  const extremeProductName = 'Sản phẩm thử nghiệm '.repeat(50);
  const extremeDossierCode = 'HS-EXTREME-' + '9'.repeat(120);

  const markup = renderToStaticMarkup(
    createElement(PgdcnQuickViewDrawer, {
      open: true,
      item: {
        dossierCode: extremeDossierCode,
        domain: 'PCN',
        customerName: extremeCustomerName,
        productName: extremeProductName,
        status: 'INTAKE_REVIEW',
        statusLabel: 'Tiếp nhận hồ sơ',
        checklist: Array.from({ length: 40 }, (_, idx) => ({
          id: `doc-${idx}`,
          label: `Tài liệu kỹ thuật số ${idx} - ${'DÀI_'.repeat(15)}`,
          required: idx % 2 === 0,
          status: idx % 3 === 0 ? 'APPROVED' : idx % 3 === 1 ? 'UNKNOWN_CUSTOM_STATUS' : 'MISSING',
        })),
      },
      onClose: () => undefined,
      onOpenFullDetail: () => undefined,
    })
  );

  assert.ok(markup.includes(extremeDossierCode), 'Must contain extreme dossierCode');
  assert.ok(markup.includes('UNKNOWN_CUSTOM_STATUS'), 'Must render unmapped custom status string cleanly');
  assert.ok(markup.includes('Tài liệu kỹ thuật số 39'), 'Must render all 40 checklist items without error');
});

test('CHALLENGE 6 (EMPIRICAL BUG DETECTION): PgdcnQuickViewDrawer.tsx line 173 missing optional chaining', () => {
  // Line 173 in PgdcnQuickViewDrawer.tsx is:
  // customerName: pcnDossier.customerSnapshot?.name || proposal?.customerSnapshot.name || 'Khách hàng PCN'
  // When proposal has customerSnapshot: undefined, accessing .name crashes in JS runtime.
  const proposalWithoutSnapshot = { id: 'prop-1', productName: 'Thép' } as any;
  let crashError: string | null = null;
  try {
    const pcnDossierSnapshot: { name: string } | undefined = undefined;
    const customerName = pcnDossierSnapshot?.name || proposalWithoutSnapshot?.customerSnapshot.name || 'Khách hàng PCN';
    console.log(customerName);
  } catch (err: any) {
    crashError = err?.message || String(err);
  }

  assert.ok(
    crashError !== null && crashError.includes('Cannot read properties of undefined'),
    `Empirically confirmed: proposal?.customerSnapshot.name throws ${crashError}`
  );
});

test('CHALLENGE 7 (EMPIRICAL BUG DETECTION): PgdcnQuickViewDrawer.tsx line 141 missing null-check on fieldCodes', () => {
  // Line 141 in PgdcnQuickViewDrawer.tsx is:
  // const reqs = pcn.documentRequirements.filter((r) => pcnDossier.fieldCodes.includes(r.fieldCode));
  // If pcnDossier.fieldCodes is undefined, .includes throws TypeError.
  const dossierWithoutFieldCodes = { id: 'd-1', dossierCode: 'HS-1', fieldCodes: undefined } as any;
  let crashError: string | null = null;
  try {
    const reqs = [{ fieldCode: 'QC4' }].filter((r) => dossierWithoutFieldCodes.fieldCodes.includes(r.fieldCode));
    console.log(reqs);
  } catch (err: any) {
    crashError = err?.message || String(err);
  }

  assert.ok(
    crashError !== null && crashError.includes('Cannot read properties of undefined'),
    `Empirically confirmed: pcnDossier.fieldCodes.includes throws ${crashError}`
  );
});

test('CHALLENGE 8: PgdcnSidebar - Role-based permissions matrix', () => {
  // Case A: Regular staff (no admin, no leader, no pgdRole)
  const staffUser: PcnUserAccount = {
    ...baseMockUser,
    systemRole: 'staff',
    role: 'staff',
    managementRoleCode: 'NONE',
    pgdRole: undefined,
  };

  const staffMarkup = renderToStaticMarkup(
    createElement(PgdcnSidebar, {
      currentUser: staffUser,
      activeTarget: { domain: 'department', section: 'department-dashboard' },
      collapsed: false,
      mobileOpen: false,
      onToggle: () => undefined,
      onNavigate: () => undefined,
      onCloseMobile: () => undefined,
      onLogout: () => undefined,
    })
  );

  // Staff should NOT see Cài đặt hệ thống or Phân quyền RBAC or Hồ sơ mẫu
  assert.strictEqual(staffMarkup.includes('Cài đặt hệ thống'), false, 'Staff must NOT see Cài đặt hệ thống');
  assert.strictEqual(staffMarkup.includes('Phân quyền RBAC'), false, 'Staff must NOT see Phân quyền RBAC');
  assert.strictEqual(staffMarkup.includes('Hồ sơ mẫu'), false, 'Staff must NOT see Hồ sơ mẫu');
  // Staff MUST see Nhật ký hệ thống and Soạn thảo văn bản
  assert.ok(staffMarkup.includes('Nhật ký hệ thống'), 'Staff must see Nhật ký hệ thống');
  assert.ok(staffMarkup.includes('Soạn thảo văn bản'), 'Staff must see Soạn thảo văn bản');

  // Case B: System Admin
  const adminUser: PcnUserAccount = {
    ...baseMockUser,
    systemRole: 'admin',
    role: 'admin',
  };

  const adminMarkup = renderToStaticMarkup(
    createElement(PgdcnSidebar, {
      currentUser: adminUser,
      activeTarget: { domain: 'department', section: 'department-dashboard' },
      collapsed: false,
      mobileOpen: false,
      onToggle: () => undefined,
      onNavigate: () => undefined,
      onCloseMobile: () => undefined,
      onLogout: () => undefined,
    })
  );

  assert.ok(adminMarkup.includes('Cài đặt hệ thống'), 'Admin MUST see Cài đặt hệ thống');
  assert.ok(adminMarkup.includes('Phân quyền RBAC'), 'Admin MUST see Phân quyền RBAC');
  assert.ok(adminMarkup.includes('Hồ sơ mẫu'), 'Admin MUST see Hồ sơ mẫu');

  // Case C: PGD Manager
  const pgdManagerUser: PcnUserAccount = {
    ...baseMockUser,
    systemRole: 'staff',
    role: 'staff',
    pgdRole: 'PGD_MANAGER',
  };

  const pgdManagerMarkup = renderToStaticMarkup(
    createElement(PgdcnSidebar, {
      currentUser: pgdManagerUser,
      activeTarget: { domain: 'department', section: 'department-dashboard' },
      collapsed: false,
      mobileOpen: false,
      onToggle: () => undefined,
      onNavigate: () => undefined,
      onCloseMobile: () => undefined,
      onLogout: () => undefined,
    })
  );

  assert.ok(pgdManagerMarkup.includes('Hồ sơ mẫu'), 'PGD Manager MUST see Hồ sơ mẫu');
});

test('CHALLENGE 9: PgdcnSidebar - Department scopes isolation matrix', () => {
  // Case A: PCN only
  const pcnOnlyUser: PcnUserAccount = {
    ...baseMockUser,
    departmentScopes: ['PCN'],
  };
  const pcnOnlyMarkup = renderToStaticMarkup(
    createElement(PgdcnSidebar, {
      currentUser: pcnOnlyUser,
      activeTarget: { domain: 'department', section: 'department-dashboard' },
      collapsed: false,
      mobileOpen: false,
      onToggle: () => undefined,
      onNavigate: () => undefined,
      onCloseMobile: () => undefined,
      onLogout: () => undefined,
    })
  );
  assert.ok(pcnOnlyMarkup.includes('Chứng nhận · PCN'), 'Must show PCN section');
  assert.strictEqual(pcnOnlyMarkup.includes('Giám định · PGD'), false, 'Must NOT show PGD section for PCN-only user');

  // Case B: PGD only
  const pgdOnlyUser: PcnUserAccount = {
    ...baseMockUser,
    departmentScopes: ['PGD'],
  };
  const pgdOnlyMarkup = renderToStaticMarkup(
    createElement(PgdcnSidebar, {
      currentUser: pgdOnlyUser,
      activeTarget: { domain: 'department', section: 'department-dashboard' },
      collapsed: false,
      mobileOpen: false,
      onToggle: () => undefined,
      onNavigate: () => undefined,
      onCloseMobile: () => undefined,
      onLogout: () => undefined,
    })
  );
  assert.ok(pgdOnlyMarkup.includes('Giám định · PGD'), 'Must show PGD section');
  assert.strictEqual(pgdOnlyMarkup.includes('Chứng nhận · PCN'), false, 'Must NOT show PCN section for PGD-only user');

  // Case C: Empty scopes
  const emptyScopeUser: PcnUserAccount = {
    ...baseMockUser,
    departmentScopes: [],
  };
  const emptyScopeMarkup = renderToStaticMarkup(
    createElement(PgdcnSidebar, {
      currentUser: emptyScopeUser,
      activeTarget: { domain: 'department', section: 'department-dashboard' },
      collapsed: false,
      mobileOpen: false,
      onToggle: () => undefined,
      onNavigate: () => undefined,
      onCloseMobile: () => undefined,
      onLogout: () => undefined,
    })
  );
  assert.strictEqual(emptyScopeMarkup.includes('Chứng nhận · PCN'), false, 'Must NOT show PCN section');
  assert.strictEqual(emptyScopeMarkup.includes('Giám định · PGD'), false, 'Must NOT show PGD section');
});

test('CHALLENGE 10: PgdcnSidebar - Collapse state and MobileOpen state rendering contracts', () => {
  // Case A: Collapsed desktop (collapsed = true, mobileOpen = false)
  const collapsedMarkup = renderToStaticMarkup(
    createElement(PgdcnSidebar, {
      currentUser: baseMockUser,
      activeTarget: { domain: 'department', section: 'department-dashboard' },
      collapsed: true,
      mobileOpen: false,
      onToggle: () => undefined,
      onNavigate: () => undefined,
      onCloseMobile: () => undefined,
      onLogout: () => undefined,
    })
  );
  assert.ok(collapsedMarkup.includes('lg:w-16'), 'Collapsed sidebar must have lg:w-16');
  assert.strictEqual(collapsedMarkup.includes('pgdcn-sidebar-backdrop'), false, 'Must NOT render backdrop when mobileOpen=false');

  // Case B: Mobile Open (collapsed = true or false, mobileOpen = true)
  const mobileMarkup = renderToStaticMarkup(
    createElement(PgdcnSidebar, {
      currentUser: baseMockUser,
      activeTarget: { domain: 'department', section: 'department-dashboard' },
      collapsed: false,
      mobileOpen: true,
      onToggle: () => undefined,
      onNavigate: () => undefined,
      onCloseMobile: () => undefined,
      onLogout: () => undefined,
    })
  );
  assert.ok(mobileMarkup.includes('data-testid="pgdcn-sidebar-backdrop"'), 'Must render backdrop button when mobileOpen=true');
  assert.ok(mobileMarkup.includes('role="dialog"'), 'Must have role=dialog when mobileOpen=true');
  assert.ok(mobileMarkup.includes('aria-modal="true"'), 'Must have aria-modal=true when mobileOpen=true');
  assert.ok(mobileMarkup.includes('translate-x-0'), 'Must have translate-x-0 when mobileOpen=true');
});
