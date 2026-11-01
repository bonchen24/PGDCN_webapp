import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  buildPcnHistoricalSourceCoverage,
  buildPcnHistoricalSourceCandidate,
  DEFAULT_PCN_HISTORICAL_REFERENCE_ROOTS,
  sortPcnHistoricalSourceCandidates,
  type PcnHistoricalSourceFileSummary,
} from '../utils/pcnHistoricalSourceDiscovery.ts';
import { discoverPcnHistoricalFolders } from '../scripts/discoverPcnHistoricalFolders.ts';
import { getPcnHistoricalScopeNotice } from '../utils/pcnHistoricalScope.ts';

const scriptSource = fs.readFileSync(new URL('../scripts/discoverPcnHistoricalFolders.ts', import.meta.url), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { scripts?: Record<string, string> };

test('historical source coverage summarizes auxiliary PCN branches without candidate or file bytes', () => {
  const files: PcnHistoricalSourceFileSummary[] = [
    { relativePath: 'BM-QT-09-03.docx', fileName: 'BM-QT-09-03.docx', extension: '.docx', byteSize: 120, lastModifiedAt: '2026-08-20T08:00:00.000Z' },
    { relativePath: 'GCN scan.pdf', fileName: 'GCN scan.pdf', extension: '.pdf', byteSize: 80, lastModifiedAt: '2026-08-21T08:00:00.000Z' },
  ];
  const coverage = buildPcnHistoricalSourceCoverage({
    fieldCode: 'QC4',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Bản SCAN GCN 2026',
    role: 'CERTIFICATE_ARCHIVE',
    status: 'SCANNED',
    files,
  });

  assert.deepEqual(coverage, {
    fieldCode: 'QC4',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/2026/Bản SCAN GCN 2026',
    role: 'CERTIFICATE_ARCHIVE',
    status: 'SCANNED',
    fileCount: 2,
    totalBytes: 200,
    byExtension: { '.docx': 1, '.pdf': 1 },
    lastModifiedAt: '2026-08-21T08:00:00.000Z',
    sampleFileNames: ['BM-QT-09-03.docx', 'GCN scan.pdf'],
  });
  assert.equal('files' in coverage, false);
  assert.equal('bytes' in coverage, false);
  assert.equal('absolutePath' in coverage, false);
});

test('historical source coverage allowlist includes the observed QC4 and QC9 reference branches', () => {
  const roots = new Set(DEFAULT_PCN_HISTORICAL_REFERENCE_ROOTS.map((item) => `${item.fieldCode}:${item.sourceRelativePath}`));
  assert.ok(roots.has('QC4:Hồ sơ chứng nhận QCVN4 2026/2026/Bản SCAN GCN 2026'));
  assert.ok(roots.has('QC4:Hồ sơ chứng nhận QCVN4 2026/Mẫu HS Đăng ký'));
  assert.ok(roots.has('QC4:Hồ sơ chứng nhận QCVN4 2026/Tool QC4'));
  assert.ok(roots.has('QC9:Hồ sơ chứng nhận QCVN9 2026/File kết quả mẫu'));
  assert.ok(roots.has('QC9:Hồ sơ chứng nhận QCVN9 2026/mẫu pyc bên TĐC'));
  assert.ok(roots.has('QC9:Hồ sơ chứng nhận QCVN9 2026/kết quả TĐC'));
  const roleByRoot = new Map(DEFAULT_PCN_HISTORICAL_REFERENCE_ROOTS.map((item) => [`${item.fieldCode}:${item.sourceRelativePath}`, item.role]));
  assert.equal(roleByRoot.get('QC9:Hồ sơ chứng nhận QCVN9 2026/BIÊN BẢN GIAO GIẤY TỜ'), 'DOCUMENT_HANDOVER');
  assert.equal(roleByRoot.get('QC9:Hồ sơ chứng nhận QCVN9 2026/Biên bản, giấy tờ, báo giá, công văn'), 'MIXED_REFERENCE');
});

test('historical source coverage maps the remaining observed operational branches without making them candidates', () => {
  const roleByRoot = new Map(DEFAULT_PCN_HISTORICAL_REFERENCE_ROOTS.map((item) => [`${item.fieldCode}:${item.sourceRelativePath}`, item.role]));
  const expectedRoles: Array<[string, string]> = [
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/Ảnh Dây điện', 'VISUAL_EVIDENCE'],
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/Bản Lưu GCN QC4', 'CERTIFICATE_ARCHIVE'],
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/Báo giá-hợp đồng', 'COMMERCIAL'],
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/BB Danh gia', 'EVALUATION_RECORD'],
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/Công văn', 'CORRESPONDENCE'],
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/giấy phép chỉ định', 'ACCREDITATION'],
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/Note văn thư', 'ADMIN_NOTE'],
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/Thí nghiệm QC4', 'LAB_RESULT'],
    ['QC4:Hồ sơ chứng nhận QCVN4 2026/TIÊU CHUẨN QC 4', 'STANDARD_REFERENCE'],
    ['QC9:Hồ sơ chứng nhận QCVN9 2026/File mẫu hồ sơ chứng nhận', 'TEMPLATE'],
    ['QC9:Hồ sơ chứng nhận QCVN9 2026/Mẫu công văn', 'CORRESPONDENCE'],
  ];
  for (const [key, role] of expectedRoles) assert.equal(roleByRoot.get(key), role, key);
  assert.ok(DEFAULT_PCN_HISTORICAL_REFERENCE_ROOTS.every((item) => !item.sourceRelativePath.endsWith('/Kết quả QCVN4 2026') && !item.sourceRelativePath.endsWith('/KQ chứng nhận QC9-26')));
});

test('historical source candidate keeps relative provenance and summarizes files without bytes', () => {
  const files: PcnHistoricalSourceFileSummary[] = [
    { relativePath: 'GCN 01.pdf', fileName: 'GCN 01.pdf', extension: '.pdf', byteSize: 120, lastModifiedAt: '2026-08-20T08:00:00.000Z' },
    { relativePath: 'Biên bản trả mẫu.docx', fileName: 'Biên bản trả mẫu.docx', extension: '.docx', byteSize: 80, lastModifiedAt: '2026-08-21T08:00:00.000Z' },
    { relativePath: 'ảnh/mẫu.jpg', fileName: 'mẫu.jpg', extension: '.jpg', byteSize: 300, lastModifiedAt: '2026-08-19T08:00:00.000Z' },
  ];
  const candidate = buildPcnHistoricalSourceCandidate({
    fieldCode: 'QC9',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0105-02 Hà yến TF ok',
    folderName: 'IEMM 0105-02 Hà yến TF ok',
    files,
  });

  assert.deepEqual(candidate, {
    fieldCode: 'QC9',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0105-02 Hà yến TF ok',
    folderName: 'IEMM 0105-02 Hà yến TF ok',
    businessCode: '0105-02',
    customerName: 'Hà yến',
    productName: 'Chưa chuẩn hóa từ hồ sơ lịch sử',
    variantHint: 'TF ok',
    unresolvedFields: ['productName', 'method'],
    fileCount: 3,
    totalBytes: 500,
    byExtension: { '.docx': 1, '.jpg': 1, '.pdf': 1 },
    lastModifiedAt: '2026-08-21T08:00:00.000Z',
    sampleFileNames: ['Biên bản trả mẫu.docx', 'GCN 01.pdf', 'mẫu.jpg'],
  });
  assert.equal('bytes' in candidate, false);
  assert.equal('absolutePath' in candidate, false);
});

test('historical candidate scope notice stays explicit about source-only meaning', () => {
  const candidate = buildPcnHistoricalSourceCandidate({
    fieldCode: 'QC4',
    sourceRelativePath: 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới/0665 ĐẠI DƯƠNG-Full',
    folderName: '0665 ĐẠI DƯƠNG-Full',
    files: [],
  });
  const notice = getPcnHistoricalScopeNotice(candidate);
  assert.equal(notice.kind, 'FULL_TEST_SCOPE');
  assert.equal(notice.label, 'Full chỉ tiêu');
  assert.match(notice.message, /chỉ.*phạm vi thử nghiệm/i);
});

test('historical source candidates sort by field, business code, then relative path', () => {
  const makeCandidate = (fieldCode: 'QC4' | 'QC9', code: string, sourceRelativePath: string) => buildPcnHistoricalSourceCandidate({
    fieldCode,
    sourceRelativePath,
    folderName: fieldCode === 'QC4' ? `${code} Khách hàng sản phẩm` : `IEMM ${code} Khách hàng`,
    files: [],
  });
  const sorted = sortPcnHistoricalSourceCandidates([
    makeCandidate('QC9', '0002', 'qc9-b'),
    makeCandidate('QC4', '0100', 'qc4-b'),
    makeCandidate('QC4', '0002', 'qc4-a'),
  ]);
  assert.deepEqual(sorted.map((candidate) => `${candidate.fieldCode}:${candidate.businessCode}:${candidate.sourceRelativePath}`), [
    'QC4:0002:qc4-a',
    'QC4:0100:qc4-b',
    'QC9:0002:qc9-b',
  ]);
});

test('historical source discovery recognizes QC4 compound business codes from the PCN Desktop layout', () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-discovery-qc4-compound-'));
  const folder = path.join(sourceRoot, 'Hồ sơ chứng nhận QCVN4 2026', '2026', 'Kết quả QCVN4 2026', '0109-01 QUANG MINH 2 BẾP TỪ GIẢM');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'GCN 0109-01.docx'), 'fixture');
  try {
    const result = discoverPcnHistoricalFolders(sourceRoot, 'QC4');
    const candidate = result.candidates.find((item) => item.businessCode === '0109-01');
    assert.ok(candidate);
    assert.equal(candidate?.folderName, '0109-01 QUANG MINH 2 BẾP TỪ GIẢM');
    assert.equal(candidate?.fileCount, 1);
    assert.equal(result.ignoredFolders.some((item) => item.folderName.startsWith('0109-01')), false);
  } finally {
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }
});

