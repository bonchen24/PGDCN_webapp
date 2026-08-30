import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const apiPath = new URL('../utils/pcnHistoricalDiscoveryApi.ts', import.meta.url);
const viewPath = new URL('../components/PcnHistoricalDiscoveryView.tsx', import.meta.url);
const viewHelpersPath = new URL('../utils/pcnHistoricalDiscoveryView.ts', import.meta.url);
import { filterPcnHistoricalIgnoredFolders, paginatePcnHistoricalIgnoredFolders } from '../utils/pcnHistoricalDiscoveryView.ts';

test('ignored historical folders can be filtered and paginated without changing the source snapshot', () => {
  const folders = [
    { fieldCode: 'QC4' as const, sourceRelativePath: 'Hồ sơ/gtth 0137', folderName: 'gtth 0137', reason: 'NAME_NOT_RECOGNIZED' as const },
    { fieldCode: 'QC4' as const, sourceRelativePath: 'Hồ sơ/EDC 10.09.2025', folderName: 'EDC 10.09.2025', reason: 'NAME_NOT_RECOGNIZED' as const },
    { fieldCode: 'QC9' as const, sourceRelativePath: 'KQ/IEMM 9999', folderName: 'IEMM 9999', reason: 'NAME_NOT_RECOGNIZED' as const },
  ];

  const filtered = filterPcnHistoricalIgnoredFolders(folders, '0137');
  const page = paginatePcnHistoricalIgnoredFolders(folders, 2, 1);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].folderName, 'gtth 0137');
  assert.deepEqual(page.items.map((item) => item.folderName), ['EDC 10.09.2025']);
  assert.equal(page.total, 3);
  assert.equal(folders.length, 3);
});

