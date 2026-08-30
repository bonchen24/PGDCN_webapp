import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildPcnHistoricalSpecFromCandidate,
  normalizePcnHistoricalBatchId,
  parsePcnHistoricalCandidateSelectors,
  resolvePcnHistoricalCandidates,
} from '../utils/pcnHistoricalSelection.ts';
import { buildPcnHistoricalSourceCandidate } from '../utils/pcnHistoricalSourceDiscovery.ts';
import { runPcnHistoricalPilot } from '../scripts/importPcnHistoricalPilot.ts';

process.env.APP_PROFILE = 'pcn';

function candidate(fieldCode: 'QC4' | 'QC9', folderName: string, sourceRelativePath: string) {
  return buildPcnHistoricalSourceCandidate({
    fieldCode,
    folderName,
    sourceRelativePath,
    files: [{
      relativePath: 'proposal.docx',
      fileName: 'proposal.docx',
      extension: '.docx',
      byteSize: 42,
      lastModifiedAt: '2026-08-28T00:00:00.000Z',
    }],
  });
}

const qc4 = candidate('QC4', '0665 ĐẠI DƯƠNG 1 nồi chiên-Full', 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới/0665 ĐẠI DƯƠNG 1 nồi chiên-Full');
const qc9 = candidate('QC9', 'IEMM 0105-01 Hà Yến TF ok', 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0105-01 Hà Yến TF ok');

test('candidate selectors normalize field and business code while rejecting malformed input', () => {
  assert.deepEqual(parsePcnHistoricalCandidateSelectors([' qc4 : 0665, QC9:0105-01 ', 'QC4:0665']), [
    { fieldCode: 'QC4', businessCode: '0665' },
    { fieldCode: 'QC9', businessCode: '0105-01' },
  ]);
  assert.throws(() => parsePcnHistoricalCandidateSelectors(['']), /FIELD:BUSINESS_CODE/i);
  assert.throws(() => parsePcnHistoricalCandidateSelectors(['0665']), /FIELD:BUSINESS_CODE/i);
  assert.throws(() => parsePcnHistoricalCandidateSelectors(['QC4:']), /FIELD:BUSINESS_CODE/i);
  assert.throws(() => parsePcnHistoricalCandidateSelectors(['QC4:0665,']), /FIELD:BUSINESS_CODE/i);
});

test('candidate resolution rejects missing and ambiguous folders and creates stable import specs', () => {
  assert.deepEqual(resolvePcnHistoricalCandidates([qc4, qc9], ['QC4:0665', 'QC9:0105-01']), [qc4, qc9]);
  assert.throws(() => resolvePcnHistoricalCandidates([qc4], ['QC9:0105-01']), /không tồn tại/i);
  const duplicate = candidate('QC4', '0665 bản sao', 'Hồ sơ chứng nhận QCVN4 2026/2026/Kết quả QCVN4 2026/0665 bản sao');
  assert.throws(() => resolvePcnHistoricalCandidates([qc4, duplicate], ['QC4:0665']), /trùng|nhiều/i);
  const spec = buildPcnHistoricalSpecFromCandidate(qc9, '2026');
  assert.deepEqual(spec, {
    fieldCode: 'QC9',
    businessCode: '0105-01',
    dossierCode: 'QC9-2026-0105-01',
    proposalCode: 'DN-QC9-2026-0105-01',
    folderName: qc9.folderName,
    sourceRelativePath: qc9.sourceRelativePath,
  });
});

test('batch id is explicit, safe, and stable across retries', () => {
  assert.equal(normalizePcnHistoricalBatchId(' pcn-history-2026-08-28-01 '), 'pcn-history-2026-08-28-01');
  assert.equal(normalizePcnHistoricalBatchId('pcn-history-2026-08-28-01'), normalizePcnHistoricalBatchId('pcn-history-2026-08-28-01'));
  assert.throws(() => normalizePcnHistoricalBatchId(''), /batchId/i);
  assert.throws(() => normalizePcnHistoricalBatchId('../unsafe'), /batchId/i);
});

test('historical import CLI selects only requested candidates and reports the stable batch', async () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-history-selection-'));
  const candidatePath = path.join(sourceRoot, 'Hồ sơ chứng nhận QCVN4 2026', 'Hồ sơ lô hàng mới', '0001 Demo 1 nồi chiên-Full');
  fs.mkdirSync(candidatePath, { recursive: true });
  fs.writeFileSync(path.join(candidatePath, 'De nghi dang ky.docx'), 'fixture');
  const output: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.map((arg) => String(arg)).join(' '));
  try {
    await runPcnHistoricalPilot([
      `--source=${sourceRoot}`,
      '--candidate=QC4:0001',
      '--batch=pcn-history-selection-test',
      '--dry-run',
    ]);
  } finally {
    console.log = originalLog;
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }
  const report = output.join('\n');
  assert.match(report, /pcn-history-selection-test/);
  assert.match(report, /"dossierCount": 1/);
  assert.match(report, /QC4-2026-0001/);
  assert.match(report, /DRY-RUN/);
});

test('historical import CLI rejects an unsafe batch id before scanning or writing', async () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-history-invalid-batch-'));
  try {
    await assert.rejects(
      () => runPcnHistoricalPilot([`--source=${sourceRoot}`, '--candidate=QC4:0001', '--batch=../unsafe', '--dry-run']),
      /batchId/i,
    );
  } finally {
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }
});

// --- End of pcn-historical-selection.test.ts ---
