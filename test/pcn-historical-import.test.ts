import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_PCN_HISTORICAL_PILOT,
  buildPcnHistoricalBatchFingerprint,
  buildPcnHistoricalImportPlan,
  classifyPcnHistoricalFile,
  filterPcnHistoricalFiles,
  normalizePcnHistoricalIdempotencyPayload,
  parsePcnHistoricalFolderName,
} from '../utils/pcnHistoricalImport.ts';
import { reconcilePcnHistoricalAttachmentMapping } from '../utils/pcnHistoricalAttachmentMapping.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS } from '../utils/pcnDossierDocuments.ts';
import { assertPcnHistoricalSourceBytes } from '../utils/pcnHistoricalSourceIntegrity.ts';
import { getPcnHistoricalScopeNotice } from '../utils/pcnHistoricalScope.ts';

const importScript = fs.readFileSync(new URL('../scripts/importPcnHistoricalPilot.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> };
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const detailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');

const NOW = '2026-08-28T04:00:00.000Z';

test('historical pilot contains five QC4 and five QC9 dossiers with stable source folders', () => {
  assert.equal(DEFAULT_PCN_HISTORICAL_PILOT.length, 10);
  assert.equal(DEFAULT_PCN_HISTORICAL_PILOT.filter((item) => item.fieldCode === 'QC4').length, 5);
  assert.equal(DEFAULT_PCN_HISTORICAL_PILOT.filter((item) => item.fieldCode === 'QC9').length, 5);
  assert.equal(new Set(DEFAULT_PCN_HISTORICAL_PILOT.map((item) => item.dossierCode)).size, 10);
  assert.ok(DEFAULT_PCN_HISTORICAL_PILOT.every((item) => !item.sourceRelativePath.includes('C:\\')));
});

test('historical folder parser keeps business code and marks uncertain fields for review', () => {
  const qc4 = parsePcnHistoricalFolderName('QC4', '0665 ĐẠI DƯƠNG 1 nồi chiên-Full');
  assert.deepEqual(qc4, {
    businessCode: '0665',
    customerName: 'ĐẠI DƯƠNG',
    productName: 'nồi chiên',
    variantHint: 'Full',
    unresolvedFields: ['method'],
  });

  const qc9 = parsePcnHistoricalFolderName('QC9', 'IEMM 0105-02 Hà yến TF ok');
  assert.equal(qc9.businessCode, '0105-02');
  assert.equal(qc9.customerName, 'Hà yến');
  assert.equal(qc9.variantHint, 'TF ok');
  assert.deepEqual(qc9.unresolvedFields, ['productName', 'method']);

  const qc4Compound = parsePcnHistoricalFolderName('QC4', '0109-01 QUANG MINH 2 BẾP TỪ GIẢM');
  assert.equal(qc4Compound.businessCode, '0109-01');
  assert.equal(qc4Compound.customerName, 'QUANG MINH');
  assert.equal(qc4Compound.productName, 'BẾP TỪ');
  assert.equal(qc4Compound.variantHint, 'GIẢM');

  const qc4LetterSuffix = parsePcnHistoricalFolderName('QC4', '0433.1A Showa 1 dây điện');
  assert.equal(qc4LetterSuffix.businessCode, '0433-1A');
  assert.equal(qc4LetterSuffix.customerName, 'Showa');
  assert.equal(qc4LetterSuffix.productName, 'dây điện');

  const qc9CodeOnly = parsePcnHistoricalFolderName('QC9', 'IEMM 0115-04');
  assert.equal(qc9CodeOnly.businessCode, '0115-04');
  assert.equal(qc9CodeOnly.customerName, 'Chưa chuẩn hóa khách hàng');
  assert.deepEqual(qc9CodeOnly.unresolvedFields, ['productName', 'method']);
});

test('historical Full markers describe test scope without proving procedural completeness', () => {
  const full = getPcnHistoricalScopeNotice({ variantHint: 'Full' });
  assert.equal(full.kind, 'FULL_TEST_SCOPE');
  assert.equal(full.label, 'Full chỉ tiêu');
  assert.match(full.message, /không đồng nghĩa bộ hồ sơ đủ thủ tục/i);

  const legacy = getPcnHistoricalScopeNotice({
    sourceFamily: 'QC4',
    sourceFolderName: '0665 ĐẠI DƯƠNG 1 nồi chiên-Full',
  });
  assert.equal(legacy.kind, 'FULL_TEST_SCOPE');
  assert.equal(legacy.sourceHint, 'Full');

  const reduced = getPcnHistoricalScopeNotice({ variantHint: 'GIẢM' });
  assert.equal(reduced.kind, 'REDUCED_TEST_SCOPE');
  assert.equal(reduced.label, 'Giảm chỉ tiêu');
  assert.match(reduced.message, /không đồng nghĩa bộ hồ sơ đủ thủ tục/i);

  const unknown = getPcnHistoricalScopeNotice({ variantHint: 'TF ok' });
  assert.equal(unknown.kind, 'SOURCE_VARIANT');
  assert.equal(unknown.label, 'Nguồn ghi: TF ok');
});

test('historical idempotency payload drops undefined object fields before JSONB persistence', () => {
  assert.deepEqual(
    normalizePcnHistoricalIdempotencyPayload({
      present: 'value',
      omitted: undefined,
      nested: { keep: true, omit: undefined },
    }),
    { present: 'value', nested: { keep: true } },
  );
});

test('historical file classifier maps business documents and never treats archive/temp files as importable', () => {
  assert.equal(classifyPcnHistoricalFile('HS/De nghi CNSP theo PT7 QC4.docx'), 'PROPOSAL');
  assert.equal(classifyPcnHistoricalFile('HS/Hợp đồng A10.pdf'), 'COMMERCIAL');
  assert.equal(classifyPcnHistoricalFile('BB Hiện trường-BB lấy mẫu.doc'), 'SAMPLE_HANDOVER');
  assert.equal(classifyPcnHistoricalFile('BIÊN BẢN TRẢ MẪU/BIEN BAN TRA MAU ICONTROL.docx'), 'SAMPLE_RETURN');
  assert.equal(classifyPcnHistoricalFile('Hồ sơ/Trả mẫu khách hàng.pdf'), 'SAMPLE_RETURN');
  assert.equal(classifyPcnHistoricalFile('EMC 025-26-M01.pdf'), 'TEST_REPORT');
  assert.equal(classifyPcnHistoricalFile('CV_Khac_Phuc.doc'), 'CORRECTIVE_ACTION');
  assert.equal(classifyPcnHistoricalFile('GCN 0665.1A.docx'), 'CERTIFICATE');
  assert.equal(classifyPcnHistoricalFile('Quyet dinh 0665.1A.doc'), 'DECISION');
  assert.equal(classifyPcnHistoricalFile('ảnh/z123.jpg'), 'PHOTO');
  assert.equal(classifyPcnHistoricalFile('archive/old.rar'), 'SKIP_ARCHIVE');
  assert.equal(classifyPcnHistoricalFile('~$draft.docx'), 'SKIP_TEMP');
  assert.equal(classifyPcnHistoricalFile('Thumbs.db'), 'SKIP_TEMP');
});

test('historical file filter reports skipped files and keeps deterministic business files', () => {
  const result = filterPcnHistoricalFiles([
    { relativePath: 'GCN.docx', fileName: 'GCN.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', byteSize: 20, sha256: 'a'.repeat(64) },
    { relativePath: 'archive.zip', fileName: 'archive.zip', mimeType: 'application/zip', byteSize: 10, sha256: 'b'.repeat(64) },
    { relativePath: 'Thumbs.db', fileName: 'Thumbs.db', mimeType: 'application/octet-stream', byteSize: 5, sha256: 'c'.repeat(64) },
  ]);
  assert.equal(result.importable.length, 1);
  assert.deepEqual(result.skipped.map((item) => item.reason), ['ARCHIVE', 'TEMPORARY']);
  assert.equal(result.importable[0].kind, 'CERTIFICATE');
});

test('historical QC9 sample return files map to the sample-return checklist, not sample handover', () => {
  const plan = buildPcnHistoricalImportPlan({
    spec: DEFAULT_PCN_HISTORICAL_PILOT.find((item) => item.fieldCode === 'QC9')!,
    batchId: 'pcn-history-sample-return',
    importedAt: NOW,
    files: [
      { relativePath: 'BIÊN BẢN TRẢ MẪU/BIEN BAN TRA MAU ICONTROL.docx', fileName: 'BIEN BAN TRA MAU ICONTROL.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', byteSize: 100, sha256: '4'.repeat(64) },
    ],
  });
  const attachment = plan.attachments[0];
  assert.equal(attachment.kind, 'SAMPLE_RETURN');
  assert.equal(attachment.requirementId, 'QC9-SAMPLE_RETURN');
  assert.equal(attachment.mappingStatus, 'AUTO_MAPPED');
  assert.equal(plan.documents.find((item) => item.requirementId === 'QC9-SAMPLE_RETURN')?.status, 'PRESENT');
  assert.equal(plan.documents.find((item) => item.requirementId === 'QC9-SAMPLE_HANDOVER')?.status, 'MISSING');

  const remapped = reconcilePcnHistoricalAttachmentMapping({
    dossierId: plan.dossier.id,
    fieldCodes: ['QC9'],
    attachments: plan.attachments,
    existingDocuments: [],
    requirements: DEFAULT_PCN_DOCUMENT_REQUIREMENTS,
    now: NOW,
  });
  assert.equal(remapped.attachments[0].requirementId, 'QC9-SAMPLE_RETURN');
});

test('historical import plan creates one linked proposal/dossier and pointer-only attachments', () => {
  const spec = DEFAULT_PCN_HISTORICAL_PILOT.find((item) => item.dossierCode === 'QC4-2026-0665');
  assert.ok(spec);
  const plan = buildPcnHistoricalImportPlan({
    spec: spec!,
    batchId: 'pcn-history-pilot-2026-08-28',
    importedAt: NOW,
    files: [
      { relativePath: 'HS KÝ/De nghi CNSP theo PT7.doc', fileName: 'De nghi CNSP theo PT7.doc', mimeType: 'application/msword', byteSize: 100, sha256: '1'.repeat(64) },
      { relativePath: 'HS KÝ/Hợp đồng A10.pdf', fileName: 'Hợp đồng A10.pdf', mimeType: 'application/pdf', byteSize: 200, sha256: '2'.repeat(64) },
      { relativePath: 'ảnh/z123.jpg', fileName: 'z123.jpg', mimeType: 'image/jpeg', byteSize: 300, sha256: '3'.repeat(64) },
    ],
  });

  assert.equal(plan.proposal.dossierId, plan.dossier.id);
  assert.equal(plan.dossier.proposalId, plan.proposal.id);
  assert.equal(plan.dossier.status, 'ON_HOLD');
  assert.equal(plan.dossier.historicalImport?.variantHint, 'Full');
  assert.equal(plan.proposal.historicalImport?.variantHint, 'Full');
  assert.equal(plan.proposal.status, 'CONVERTED');
  assert.equal(plan.attachments.length, 3);
  assert.ok(plan.attachments.every((item) => item.assetId.startsWith('pcn-file-')));
  assert.ok(plan.attachments.every((item) => !('bytes' in item)));
  assert.ok(plan.documents.some((item) => item.requirementId === 'QC4-PROPOSAL' && item.status === 'PRESENT'));
  assert.ok(plan.activityLog.source === 'IMPORT');
  assert.equal(plan.activityLog.groupId, 'pcn-history-pilot-2026-08-28');

  const rerun = buildPcnHistoricalImportPlan({ spec: spec!, batchId: 'pcn-history-pilot-2026-08-28', importedAt: NOW, files: [
    { relativePath: 'HS KÝ/De nghi CNSP theo PT7.doc', fileName: 'De nghi CNSP theo PT7.doc', mimeType: 'application/msword', byteSize: 100, sha256: '1'.repeat(64) },
  ] });
  assert.equal(rerun.dossier.id, plan.dossier.id);
  const originalProposalAttachment = plan.attachments.find((item) => item.sourceRelativePath === 'HS KÝ/De nghi CNSP theo PT7.doc');
  assert.ok(originalProposalAttachment);
  assert.equal(rerun.attachments[0].id, originalProposalAttachment?.id);
  assert.equal(rerun.attachments[0].assetId, originalProposalAttachment?.assetId);
});

test('historical pilot CLI is explicit, PCN-only, dry-run first, and never watches Desktop', () => {
  assert.match(packageJson.scripts?.['import:pcn-history'] || '', /importPcnHistoricalPilot/);
  assert.match(importScript, /APP_PROFILE.*pcn/);
  assert.match(importScript, /--dry-run/);
  assert.match(importScript, /--apply/);
  assert.match(importScript, /DEFAULT_PCN_HISTORICAL_PILOT/);
  assert.match(importScript, /createReadStream|readFile/);
  assert.doesNotMatch(importScript, /watch\(|watchFile\(|chokidar/);
});

test('historical batch fingerprint ignores import timestamps but changes when source content changes', () => {
  const spec = DEFAULT_PCN_HISTORICAL_PILOT.find((item) => item.dossierCode === 'QC4-2026-0665')!;
  const files = [{
    relativePath: 'HS KÝ/GCN 0665.docx',
    fileName: 'GCN 0665.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    byteSize: 120,
    sha256: 'a'.repeat(64),
  }];
  const original = buildPcnHistoricalImportPlan({ spec, batchId: 'pcn-history-fingerprint', importedAt: NOW, files });
  const retried = buildPcnHistoricalImportPlan({ spec, batchId: 'pcn-history-fingerprint', importedAt: '2026-08-29T04:00:00.000Z', files });
  const changed = buildPcnHistoricalImportPlan({
    spec,
    batchId: 'pcn-history-fingerprint',
    importedAt: NOW,
    files: [{ ...files[0], sha256: 'b'.repeat(64) }],
  });

  assert.equal(buildPcnHistoricalBatchFingerprint([original]), buildPcnHistoricalBatchFingerprint([retried]));
  assert.notEqual(buildPcnHistoricalBatchFingerprint([original]), buildPcnHistoricalBatchFingerprint([changed]));
});

test('historical apply serializes a batch and verifies existing document payloads', () => {
  assert.match(importScript, /pg_advisory_xact_lock/);
  assert.match(importScript, /insertOrVerifyHistoricalDocument/);
  assert.match(importScript, /idempotencyFingerprint/);
  assert.match(importScript, /FOR UPDATE/);
  assert.match(importScript, /payload.*không khớp|metadata.*không khớp/i);
});

test('historical HTTP apply delegates retries to the locked apply boundary', () => {
  const routeStart = serverSource.indexOf("app.post('/api/pcn/historical/apply'");
  const routeEnd = serverSource.indexOf("app.post('/api/pcn/historical-attachment-mapping'");
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  const applyRoute = serverSource.slice(routeStart, routeEnd);
  assert.match(applyRoute, /const idempotent = await applyPcnHistoricalPlans/);
  assert.doesNotMatch(applyRoute, /sameScope/);
  assert.match(applyRoute, /status\(idempotent \? 200 : 201\)/);
});

test('historical apply verifies source bytes against the rebuilt plan', () => {
  const body = Buffer.from('pcn-source-v1');
  const expected = {
    byteSize: body.length,
    sha256: 'b'.repeat(64),
  };
  assert.throws(() => assertPcnHistoricalSourceBytes(expected, body), /SHA-256|hash/i);
  assert.throws(() => assertPcnHistoricalSourceBytes({ ...expected, sha256: 'a'.repeat(64) }, Buffer.from('pcn-source-v2')), /SHA-256|hash/i);
  const validHash = createHash('sha256').update(body).digest('hex');
  assert.doesNotThrow(() => assertPcnHistoricalSourceBytes({ byteSize: body.length, sha256: validHash }, body));
});

test('historical dossier attachments have a PCN collection boundary and are visible from dossier detail', () => {
  const pcnBlock = serverSource.slice(serverSource.indexOf('const PCN_DB_COLLECTIONS'), serverSource.indexOf('function getDbCollection'));
  assert.match(pcnBlock, /dossierAttachments/);
  assert.match(storeSource, /dossierAttachments/);
  assert.match(detailSource, /dossierAttachments/);
  assert.match(detailSource, /getPcnFileUrl/);
});

// --- End of pcn-historical-import.test.ts ---
