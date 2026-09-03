// Author: Codex
// Description: Contract tests for the compact PCN dashboard layout

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const dashboard = workspace.slice(workspace.indexOf('function PcnDashboard'), workspace.indexOf('function EmptyState'));
const pipeline = fs.readFileSync(new URL('../components/PcnPipelineBoard.tsx', import.meta.url), 'utf8');

test('PCN dashboard expands the KPI strip across responsive desktop columns', () => {
  assert.match(dashboard, /grid-cols-2\s+gap-2\.5\s+md:grid-cols-4\s+xl:grid-cols-8\s+2xl:grid-cols-10/);
  assert.match(dashboard, /data-testid="pcn-dashboard-kpi-grid"/);
});

test('PCN dashboard exposes the additional document and archive KPI cards', () => {
  assert.match(dashboard, /label="Chờ bổ sung hồ sơ"\s+value=\{metrics\.awaitingDocuments\}/);
  assert.match(dashboard, /label="Đã lưu trữ"\s+value=\{metrics\.archived\}/);
});

test('PCN dashboard places the employee KPI and field cards in one responsive summary row', () => {
  assert.match(dashboard, /data-testid="pcn-dashboard-summary-grid"/);
  assert.match(dashboard, /data-testid="pcn-dashboard-summary-grid"[\s\S]*lg:grid-cols-\[minmax\(0,1\.2fr\)_minmax\(18rem,0\.8fr\)\]/);
  assert.match(dashboard, /data-testid="pcn-dashboard-summary-grid"[\s\S]*<PcnUserKpiTable/);
  assert.match(dashboard, /data-testid="pcn-dashboard-summary-grid"[\s\S]*data-testid="pcn-dashboard-fields"/);
});

test('PCN dossier cards stay inside the mobile width and wrap long identifiers', () => {
  assert.match(dashboard, /data-testid="pcn-dashboard-work-surface" className="min-w-0/);
  assert.match(pipeline, /<article className="min-w-0 w-full overflow-hidden/);
  assert.match(pipeline, /break-all font-mono/);
  assert.match(pipeline, /mt-3 min-w-0 w-full grid/);
});

// --- End of pcn-dashboard-layout.test.ts ---
