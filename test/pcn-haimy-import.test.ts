import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  buildPcnHaimyDiscoveryReport,
  buildPcnHaimyImportPlan,
} from '../utils/pcnIntegration.ts';
import { normalizePcnHaimyExportRows, parsePcnHaimyJsonText } from '../utils/pcnHaimyImportFile.ts';
import { buildPcnHaimyStagingCsv } from '../utils/pcnHaimyExport.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

test('Haimy import parser maps Vietnamese export headers without carrying arbitrary fields', () => {
  const rows = normalizePcnHaimyExportRows([{
    'Mã đăng ký bên ngoài': ' DK-001 ',
    'Tên khách hàng': 'Công ty Ánh Dương',
    'Tên sản phẩm': 'Nồi chiên',
    'Mã lĩnh vực': 'qc4',
    'Số lượng mẫu': '2',
    password: 'must-not-cross-boundary',
  }]);

  assert.deepEqual(rows[0], {
    externalRegistrationId: ' DK-001 ',
    customerName: 'Công ty Ánh Dương',
    productName: 'Nồi chiên',
    fieldCode: 'qc4',
    quantity: '2',
  });
  assert.equal('password' in rows[0], false);
});

test('Haimy JSON parser accepts a records envelope and rejects empty/invalid payloads', () => {
  assert.equal(parsePcnHaimyJsonText('\uFEFF{"records":[{"externalRegistrationId":"DK-001"}]}').length, 1);
  assert.throws(() => parsePcnHaimyJsonText('[]'), /không có bản ghi/i);
  assert.throws(() => parsePcnHaimyJsonText('{"records":{}}'), /mảng records/i);
  assert.throws(() => parsePcnHaimyJsonText('{'), /JSON.*không hợp lệ/i);
});

test('Haimy import plan marks duplicate rows and conflicting identities without overwrite', () => {
  const plan = buildPcnHaimyImportPlan({
    batchId: 'haimy-duplicate-test',
    records: [
      { externalRegistrationId: 'DK-001', customerName: 'A', productName: 'P', fieldCode: 'QC4' },
      { externalRegistrationId: 'DK-001', customerName: 'A', productName: 'P', fieldCode: 'QC4' },
      { externalRegistrationId: 'DK-001', customerName: 'B', productName: 'P', fieldCode: 'QC4' },
    ],
  });

  assert.equal(plan.items[0].status, 'CONFLICT');
  assert.equal(plan.items[1].status, 'DUPLICATE_NOOP');
  assert.equal(plan.items[2].status, 'CONFLICT');
  assert.equal(plan.upstreamActions.length, 0);
});

test('Haimy staging has a dedicated PCN route, collection and no upstream write capability', () => {
  assert.match(serverSource, /app\.post\('\/api\/pcn\/integrations\/haimy\/import'/);
  assert.match(serverSource, /'pcnHaimyStaging'/);
  assert.match(serverSource, /buildPcnHaimyImportPlan/);
  assert.match(serverSource, /source: 'IMPORT'/);
  assert.match(serverSource, /entityType: 'SYSTEM'/);
  assert.doesNotMatch(serverSource.slice(serverSource.indexOf("app.post('/api/pcn/integrations/haimy/import'"), serverSource.indexOf("app.post('/api/pcn/quality-documents'")), /fetch\([^)]*haimy|axios|upstream/i);
  assert.match(workspaceSource, /PcnHaimyImportView/);
  const viewSource = fs.readFileSync(new URL('../components/PcnHaimyImportView.tsx', import.meta.url), 'utf8');
  assert.match(viewSource, /importPcnHaimyStaging\(batchId\.trim\(\), parsedRecords\)/);
  assert.doesNotMatch(viewSource, /preview\.map\(\(item\)/);
});

test('Haimy discovery can confirm an import contract but still cannot write upstream', () => {
  const report = buildPcnHaimyDiscoveryReport({
    apiEndpoint: 'https://haimy.example.invalid/api',
    exportFormats: ['json', 'csv', 'xlsx'],
    identifiers: ['externalRegistrationId', 'externalBatchId', 'externalCertificateId'],
    retryContract: { supportsIdempotencyKey: true, duplicateResponseSemantics: 'same key returns existing record' },
    credentialConfigured: true,
  });
  assert.equal(report.status, 'CONTRACT_READY');
  assert.equal(report.canWriteUpstream, false);
});

test('Haimy staging CSV export includes only filtered review fields and escapes spreadsheet content', () => {
  const csv = buildPcnHaimyStagingCsv([{
    batchId: 'batch-01',
    sourceSystem: 'HAIMY',
    idempotencyKey: 'idem-01',
    sourcePayloadFingerprint: 'fingerprint-01',
    externalRegistrationId: 'DK-001',
    customerName: '=SUM(A1:A2)',
    productName: 'Nồi, chiên',
    fieldCode: 'QC4',
    quantity: 2,
    status: 'NEEDS_REVIEW',
    issues: [{ code: 'MISSING_FIELD_CODE', message: 'Thiếu mã\nQC.' }],
  }]);

  assert.equal(csv, '\uFEFFBatch ID,Hệ thống nguồn,Mã đăng ký ngoài,Mã lô ngoài,Mã GCN ngoài,Số đăng ký,Khách hàng,Sản phẩm,Model,Thương hiệu,Mã lĩnh vực,Số lượng,Trạng thái,Mã lỗi,Nội dung rà soát,Idempotency key,Fingerprint\r\nbatch-01,HAIMY,DK-001,,,,\'=SUM(A1:A2),"Nồi, chiên",,,QC4,2,Cần rà soát,MISSING_FIELD_CODE,Thiếu mã QC.,idem-01,fingerprint-01');
  assert.doesNotMatch(csv, /password|apiKey|rawPayload|Desktop/i);
});

// --- End of pcn-haimy-import.test.ts ---
