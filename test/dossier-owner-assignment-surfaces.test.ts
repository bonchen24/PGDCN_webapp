import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manager = {
  username: 'quanly', name: 'Quản lý PGD', role: 'staff', systemRole: 'staff',
  departmentScopes: ['PGD'], pgdRole: 'PGD_MANAGER', active: true,
};
const staff = {
  username: 'nhanvien', name: 'Nhân viên PGD', role: 'staff', systemRole: 'staff',
  departmentScopes: ['PGD'], pgdRole: 'PGD_TECHNICAL', active: true,
};
const viewer = {
  username: 'viewer', name: 'Viewer PGD', role: 'viewer', systemRole: 'viewer',
  departmentScopes: ['PGD'], pgdRole: 'PGD_MANAGER', active: true,
};
const users = [
  { username: 'dang', name: 'Đặng Ánh', role: 'staff', systemRole: 'staff', departmentScopes: ['PGD'], pgdRole: 'PGD_TECHNICAL', active: true },
  { username: 'inactive', name: 'Đã nghỉ', role: 'staff', systemRole: 'staff', departmentScopes: ['PGD'], pgdRole: 'PGD_TECHNICAL', active: false },
  { username: 'pcn-only', name: 'PCN only', role: 'staff', systemRole: 'staff', departmentScopes: ['PCN'], active: true },
  { username: 'pgd-viewer', name: 'Viewer', role: 'viewer', systemRole: 'viewer', departmentScopes: ['PGD'], pgdRole: 'PGD_VIEWER', active: true },
  { username: 'role-viewer', name: 'Role viewer', role: 'viewer', systemRole: 'staff', departmentScopes: ['PGD'], pgdRole: 'PGD_TECHNICAL', active: true },
];

const requests = Array.from({ length: 8 }, (_, index) => ({
  id: `pgd-${index + 1}`,
  domain: 'pgd',
  requestCode: `PGD-${String(index + 1).padStart(3, '0')}`,
  status: 'DRAFT',
  customerSnapshot: { name: `Khách hàng ${index + 1}`, address: 'Địa chỉ' },
  requester: { name: 'Người yêu cầu', address: 'Địa chỉ', contactPerson: 'Liên hệ', phone: '', email: '' },
  productName: `Sản phẩm ${index + 1}`,
  productGroup: 'STEEL_METAL',
  catalogItemId: 'steel',
  quantity: 1,
  inspectionScope: 'Kiểm tra',
  inspectionLocation: 'Hà Nội',
  standards: ['TCVN'],
  documentPointers: [],
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
  ownerUsername: index === 7 ? 'dang' : '',
}));

async function loadAssignmentControl() {
  assert.ok(fs.existsSync(path.join(root, 'components/PgdDossierAssignmentControl.tsx')), 'PGD assignment wrapper must be available to owner surfaces');
  return (await import('../components/PgdDossierAssignmentControl.tsx')).default;
}

function renderAssignmentControl(Control: any, currentUser: typeof manager | typeof staff | typeof viewer, ownerUsername = '') {
  return renderToStaticMarkup(createElement(Control, {
    requestId: 'pgd-1',
    ownerUsername,
    users,
    currentUser,
    onAssignOwner: async () => undefined,
    compact: true,
  }));
}

test('PGD manager gets assignment and compact transfer labels with the current owner display name', async () => {
  const Control: any = await loadAssignmentControl();
  const unassigned = renderAssignmentControl(Control, manager);
  assert.match(unassigned, />Giao hồ sơ</);

  const assigned = renderAssignmentControl(Control, manager, 'dang');
  assert.match(assigned, /Đặng Ánh/);
  assert.match(assigned, />Đổi người</);

  const globalAdmin = renderAssignmentControl(Control, { ...manager, role: 'admin', systemRole: 'admin', departmentScopes: [] });
  assert.match(globalAdmin, />Giao hồ sơ</);
});

