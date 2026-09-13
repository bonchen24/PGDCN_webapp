import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnReturnedResult, markOfficialPcnResults } from '../utils/pcnResultPolicy.ts';
import { normalizePcnOcrEvidence } from '../utils/pcnOcrPolicy.ts';

const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const resultViewSource = fs.readFileSync(new URL('../components/PcnResultReturnView.tsx', import.meta.url), 'utf8');

test('builds a returned test result linked to a PYC and keeps its retry round', () => {
  const result = buildPcnReturnedResult({
    id: 'result-1',
    dossierId: 'dossier-1',
    labRequestId: 'lab-1',
    round: 2,
    outcome: 'PASS',
    receivedAt: '2026-08-27T08:00:00.000Z',
    reportNumber: 'KQ-09-002',
    notes: 'Kết quả lần 2 đạt.',
  });

  assert.equal(result.id, 'result-1');
  assert.equal(result.round, 2);
  assert.equal(result.outcome, 'PASS');
  assert.equal(result.labRequestId, 'lab-1');
  assert.equal(result.reportNumber, 'KQ-09-002');
});

test('rejects a returned result that is not linked to a dossier or PYC', () => {
  assert.throws(
    () => buildPcnReturnedResult({ id: 'result-2', dossierId: '', labRequestId: '', round: 0, outcome: 'PENDING', receivedAt: '' }),
    /hồ sơ|PYC|vòng|ngày/i,
  );
});

test('rejects an ambiguous or impossible KQTN receipt timestamp', () => {
  const base = { id: 'result-date', dossierId: 'dossier-1', labRequestId: 'lab-1', round: 1, outcome: 'PASS' as const };
  assert.throws(() => buildPcnReturnedResult({ ...base, receivedAt: '2026-02-30T08:00:00.000Z' }), /timestamp|ISO-8601|hợp lệ/i);
  assert.throws(() => buildPcnReturnedResult({ ...base, receivedAt: '2026-08-29T08:00:00' }), /timestamp|ISO-8601|UTC/i);
});

test('returned-result persistence links the result to both the PYC and dossier', () => {
  assert.match(storeSource, /submitPcnReturnedResult/);
  assert.match(storeSource, /attachPcnReturnedResultFile/);
  assert.match(storeSource, /returnedResultIds/);
  assert.match(storeSource, /returnedResultId/);
  assert.match(serverSource, /RESULT_RETURNED/);
  assert.match(serverSource, /CORRECTIVE_ACTION/);
});

test('keeps failed round one and marks round two as the official result', () => {
  const results = markOfficialPcnResults([
    buildPcnReturnedResult({ id: 'result-1', dossierId: 'dossier-1', labRequestId: 'lab-1', round: 1, outcome: 'FAIL', receivedAt: '2026-08-27T08:00:00.000Z' }),
    buildPcnReturnedResult({ id: 'result-2', dossierId: 'dossier-1', labRequestId: 'lab-1', round: 2, outcome: 'PASS', receivedAt: '2026-08-28T08:00:00.000Z' }),
  ]);
  assert.equal(results.length, 2);
  assert.equal(results.find((result) => result.round === 1)?.isOfficial, false);
  assert.equal(results.find((result) => result.round === 2)?.isOfficial, true);
});

test('preserves a sample issue as a corrective-action input', () => {
  const result = buildPcnReturnedResult({
    id: 'result-issue',
    dossierId: 'dossier-1',
    labRequestId: 'lab-1',
    round: 1,
    outcome: 'PENDING',
    receivedAt: '2026-08-27T08:00:00.000Z',
    sampleIssue: { type: 'MISMATCH', description: 'Mẫu không khớp Đề nghị', reportedAt: '2026-08-27T08:00:00.000Z' },
  });
  assert.equal(result.sampleIssue?.type, 'MISMATCH');
  assert.equal(result.sampleIssue?.description, 'Mẫu không khớp Đề nghị');
});

test('persists OCR evidence on a returned test result and lets the server stamp the confirmer', () => {
  const evidence = normalizePcnOcrEvidence({
    provider: 'PADDLEOCR',
    sourceFileName: 'bao-cao-kqtn.pdf',
    sourcePage: 2,
    confidence: 0.82,
  }, { confirmedAt: '2026-08-31T06:00:00.000Z', confirmedBy: 'tran-hoang-phuong' });
  const result = buildPcnReturnedResult({
    id: 'result-ocr',
    dossierId: 'dossier-1',
    labRequestId: 'lab-1',
    round: 1,
    outcome: 'PASS',
    receivedAt: '2026-08-31T06:00:00.000Z',
    ocrEvidence: evidence,
  });

  assert.deepEqual(result.ocrEvidence, evidence);
  assert.equal(result.ocrEvidence?.sourceFileName, 'bao-cao-kqtn.pdf');
  assert.equal(result.ocrEvidence?.confirmedBy, 'tran-hoang-phuong');
});

test('rejects OCR evidence without a supported provider or source scan name', () => {
  assert.throws(() => normalizePcnOcrEvidence({ provider: 'DISABLED', sourceFileName: 'scan.pdf', confidence: 0.8 }), /OCR|nhà cung cấp|tên file/i);
  assert.throws(() => normalizePcnOcrEvidence({ provider: 'PADDLEOCR', sourceFileName: '', confidence: 0.8 }), /OCR|file/i);
});

test('returned results expose the private PCN file attachment boundary', () => {
  assert.match(storeSource, /attachResultFile/);
  assert.match(storeSource, /sourceCollection: 'returnedResults'/);
  assert.match(storeSource, /sourceJsonPath: 'fileAssetId'/);
  assert.match(resultViewSource, /onAttachFile/);
  assert.match(resultViewSource, /type="file"/);
  assert.match(resultViewSource, /getPcnFileUrl/);
  assert.doesNotMatch(resultViewSource, /arrayBuffer\(\)|readAsDataURL/);
});

test('KQTN receipt requires the PTN scan and confirmed OCR draft before commit', () => {
  const ocrSource = fs.readFileSync(new URL('../components/PcnOcrPanel.tsx', import.meta.url), 'utf8');
  assert.match(ocrSource, /onFileSelected/);
  assert.match(ocrSource, /Xác nhận điền bản nháp/);
  assert.match(resultViewSource, /ocrConfirmed/);
  assert.match(resultViewSource, /Bản scan KQTN/);
  assert.match(resultViewSource, /KQTN đã lưu nhưng chưa gắn được tệp quét[\s\S]*return;/);
  assert.match(resultViewSource, /ocrEvidence/);
  assert.match(serverSource, /normalizePcnOcrEvidence/);
  assert.match(serverSource, /confirmedBy: actor\.username/);
});

test('PCN OCR dropzone remains keyboard accessible as well as drag-and-drop', () => {
  const ocrSource = fs.readFileSync(new URL('../components/PcnOcrPanel.tsx', import.meta.url), 'utf8');
  assert.match(ocrSource, /role="button"/);
  assert.match(ocrSource, /tabIndex=\{disabled \? -1 : 0\}/);
  assert.match(ocrSource, /event\.key === "Enter"/);
  assert.match(ocrSource, /inputRef\.current\?\.click\(\)/);
});

test('returned-result UI surfaces malformed runtime records without offering file mutation', () => {
  assert.match(resultViewSource, /getPcnDataIntegrityReport/);
  assert.match(resultViewSource, /returnedResults:\s*results/);
  assert.match(resultViewSource, /hasIntegrityIssues/);
  assert.match(resultViewSource, /Cần rà soát/);
  assert.match(resultViewSource, /!hasIntegrityIssues/);
});
