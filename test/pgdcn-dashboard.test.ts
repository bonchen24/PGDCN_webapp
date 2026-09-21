import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPgdcnDashboardProjection, getPgdcnMyWorkProjection, getPgdcnNextAction, getPgdcnStatusPresentation } from '../utils/pgdcnDashboard.ts';

const source = fs.readFileSync(new URL('../components/PgdcnDashboardView.tsx', import.meta.url), 'utf8');
const shellSource = fs.readFileSync(new URL('../components/PgdcnAppShell.tsx', import.meta.url), 'utf8');

test('projects scope-correct domain summaries, attention ordering and milestones', () => {
  const result = getPgdcnDashboardProjection({
    scopes: ['PCN', 'PGD'],
    pcnDossiers: [
      { id: 'pcn-overdue', dossierCode: 'HS-PCN-001', status: 'AWAITING_DOCUMENTS', targetDate: '2026-09-01' },
      { id: 'pcn-approval', dossierCode: 'HS-PCN-002', status: 'WAITING_APPROVAL', targetDate: '2026-09-10' },
      { id: 'pcn-archived', dossierCode: 'HS-PCN-003', status: 'ARCHIVED', targetDate: '2026-08-01' },
    ],
    pgdRequests: [
      { id: 'pgd-lab', requestCode: 'PYC-PGD-001', status: 'WAITING_LAB_RESULTS', inspectionScheduledAt: '2026-09-06T09:00:00+07:00' },
      { id: 'pgd-capability', requestCode: 'PYC-PGD-002', status: 'CAPABILITY_REVIEW', inspectionScheduledAt: 'not-a-date' },
    ],
    now: new Date('2026-09-03T08:00:00+07:00'),
  });

  assert.deepEqual(result.kpis, {
    pcnDossiers: 3,
    pgdRequests: 2,
    pcnWork: 2,
    pgdWork: 2,
    aiCandidates: 1,
    attention: 4,
  });
  assert.deepEqual(result.attention.map((item) => item.id), ['pcn-overdue', 'pgd-capability', 'pgd-lab', 'pcn-approval']);
  assert.equal(result.attention[0].reason, 'OVERDUE');
  assert.equal(result.attention[0].statusLabel, 'Chờ bổ sung hồ sơ');
  assert.deepEqual(result.upcoming.map((item) => item.id), ['pgd-lab', 'pcn-approval']);
  assert.equal(result.domainSummaries.find((item) => item.domain === 'PCN')?.bottleneckLabel, 'Chờ bổ sung hồ sơ');
});

test('does not expose or count an unauthorized domain', () => {
  const result = getPgdcnDashboardProjection({
    scopes: ['PCN'],
    pcnDossiers: [{ id: 'pcn-1', status: 'TECHNICAL_REVIEW' }],
    pgdRequests: [{ id: 'pgd-1', status: 'FIELD_INSPECTION' }],
  });

  assert.equal(result.kpis.pcnDossiers, 1);
  assert.equal(result.kpis.pgdRequests, 0);
  assert.deepEqual(result.domainSummaries.map((item) => item.domain), ['PCN']);
  assert.equal(result.attention.every((item) => item.domain === 'PCN'), true);
  assert.equal(result.upcoming.every((item) => item.domain === 'PCN'), true);
});

test('pipeline segments reconcile with the loaded source total including unknown statuses', () => {
  const result = getPgdcnDashboardProjection({
    scopes: ['PGD'],
    pcnDossiers: [],
    pgdRequests: [
      { id: 'pgd-1', status: 'FIELD_INSPECTION' },
      { id: 'pgd-2', status: 'ON_HOLD' },
    ],
  });
  const summary = result.domainSummaries[0];
  assert.equal(summary.total, 2);
  assert.equal(summary.segments.reduce((sum, segment) => sum + segment.count, 0), 2);
  assert.equal(summary.segments.some((segment) => segment.key === 'OTHER'), true);
});

test('shared dashboard exposes the action-first layout contract without AI or activity buttons', () => {
  assert.match(source, /data-testid="pgdcn-dashboard-my-work"/);
  assert.match(source, /data-testid="pgdcn-dashboard-kpi-grid"/);
  assert.match(source, /data-testid="pgdcn-dashboard-notifications"/);
  assert.match(source, /data-testid="pgdcn-dashboard-attention-queue"/);
  assert.match(source, /data-testid="pgdcn-dashboard-domain-cards"/);
  assert.match(source, /data-testid="pgdcn-dashboard-upcoming"/);
  assert.match(source, /Tạo Đề nghị/);
  assert.match(source, /Tạo PYC/);
  assert.doesNotMatch(source, />\s*Trợ lý AI\s*</);
  assert.doesNotMatch(source, />\s*Nhật ký hoạt động\s*</);
  assert.match(source, /onOpenPcnWorkspace/);
  assert.match(source, /onOpenPgdWorkspace/);
});