test('staff, PGD viewers, and out-of-scope PGD managers do not get owner actions', async () => {
  const Control = await loadAssignmentControl();
  for (const user of [staff, viewer, { ...manager, departmentScopes: ['PCN'] }]) {
    const markup = renderAssignmentControl(Control, user as typeof manager);
    assert.doesNotMatch(markup, />Giao hồ sơ</);
    assert.doesNotMatch(markup, />Đổi người</);
  }
});

test('assignment control does not offer an action when the owner mutation callback is unavailable', async () => {
  const Control: any = await loadAssignmentControl();
  const markup = renderToStaticMarkup(createElement(Control, {
    requestId: 'pgd-1', ownerUsername: '', users, currentUser: manager, compact: true,
  }));
  assert.doesNotMatch(markup, />Giao hồ sơ</);
});

test('PGD assignment candidates include only active PGD-scoped non-viewer employees', async () => {
  const module = await import('../components/PgdDossierAssignmentControl.tsx') as any;
  const candidates = module.getPgdOwnerAssignmentCandidates(users);
  assert.deepEqual(candidates.map((candidate: { username: string; displayName: string }) => [candidate.username, candidate.displayName]), [
    ['dang', 'Đặng Ánh'],
  ]);
});

test('PGD system managers can load PGD data without an explicit scope while PGD role managers require it', async () => {
  const { canLoadPgdDataForUser } = await import('../components/PgdcnAppShell.tsx') as any;
  const globalAdmin = { ...manager, role: 'admin', systemRole: 'admin', departmentScopes: [] };
  assert.equal(canLoadPgdDataForUser(globalAdmin), true);
  assert.equal(canLoadPgdDataForUser(manager), true);
  assert.equal(canLoadPgdDataForUser({ ...manager, departmentScopes: [] }), false);
  assert.equal(canLoadPgdDataForUser(viewer), true);
});

test('dashboard manager assignment list exposes every PGD dossier beyond the six-item personal waiting preview', async () => {
  const Dashboard = (await import('../components/PgdcnDashboardView.tsx')).default;
  const markup = renderToStaticMarkup(createElement(Dashboard, {
    scopes: ['PGD'], pcnDossiers: [], pgdRequests: requests, currentUser: manager,
    pgdAssignments: [], pgdUsers: users, onAssignPgdOwner: async () => undefined,
    notifications: [], onOpenPcn: () => undefined, onOpenPgd: () => undefined,
    onOpenPcnWorkspace: () => undefined, onOpenPgdWorkspace: () => undefined,
    onOpenNotifications: () => undefined, onSelectNotification: () => undefined,
  } as any));
  for (const request of requests) assert.ok(markup.includes(request.requestCode), `manager dashboard should include ${request.requestCode}`);
  assert.match(markup, /Đặng Ánh/);
  assert.match(markup, />Đổi người</);
  assert.match(markup, />Giao hồ sơ</);
  const globalAdmin = renderToStaticMarkup(createElement(Dashboard, {
    scopes: [], pcnDossiers: [], pgdRequests: requests, currentUser: { ...manager, role: 'admin', systemRole: 'admin', departmentScopes: [] },
    pgdAssignments: [], pgdUsers: users, onAssignPgdOwner: async () => undefined,
    notifications: [], onOpenPcn: () => undefined, onOpenPgd: () => undefined,
    onOpenPcnWorkspace: () => undefined, onOpenPgdWorkspace: () => undefined,
    onOpenNotifications: () => undefined, onSelectNotification: () => undefined,
  } as any));
  assert.match(globalAdmin, /data-testid="pgdcn-dashboard-owner-queue"/);
});