test('historical source discovery keeps QC4 letter suffixes and QC9 code-only folders for review', () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-discovery-code-variants-'));
  const qc4Folder = path.join(sourceRoot, 'Hồ sơ chứng nhận QCVN4 2026', 'Hồ sơ lô hàng mới', '0433.1A Showa 1 dây điện');
  const qc9Folder = path.join(sourceRoot, 'Hồ sơ chứng nhận QCVN9 2026', 'KQ chứng nhận QC9-26', 'IEMM 0115-04');
  fs.mkdirSync(qc4Folder, { recursive: true });
  fs.mkdirSync(qc9Folder, { recursive: true });
  fs.writeFileSync(path.join(qc4Folder, 'proposal.doc'), 'fixture');
  fs.writeFileSync(path.join(qc9Folder, 'result.pdf'), 'fixture');
  try {
    const result = discoverPcnHistoricalFolders(sourceRoot);
    assert.equal(result.candidates.find((item) => item.businessCode === '0433-1A')?.fieldCode, 'QC4');
    const qc9 = result.candidates.find((item) => item.businessCode === '0115-04');
    assert.equal(qc9?.fieldCode, 'QC9');
    assert.deepEqual(qc9?.unresolvedFields, ['productName', 'method']);
  } finally {
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }
});