test('PCN historical discovery has a same-origin read-only API contract', () => {
  assert.match(server, /app\.post\('\/api\/pcn\/historical\/discovery'/);
  assert.match(server, /discoverPcnHistoricalFolders/);
  assert.match(server, /read-only|read only/i);
  assert.doesNotMatch(server.slice(server.indexOf("app.post('/api/pcn/historical/discovery'"), server.indexOf("app.post('/api/pcn/historical-review'")), /withPgTransaction|INSERT INTO|uploadObject/);
  assert.equal(fs.existsSync(apiPath), true);
  assert.match(fs.readFileSync(apiPath, 'utf8'), /\/api\/pcn\/historical\/discovery/);
});

test('PCN historical discovery does not echo the absolute source root over HTTP', () => {
  const discoveryRoute = server.slice(server.indexOf("app.post('/api/pcn/historical/discovery'"), server.indexOf("app.post('/api/pcn/historical/dry-run'"));
  const dryRunRoute = server.slice(server.indexOf("app.post('/api/pcn/historical/dry-run'"), server.indexOf("app.post('/api/pcn/historical-review'"));
  assert.match(discoveryRoute, /sourceRoot\s*:\s*_sourceRoot/);
  assert.doesNotMatch(discoveryRoute, /\.\.\.result[^\n]*sourceRoot\s*:/);
  assert.doesNotMatch(dryRunRoute, /sourceRoot\s*:\s*result\.sourceRoot/);
});

test('PCN historical selection exposes a hash and classification dry-run boundary', () => {
  assert.match(server, /app\.post\('\/api\/pcn\/historical\/dry-run'/);
  assert.match(server, /buildPcnHistoricalPilotPlans/);
  assert.match(server, /resolvePcnHistoricalCandidates/);
  assert.match(server, /summarizePcnHistoricalPlans/);
  const dryRunRoute = server.slice(server.indexOf("app.post('/api/pcn/historical/dry-run'"), server.indexOf("app.post('/api/pcn/historical-review'"));
  assert.doesNotMatch(dryRunRoute, /withPgTransaction|INSERT INTO|uploadObject|applyPcnHistorical/);
  assert.match(fs.readFileSync(apiPath, 'utf8'), /historical\/dry-run/);
});

test('PCN historical apply is an Admin-only confirmed boundary that rebuilds the plan', () => {
  assert.match(server, /app\.post\('\/api\/pcn\/historical\/apply'/);
  const applyRoute = server.slice(server.indexOf("app.post('/api/pcn/historical/apply'"), server.indexOf("app.post('/api/pcn/historical-attachment-mapping'"));
  assert.match(applyRoute, /requirePcnAdmin\(req, res\)/);
  assert.match(applyRoute, /confirmBatchId/);
  assert.match(applyRoute, /resolvePcnHistoricalCandidates/);
  assert.match(applyRoute, /buildPcnHistoricalPilotPlans/);
  assert.match(applyRoute, /applyPcnHistoricalPlans/);
  assert.doesNotMatch(applyRoute, /req\.body\?\.plans|req\.body\.plans/);
  assert.match(fs.readFileSync(apiPath, 'utf8'), /historical\/apply/);
});

test('PCN workspace exposes a controlled historical discovery screen', () => {
  assert.equal(fs.existsSync(viewPath), true);
  const view = fs.readFileSync(viewPath, 'utf8');
  assert.match(workspace, /PcnHistoricalDiscoveryView/);
  assert.match(workspace, /historicalDiscovery/);
  assert.match(workspace, /dossiers=\{pcn\.dossiers\}/);
  assert.match(workspace, /attachments=\{pcn\.dossierAttachments\}/);
  assert.match(workspace, /activityLogs=\{pcn\.activityLogs\}/);
  assert.match(workspace, /pcn\.load\(true\)/);
  assert.match(view, /Kiểm kê nguồn lịch sử/);
  assert.match(view, /Đường dẫn nguồn/);
  assert.match(view, /QC4/);
  assert.match(view, /QC9/);
  assert.match(view, /FIELD:BUSINESS_CODE/);
  assert.match(view, /Chọn candidate/);
  assert.match(view, /dry-run/i);
  assert.match(view, /sha256|SHA-256/);
  assert.match(view, /Phân loại tệp|mapping|skipped/i);
  assert.match(view, /Lập báo cáo dry-run/);
  assert.match(view, /Lọc candidate lịch sử/);
  assert.match(view, /paginatePcnHistoricalCandidates/);
  assert.match(view, /Thư mục cần rà soát/);
  assert.match(view, /Lọc thư mục bỏ qua/);
  assert.match(view, /paginatePcnHistoricalIgnoredFolders/);
  assert.match(view, /ignoredFolders/);
  assert.match(view, /Chọn trang này|Bỏ chọn trang này/);
  assert.equal(fs.existsSync(viewHelpersPath), true);
  assert.match(view, /confirmBatchId|Nhập lại batchId|Xác nhận nhập/);
  assert.match(view, /isPcnAdmin|currentUser/);
  assert.match(view, /applyPcnHistoricalBatchOnServer/);
  assert.match(view, /không hash\/upload|không ghi database|không ghi DB/i);
  assert.doesNotMatch(view, /--apply|importPcnHistoricalPilot|\/api\/pcn\/intake/);
  assert.doesNotMatch(view, /result\.sourceRoot/);
  assert.match(view, /discoveredSourceRoot/);
  assert.match(view, /sourceAreaDestination/);
  assert.match(view, /onOpenSection/);
  assert.match(view, /Mở module/);
  assert.doesNotMatch(view, /window\.open/);
});

test('PCN historical discovery renders the read-only imported batch register', () => {
  const view = fs.readFileSync(viewPath, 'utf8');
  assert.match(view, /buildPcnHistoricalBatchSummaries/);
  assert.match(view, /Batch đã nhập/);
  assert.match(view, /pendingReviewCount/);
});

test('PCN historical discovery renders reference-source coverage outside candidate selection', () => {
  const view = fs.readFileSync(viewPath, 'utf8');
  assert.match(view, /Độ phủ nguồn tham chiếu/);
  assert.match(view, /referenceSources/);
  assert.match(view, /CERTIFICATE_ARCHIVE/);
  assert.match(view, /Không thuộc candidate/);
  assert.match(view, /totalBytes/);
  assert.match(view, /byExtension/);
  assert.match(view, /sampleFileNames/);
});

test('PCN historical discovery labels the newly mapped operational source roles', () => {
  const view = fs.readFileSync(viewPath, 'utf8');
  assert.match(view, /Biên bản đánh giá/);
  assert.match(view, /Giấy phép \/ chỉ định/);
  assert.match(view, /Ảnh \/ bằng chứng hình ảnh/);
  assert.match(view, /Tiêu chuẩn tham chiếu/);
  assert.match(view, /Ghi chú văn thư/);
});

test('PCN store exposes an explicit forced reload after a historical apply', () => {
  const store = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
  assert.match(store, /load: \(force\?: boolean\)/);
  assert.match(store, /get\(\)\.isLoaded && !force/);
});

// --- End of pcn-historical-discovery-ui.test.ts ---
