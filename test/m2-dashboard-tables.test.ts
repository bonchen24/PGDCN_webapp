import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('M2: F05 - Standard 4 metric stats strip replaces 6 KPI grid while preserving test contract', () => {
  const dashboardView = read('components/PgdcnDashboardView.tsx');
  const dashboardProjection = read('utils/pgdcnDashboard.ts');

  // Projection calculates the 4 core metrics
  assert.match(dashboardProjection, /pendingWork:/);
  assert.match(dashboardProjection, /inProgress:/);
  assert.match(dashboardProjection, /awaitingApproval:/);
  assert.match(dashboardProjection, /overdue:/);

  // UI renders 4 metric cards under data-testid="pgdcn-dashboard-kpi-grid"
  assert.match(dashboardView, /data-testid="pgdcn-dashboard-kpi-grid"/);
  assert.match(dashboardView, /Việc cần làm/);
  assert.match(dashboardView, /Hồ sơ đang xử lý/);
  assert.match(dashboardView, /Chờ phê duyệt/);
  assert.match(dashboardView, /Hồ sơ quá hạn/);
});

test('M2: F06 - Actionable Dashboard Inbox answers 3 core questions with unified pill filter tabs & quickview', () => {
  const dashboardView = read('components/PgdcnDashboardView.tsx');

  // Answers 3 core questions
  assert.match(dashboardView, /Hôm nay tôi cần làm gì\?/);
  assert.match(dashboardView, /Hồ sơ nào đang chờ tôi\?/);
  assert.match(dashboardView, /Hồ sơ nào có vấn đề cần xử lý\?/);

  // Unified pill filter tabs
  assert.match(dashboardView, /data-testid="dashboard-inbox-pills"/);
  assert.match(dashboardView, /Cần làm ngay/);
  assert.match(dashboardView, /Chờ tôi/);
  assert.match(dashboardView, /Có vấn đề \/ Quá hạn/);

  // Quickview event dispatch
  assert.match(dashboardView, /dispatchEvent[\s\S]*pgdcn:quickview/);
});

test('M2: F07 - PCN workspace defaults to table view with 8-column 2-tier layout and 1-row pill filters', () => {
  const pcnWorkspace = read('components/PcnWorkspace.tsx');

  // Default viewMode = 'table'
  assert.match(pcnWorkspace, /const \[viewMode, setViewMode\] = useState<'card' \| 'table'>\('table'\)/);

  // 1-row pill filter tabs
  assert.match(pcnWorkspace, /data-testid="pcn-proposal-filters"/);
  assert.match(pcnWorkspace, /Tất cả/);
  assert.match(pcnWorkspace, /Cần xử lý/);
  assert.match(pcnWorkspace, /Đang xử lý/);
  assert.match(pcnWorkspace, /Chờ phê duyệt/);
  assert.match(pcnWorkspace, /Quá hạn/);
  assert.match(pcnWorkspace, /QC4/);
  assert.match(pcnWorkspace, /QC9/);

  // 8-column compact 2-tier table layout
  assert.match(pcnWorkspace, /<table[\s\S]*aria-label="Danh sách Đề nghị PCN"/);
  assert.match(pcnWorkspace, /<th[\s\S]*Mã hồ sơ[\s\S]*Mã Đề nghị/);
  assert.match(pcnWorkspace, /<th[\s\S]*Khách hàng/);
  assert.match(pcnWorkspace, /<th[\s\S]*Loại hồ sơ/);
  assert.match(pcnWorkspace, /<th[\s\S]*Giai đoạn/);
  assert.match(pcnWorkspace, /<th[\s\S]*Tiến độ/);
  assert.match(pcnWorkspace, /<th[\s\S]*Phụ trách/);
  assert.match(pcnWorkspace, /<th[\s\S]*Trạng thái/);
  assert.match(pcnWorkspace, /<th[\s\S]*Thao tác/);

  // Quickview drawer button on ProposalRegisterRow
  assert.match(pcnWorkspace, /dispatchEvent[\s\S]*pgdcn:quickview/);
  assert.match(pcnWorkspace, /Xử lý · Mở hồ sơ chuẩn/);
  assert.match(pcnWorkspace, /Sửa Đề nghị/);
});

test('M2: F08 - PGD workspace and queue default to responsive table view with 8-column 2-tier layout & pill filters', () => {
  const pgdQueue = read('components/PgdDossierQueueView.tsx');
  const pgdWorkspace = read('components/PgdWorkspace.tsx');

  // Defaults to table view
  assert.match(pgdQueue, /const \[viewMode, setViewMode\] = useState<'card' \| 'table'>\('table'\)/);
  assert.match(pgdWorkspace, /const \[registerViewMode, setRegisterViewMode\] = useState<'card' \| 'table'>\('table'\)/);

  // Eliminates rigid horizontal overflow (no rigid min-w-[1180px])
  assert.doesNotMatch(pgdQueue, /min-w-\[1180px\]/);
  assert.match(pgdQueue, /min-w-0/);

  // 8-column compact 2-tier table
  assert.match(pgdQueue, /<table[\s\S]*aria-label="Bảng hàng đợi hồ sơ PGD"/);
  assert.match(pgdQueue, /<th[\s\S]*Mã PYC/);
  assert.match(pgdQueue, /<th[\s\S]*Khách hàng/);
  assert.match(pgdQueue, /<th[\s\S]*Nhóm sản phẩm \/ phân loại/);
  assert.match(pgdQueue, /<th[\s\S]*Bước hiện tại \/ tiếp theo/);
  assert.match(pgdQueue, /<th[\s\S]*Tiến độ/);
  assert.match(pgdQueue, /<th[\s\S]*Chủ hồ sơ/);
  assert.match(pgdQueue, /<th scope="col" className="border-b border-slate-200 px-3 py-3">Trạng thái hồ sơ<\/th>/);
  assert.match(pgdQueue, /<th[\s\S]*Thao tác/);

  // Quick-view drawer buttons
  assert.match(pgdQueue, /dispatchEvent[\s\S]*pgdcn:quickview/);
  assert.match(pgdWorkspace, /dispatchEvent[\s\S]*pgdcn:quickview/);

  // 1-row pill filters in PgdWorkspace
  assert.match(pgdWorkspace, /data-testid="pgd-register-toolbar"/);
  assert.match(pgdWorkspace, /Tất cả/);
  assert.match(pgdWorkspace, /Cần xử lý/);
  assert.match(pgdWorkspace, /Đang xử lý/);
  assert.match(pgdWorkspace, /Chờ phê duyệt/);
  assert.match(pgdWorkspace, /Quá hạn/);
  assert.match(pgdWorkspace, /Thép\/Kim loại/);
  assert.match(pgdWorkspace, /Máy móc/);
  assert.match(pgdWorkspace, /Than đá/);
});