test('historical source discovery scans one bounded group level and preserves nested provenance', () => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pcn-discovery-group-level-'));
  const group = path.join(sourceRoot, 'Hồ sơ chứng nhận QCVN4 2026', 'Hồ sơ lô hàng mới', 'Bình Ngân-2024');
  const nestedCandidate = path.join(group, '0668 BÌNH NGÂN 3012 4 máy sấy full');
  const tooDeep = path.join(group, 'Kho phụ', '0777 Không được quét sâu');
  fs.mkdirSync(nestedCandidate, { recursive: true });
  fs.mkdirSync(tooDeep, { recursive: true });
  fs.writeFileSync(path.join(nestedCandidate, 'GCN.docx'), 'fixture');
  fs.writeFileSync(path.join(tooDeep, 'GCN.docx'), 'fixture');
  try {
    const result = discoverPcnHistoricalFolders(sourceRoot, 'QC4');
    const candidate = result.candidates.find((item) => item.businessCode === '0668');
    assert.ok(candidate);
    assert.equal(candidate?.sourceRelativePath, 'Hồ sơ chứng nhận QCVN4 2026/Hồ sơ lô hàng mới/Bình Ngân-2024/0668 BÌNH NGÂN 3012 4 máy sấy full');
    assert.equal(result.candidates.some((item) => item.businessCode === '0777'), false);
    assert.equal(result.ignoredFolders.some((item) => item.folderName === 'Kho phụ'), true);
    assert.equal(result.ignoredFolders.some((item) => item.folderName === 'Bình Ngân-2024'), false);
  } finally {
    fs.rmSync(sourceRoot, { recursive: true, force: true });
  }
});

test('historical source discovery remains an internal utility outside product runtime', () => {
  assert.equal(packageJson.scripts?.['discover:pcn-history'], undefined);
  assert.match(scriptSource, /--source=/);
  assert.match(scriptSource, /readdirSync|readDir/);
  assert.match(scriptSource, /DRY-RUN|read-only|read only/i);
  assert.doesNotMatch(scriptSource, /writeFile|uploadObject|INSERT INTO|watch\(|watchFile\(|chokidar/);
  assert.doesNotMatch(packageJson.scripts?.['dev'] || '', /discoverPcnHistoricalFolders/);
});