test('queue owner cell uses the confirmed PGD assignment control for manager and remains read-only for staff', async () => {
  const Queue = (await import('../components/PgdDossierQueueView.tsx')).default;
  const row = {
    requestId: 'pgd-1', requestCode: 'PGD-001', customerName: 'Khách hàng', productName: 'Sản phẩm',
    status: 'DRAFT', statusLabel: 'Bản nháp', currentStepNumber: 1, currentStepLabel: 'Tiếp nhận',
    requiredDocumentPresent: 0, requiredDocumentTotal: 1, missingRequiredCount: 1,
    ownerUsername: '', ownerDisplayName: '', productGroup: 'Thép', catalogLabel: 'Thép',
  };
  const render = (currentUser: typeof manager | typeof staff) => renderToStaticMarkup(createElement(Queue, {
    rows: [row], onOpenDossier: () => undefined, currentUser, users,
    onAssignOwner: async () => undefined,
  } as any));
  assert.match(render(manager), />Giao hồ sơ</);
  assert.doesNotMatch(render(staff), />Giao hồ sơ</);
});

test('summary register renders owner assignment through the grid cell renderer instead of its inline editor', async () => {
  const Summary = (await import('../components/PgdSummaryRegisterView.tsx')).default;
  const markup = renderToStaticMarkup(createElement(Summary, {
    requests: [requests[0]], assignments: [], samples: [], labRequests: [], labResults: [], reports: [], certificates: [],
    catalog: [], users, currentUsername: manager.username, currentUser: manager, canEdit: true,
    onOpenRequest: () => undefined, onUpdateRequest: async () => requests[0], onAssignOwner: async () => requests[0],
  } as any));
  assert.match(markup, />Giao hồ sơ</);
  assert.doesNotMatch(markup, /LÆ°u|Lưu thay đổi/);
});

test('PGD workspace register owner cell uses the same confirmed assignment control', async () => {
  const { PgdRegisterTable } = await import('../components/PgdWorkspace.tsx') as any;
  const render = (currentUser: typeof manager | typeof staff | typeof viewer, request = requests[0]) => renderToStaticMarkup(createElement(PgdRegisterTable, {
    requests: [request], users, catalog: [], currentUser,
    onAssignOwner: async () => request, onOpen: () => undefined,
  }));
  assert.match(render(manager), />Giao hồ sơ</);
  const assigned = render(manager, requests[7]);
  assert.match(assigned, /Đặng Ánh/);
  assert.match(assigned, />Đổi người</);
  for (const currentUser of [staff, viewer]) {
    assert.doesNotMatch(render(currentUser), />Giao hồ sơ</);
    assert.doesNotMatch(render(currentUser, requests[7]), />Đổi người</);
  }
});

test('shared summary grid renders a caller-provided owner cell while preserving ordinary cells', async () => {
  const Grid = (await import('../components/PgdcnDossierSummaryGrid.tsx')).default;
  const markup = renderToStaticMarkup(createElement(Grid, {
    domain: 'PGD',
    columns: [{ id: 'requestCode', label: 'Mã PYC' }, { id: 'ownerUsername', label: 'Chủ hồ sơ', editable: true }],
    rows: [{ id: 'pgd-1', cells: { requestCode: 'PGD-001', ownerUsername: '' }, searchText: 'PGD-001' }],
    canEdit: true,
    onOpenRow: () => undefined,
    onCommitCell: async () => undefined,
    renderCell: ({ column }: any) => column.id === 'ownerUsername' ? createElement('button', { type: 'button' }, 'Giao hồ sơ') : undefined,
  } as any));
  assert.match(markup, /<button type="button">Giao hồ sơ<\/button>/);
  assert.doesNotMatch(markup, /<td[^>]*tabindex="0"[^>]*>[^<]*<button type="button">Giao hồ sơ/);
  assert.match(markup, /PGD-001/);
});

test('PGD detail assignment status and action are rendered before the existing seven-step workflow rail', () => {
  const source = read('components/PgdWorkspace.tsx');
  const assignment = source.indexOf('data-testid="pgd-dossier-owner-assignment"');
  const workflowRail = source.indexOf('<PgdDossierFlow status={request.status}');
  assert.ok(assignment >= 0, 'detail owner status/action block should exist');
  assert.ok(workflowRail > assignment, 'owner status/action should precede the workflow rail');
  assert.equal((source.match(/PGD_DOSSIER_FLOW_STEPS/g) || []).length >= 2, true, 'the existing seven-step flow remains in place');
});
