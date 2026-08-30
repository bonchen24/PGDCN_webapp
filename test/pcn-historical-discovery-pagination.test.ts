import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterPcnHistoricalCandidates,
  getPcnHistoricalCandidateKey,
  paginatePcnHistoricalCandidates,
} from '../utils/pcnHistoricalDiscoveryView.ts';
import type { PcnHistoricalSourceCandidate } from '../utils/pcnHistoricalSourceDiscovery.ts';

function candidate(overrides: Partial<PcnHistoricalSourceCandidate>): PcnHistoricalSourceCandidate {
  return {
    fieldCode: 'QC4',
    sourceRelativePath: 'Hồ sơ/0665 Demo',
    folderName: '0665 Demo 1 nồi chiên',
    businessCode: '0665',
    customerName: 'Công ty Ánh Dương',
    productName: 'Nồi chiên',
    unresolvedFields: [],
    fileCount: 2,
    totalBytes: 100,
    byExtension: { '.pdf': 2 },
    sampleFileNames: ['GCN.pdf'],
    ...overrides,
  };
}

test('historical candidate filtering searches stable key, Vietnamese text and provenance path', () => {
  const candidates = [
    candidate({ businessCode: '0665', sourceRelativePath: 'Hồ sơ/0665 Demo' }),
    candidate({ businessCode: '0109-01', folderName: '0109-01 QUANG MINH 2 BẾP TỪ', customerName: 'Quang Minh', sourceRelativePath: 'Kết quả/0109-01' }),
    candidate({ fieldCode: 'QC9', businessCode: '0115-04', folderName: 'IEMM 0115-04', customerName: 'Chưa chuẩn hóa khách hàng', sourceRelativePath: 'QC9/IEMM 0115-04' }),
  ];

  assert.deepEqual(filterPcnHistoricalCandidates(candidates, 'quang minh').map(getPcnHistoricalCandidateKey), ['QC4:0109-01']);
  assert.deepEqual(filterPcnHistoricalCandidates(candidates, '0115-04').map(getPcnHistoricalCandidateKey), ['QC9:0115-04']);
  assert.deepEqual(filterPcnHistoricalCandidates(candidates, 'ket qua').map(getPcnHistoricalCandidateKey), ['QC4:0109-01']);
  assert.equal(filterPcnHistoricalCandidates(candidates, '').length, 3);
});

test('historical candidate pagination is bounded and keeps deterministic page metadata', () => {
  const candidates = Array.from({ length: 205 }, (_, index) => candidate({
    businessCode: String(index + 1).padStart(4, '0'),
    sourceRelativePath: `Hồ sơ/${index + 1}`,
  }));

  const first = paginatePcnHistoricalCandidates(candidates, 1, 100);
  const third = paginatePcnHistoricalCandidates(candidates, 3, 100);
  const outOfRange = paginatePcnHistoricalCandidates(candidates, 99, 100);
  assert.deepEqual(first, { items: candidates.slice(0, 100), page: 1, pageCount: 3, total: 205, pageSize: 100 });
  assert.equal(third.items.length, 5);
  assert.equal(third.page, 3);
  assert.equal(outOfRange.page, 3);
  assert.equal(outOfRange.items[0].businessCode, '0201');
  assert.throws(() => paginatePcnHistoricalCandidates(candidates, 1, 0), /pageSize/i);
});

// --- End of pcn-historical-discovery-pagination.test.ts ---
