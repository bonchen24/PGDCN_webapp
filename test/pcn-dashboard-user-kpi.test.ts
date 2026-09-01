// Author: Codex
// OS support: Web/Node
// Description: Contract tests for the PCN dashboard user KPI projection

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath: string): string => fs.readFileSync(path.join(here, '..', relativePath), 'utf8');

test('PCN dashboard renders the reusable user KPI table and opens ActivityLogs', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  const kpiTablePath = path.join(here, '..', 'components', 'PcnUserKpiTable.tsx');

  assert.equal(fs.existsSync(kpiTablePath), true, 'Expected a reusable PCN user KPI table component');
  assert.match(workspace, /import \{ PcnUserKpiTable \} from '\.\/PcnUserKpiTable';/);
  assert.match(workspace, /<PcnUserKpiTable[\s\S]*onOpenActivityLogs=\{\(\) => onOpenSection\('activityLogs'\)\}/);
});

test('PCN user KPI table loads GMT+7 summaries with the current month as default', () => {
  const source = read('components/PcnUserKpiTable.tsx');

  assert.match(source, /useState<ActivityPeriod>\('MONTH'\)/);
  assert.match(source, /getActivityPeriodBounds\(activePeriod\)/);
  assert.match(source, /activityLogClient\.fetchSummary/);
  assert.match(source, /aria-label="Bảng KPI người dùng"/);
  assert.match(source, /aria-label="Mở Nhật ký hệ thống"/);
});

// --- End of pcn-dashboard-user-kpi.test.ts ---
