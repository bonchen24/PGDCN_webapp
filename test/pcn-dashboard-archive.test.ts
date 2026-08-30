import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { CertificationDossier, CertificationProposal, IssuancePackage, OutboundLabRequest, ReturnedTestResult } from '../types.ts';
import { filterPcnArchive, getPcnDashboardMetrics } from '../utils/pcnReporting.ts';

const proposals: CertificationProposal[] = [{
  id: 'proposal-1', proposalCode: 'DN-001', channel: 'DIRECT', status: 'CONVERTED',
  customerSnapshot: { name: 'Công ty Alpha', address: 'Hà Nội', taxId: '010001', phone: '', email: '', contactPerson: 'A' },
  productName: 'Thiết bị 1', quantity: 1, fieldCodes: ['QC4'], receivedAt: '2026-01-02T00:00:00.000Z',
}];
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const workQueueSource = fs.readFileSync(new URL('../components/PcnWorkQueueView.tsx', import.meta.url), 'utf8');
const dossiers: CertificationDossier[] = [
  { id: 'dossier-1', dossierCode: 'HS-2026-001', proposalId: 'proposal-1', fieldCodes: ['QC4'], method: 'METHOD_1', status: 'WAITING_APPROVAL', labRequestIds: ['lab-1'], returnedResultIds: [], updatedAt: '2026-01-03T00:00:00.000Z' },
  { id: 'dossier-2', dossierCode: 'HS-2025-001', proposalId: 'proposal-1', fieldCodes: ['QC9'], method: 'METHOD_5', status: 'ARCHIVED', labRequestIds: [], returnedResultIds: [], updatedAt: '2025-03-03T00:00:00.000Z' },
];
const labRequests: OutboundLabRequest[] = [{ id: 'lab-1', pycNumber: 'PYC-001', dossierId: 'dossier-1', fieldCode: 'QC4', laboratoryName: 'PTN A', status: 'SENT', requestedAt: '2026-01-03T00:00:00.000Z' }];
const results: ReturnedTestResult[] = [];
const issuancePackages: IssuancePackage[] = [{ id: 'issue-2', dossierId: 'dossier-2', certificateTemplateCode: 'BM-QT-03-02b', decisionTemplateCode: 'BM-QĐ-03-01b', documentType: 'CERTIFICATE', status: 'ARCHIVED', fileAssetIds: [], issuanceNumber: 'GCN-PCN-2025-001' }];

test('dashboard metrics count PCN work by lifecycle instead of testing schedules', () => {
  const metrics = getPcnDashboardMetrics(dossiers, labRequests, results);
  assert.equal(metrics.totalDossiers, 2);
  assert.equal(metrics.waitingApproval, 1);
  assert.equal(metrics.waitingLab, 1);
  assert.equal(metrics.archived, 1);
  assert.equal((metrics as unknown as Record<string, unknown>).schedules, undefined);
});

test('archive searches dossier, customer, field, issuance number and year', () => {
  assert.equal(filterPcnArchive({ dossiers, proposals, issuancePackages, query: 'GCN-PCN-2025' }).length, 1);
  assert.equal(filterPcnArchive({ dossiers, proposals, issuancePackages, fieldCode: 'QC9', year: '2025' }).length, 1);
  assert.equal(filterPcnArchive({ dossiers, proposals, issuancePackages, query: 'PTN A' }).length, 0);
});

test('PCN archive UI is a document search surface without schedule concepts', () => {
  const source = fs.readFileSync(new URL('../components/PcnArchiveView.tsx', import.meta.url), 'utf8');
  assert.match(source, /Kho hồ sơ/);
  assert.match(source, /Số phát hành/);
  assert.match(source, /Lĩnh vực/);
  assert.doesNotMatch(source, /Lịch ITD|Lịch EMC|auto.?schedule/i);
});

test('PCN dashboard exposes the derived work queue and operational scopes', () => {
  assert.match(workspaceSource, /PcnWorkQueueView/);
  assert.match(workQueueSource, /Hàng đợi cần xử lý/);
  assert.match(workQueueSource, /Việc của tôi/);
  assert.match(workQueueSource, /Quá hạn/);
  assert.match(workspaceSource, /PcnWorkQueueView dossiers=\{dossiers\} proposals=\{proposals\}[^\n]*documentRequirements=\{boardRequirements\}/);
  assert.match(workspaceSource, /dossierDocuments=\{dossierDocuments\}/);
  assert.match(workQueueSource, /Mức hoàn thiện/);
  assert.doesNotMatch(workQueueSource, /saveDoc|collection_name|taskCollection/i);
});

test('PCN dashboard keeps the Kanban card as the single dossier action surface', () => {
  const dashboardSource = workspaceSource.slice(
    workspaceSource.indexOf('function PcnDashboard'),
    workspaceSource.indexOf('function EmptyState'),
  );
  assert.match(dashboardSource, /<PcnPipelineBoard/);
  assert.match(dashboardSource, /<PcnWorkQueueView/);
  assert.doesNotMatch(dashboardSource, /Hồ sơ cập nhật gần đây/);
  assert.doesNotMatch(dashboardSource, /dossiers\.slice\(0, 5\)\.map/);
});

// --- End of pcn-dashboard-archive.test.ts ---
