import assert from 'node:assert/strict';
import test from 'node:test';

import type { ActivityLog, CertificationDossier, PcnDossierAttachment } from '../types.ts';

test('historical batch summaries aggregate imported dossiers, attachments and batch activity', async () => {
  let module: typeof import('../utils/pcnHistoricalBatchView.ts') | undefined;
  try {
    module = await import('../utils/pcnHistoricalBatchView.ts');
  } catch {
    assert.fail('Thiếu bộ chọn summary batch nhập lịch sử PCN.');
  }

  const dossiers = [
    {
      id: 'dossier-qc4',
      historicalImport: {
        batchId: 'batch-01', sourceFamily: 'QC4', sourceFolderName: '0665', sourceRelativePath: 'QC4/0665',
        reviewStatus: 'PENDING_REVIEW', unresolvedFields: ['model'], importedAt: '2026-08-28T08:00:00.000Z',
      },
    },
    {
      id: 'dossier-qc9',
      historicalImport: {
        batchId: 'batch-01', sourceFamily: 'QC9', sourceFolderName: 'IEMM 0105-01', sourceRelativePath: 'QC9/IEMM 0105-01',
        reviewStatus: 'REVIEWED', unresolvedFields: [], importedAt: '2026-08-28T08:00:00.000Z',
      },
    },
    {
      id: 'dossier-other',
      historicalImport: {
        batchId: 'batch-02', sourceFamily: 'QC4', sourceFolderName: '0670', sourceRelativePath: 'QC4/0670',
        reviewStatus: 'REVIEWED', unresolvedFields: [], importedAt: '2026-08-27T08:00:00.000Z',
      },
    },
  ] as unknown as CertificationDossier[];
  const attachments = [
    { id: 'a-1', dossierId: 'dossier-qc4', byteSize: 1200 },
    { id: 'a-2', dossierId: 'dossier-qc4', byteSize: 800 },
    { id: 'a-3', dossierId: 'dossier-qc9', byteSize: 500 },
  ] as unknown as PcnDossierAttachment[];
  const logs = [
    { id: 'activity-batch-01', entityId: 'batch-01', entityType: 'SYSTEM', source: 'IMPORT', action: 'IMPORTED', createdAt: '2026-08-28T08:01:00.000Z' },
    { id: 'activity-batch-02', entityId: 'batch-02', entityType: 'SYSTEM', source: 'IMPORT', action: 'IMPORTED', createdAt: '2026-08-27T08:01:00.000Z' },
  ] as unknown as ActivityLog[];

  const summaries = module!.buildPcnHistoricalBatchSummaries(dossiers, attachments, logs);
  assert.deepEqual(summaries, [
    {
      batchId: 'batch-01', importedAt: '2026-08-28T08:01:00.000Z', sourceFamilies: ['QC4', 'QC9'],
      dossierCount: 2, attachmentCount: 3, importedBytes: 2500, pendingReviewCount: 1,
    },
    {
      batchId: 'batch-02', importedAt: '2026-08-27T08:01:00.000Z', sourceFamilies: ['QC4'],
      dossierCount: 1, attachmentCount: 0, importedBytes: 0, pendingReviewCount: 0,
    },
  ]);
});

// --- End of pcn-historical-batch-view.test.ts ---