test('shared shell wires business dashboard actions to canonical workspaces', () => {
  assert.match(shellSource, /onOpenPcnWorkspace=\{openPcnWorkspace\}/);
  assert.match(shellSource, /onOpenPgdWorkspace=\{openPgdWorkspace\}/);
  assert.match(shellSource, /setActiveTarget\(\{ domain: 'PCN', section: 'proposals' \}\)/);
  assert.match(shellSource, /setActiveTarget\(\{ domain: 'PGD', section: 'requests' \}\)/);
  assert.doesNotMatch(shellSource, /onOpenAssistant=\{\(\) => navigate/);
  assert.doesNotMatch(shellSource, /onOpenActivity=\{\(\) => navigate/);
});


test('my work projection scopes assignments and maps one next action per dossier', () => {
  const result = getPgdcnMyWorkProjection({
    scopes: ['PCN', 'PGD'],
    currentUser: { username: 'linh', role: 'staff' } as any,
    pcnDossiers: [
      { id: 'pcn-mine', dossierCode: 'HS-PCN-010', status: 'WAITING_APPROVAL', ownerUsername: 'linh', targetDate: '2026-09-01', customerSnapshot: { name: 'Khách hàng A' } } as any,
      { id: 'pcn-other', dossierCode: 'HS-PCN-011', status: 'TECHNICAL_REVIEW', ownerUsername: 'mai', targetDate: '2026-09-08' } as any,
    ],
    pcnWorkflowTasks: [
      { dossierId: 'pcn-mine', nodeId: 'APPROVAL', status: 'READY', assignedUsername: 'linh', updatedAt: '2026-09-01T08:00:00Z' } as any,
    ],
    pgdRequests: [
      { id: 'pgd-mine', requestCode: 'PYC-PGD-010', status: 'FIELD_INSPECTION', ownerUsername: 'linh', inspectionScheduledAt: '2026-09-03T09:00:00Z', customerSnapshot: { name: 'Khách hàng B' }, productName: 'Sản phẩm B' } as any,
      { id: 'pgd-other', requestCode: 'PYC-PGD-011', status: 'CAPABILITY_REVIEW', ownerUsername: 'mai', inspectionScheduledAt: '2026-09-05T09:00:00Z' } as any,
    ],
    pgdAssignments: [{ requestId: 'pgd-other', leadInspectorUsername: 'mai' }],
    now: new Date('2026-09-03T08:00:00Z'),
  });

  assert.deepEqual(result.items.filter((item) => item.bucket !== 'WAITING_OTHERS').map((item) => item.id).sort(), ['pcn-mine', 'pgd-mine']);
  assert.equal(result.items.find((item) => item.id === 'pcn-mine')?.nextAction.label, 'Trình phê duyệt');
  assert.equal(result.items.find((item) => item.id === 'pgd-mine')?.nextAction.label, 'Nhập kết quả hiện trường');
  assert.equal(result.waitingOthers.some((item) => item.id === 'pcn-other'), true);
  assert.equal(result.waitingOthers.some((item) => item.id === 'pgd-other'), true);
});

test('next action mapping uses nghiệp vụ labels and required-document override', () => {
  assert.equal(getPgdcnNextAction('PCN', 'WAITING_APPROVAL').label, 'Trình phê duyệt');
  assert.equal(getPgdcnNextAction('PGD', 'LEADERSHIP_APPROVAL').label, 'Trình phê duyệt');
  assert.equal(getPgdcnNextAction('PGD', 'FIELD_INSPECTION', { missingRequiredCount: 2 }).label, 'Bổ sung hồ sơ');
});

test('semantic status presentation uses shared tones and readable labels', () => {
  assert.equal(getPgdcnStatusPresentation('PCN', 'WAITING_APPROVAL').tone, 'warning');
  assert.equal(getPgdcnStatusPresentation('PCN', 'WAITING_APPROVAL').label, 'Chờ phê duyệt');
  assert.equal(getPgdcnStatusPresentation('PGD', 'FIELD_INSPECTION').tone, 'info');
  assert.equal(getPgdcnStatusPresentation('PCN', 'ARCHIVED').tone, 'success');
  assert.equal(getPgdcnStatusPresentation('PGD', 'ON_HOLD').tone, 'neutral');
  assert.match(source, /PgdcnStatusBadge/);
});
// --- End of pgdcn-dashboard.test.ts ---
