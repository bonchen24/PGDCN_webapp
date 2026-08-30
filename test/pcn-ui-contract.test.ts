import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const shell = fs.readFileSync(new URL('../components/PcnAppShell.tsx', import.meta.url), 'utf8');
const workspacePath = new URL('../components/PcnWorkspace.tsx', import.meta.url);
const sidebarPath = new URL('../components/PcnSidebar.tsx', import.meta.url);
const sidebar = fs.readFileSync(sidebarPath, 'utf8');
const navigationSource = fs.readFileSync(new URL('../utils/pcnNavigation.ts', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../utils/pcnWorkflow.ts', import.meta.url), 'utf8');
const resultView = fs.readFileSync(new URL('../components/PcnResultReturnView.tsx', import.meta.url), 'utf8');
const modalSources = [
  fs.readFileSync(new URL('../components/PcnApprovalModal.tsx', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../components/PcnLabRequestView.tsx', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../components/PcnSampleFlowView.tsx', import.meta.url), 'utf8'),
  fs.readFileSync(new URL('../components/PcnUserManagementView.tsx', import.meta.url), 'utf8'),
];

test('Next shell renders the PCN workspace instead of the DDT schedule app', () => {
  assert.equal(fs.existsSync(workspacePath), true);
  assert.match(shell, /PcnWorkspace/);
  assert.doesNotMatch(shell, /from ['"]\.\.\/App['"]/);
});

test('PCN workspace exposes field-first navigation and the preserved customer list', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /Tổng quan/);
  assert.match(source, /Đề nghị/);
  assert.match(source, /Tạo Đề nghị & bộ hồ sơ/);
  assert.match(source, /Địa chỉ\/kho liên quan/);
  assert.match(source, /validatePcnProposalIntake/);
  assert.match(source, /formatPcnIntakeValidationIssues/);
  assert.match(source, /ProposalRegisterRow/);
  assert.match(source, /FieldRegisterRow/);
  assert.match(workflow, /Quy chuẩn 4/);
  assert.match(workflow, /Quy chuẩn 9/);
  assert.match(source, /field\.name/);
  assert.match(source, /PYC gửi PTN/);
  assert.match(source, /generatedDocuments=\{pcn\.generatedDocuments\}/);
  assert.match(source, /onOpenDossier=\{\(dossierId\) => \{ setSelectedDossierTab\('lab'\); setSelectedDossierId\(dossierId\); \}\}/);
  assert.match(source, /Phê duyệt & Phát hành/);
  assert.match(source, /PcnResultReturnView/);
  assert.match(resultView, /KQTN trả về/);
  assert.match(resultView, /PYC gửi PTN/);
  assert.match(source, /CustomersManagementView/);
  assert.match(source, /source="pcn"/);
  assert.doesNotMatch(source, /Lịch ITD/);
  assert.doesNotMatch(source, /Lịch EMC/);
});

test('PCN shell keeps IEMM identity visible in both the sidebar and the header', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  const shellSource = `${source}\n${sidebar}`;

  assert.ok((shellSource.match(/src="\/icons\/iemm-logo-32\.png"/g) || []).length >= 2);
  assert.ok((shellSource.match(/IEMM • TVCI/g) || []).length >= 2);
  assert.match(source, /<header[\s\S]*IEMM • TVCI/);
  assert.match(sidebar, /alt="IEMM • TVCI"/);
});

test('PCN navigation follows the DDT compact sidebar pattern without a duplicate field branch', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /PcnSidebar/);
  assert.match(source, /isSidebarCollapsed/);
  assert.match(source, /pcn_sidebar_collapsed/);
  assert.match(sidebar, /ddt-compact-sidebar/);
  assert.match(source, /isSidebarCollapsed \? 'w-16' : 'w-64'/);
  assert.match(source, /Mở rộng menu/);
  assert.match(source, /Thu gọn menu/);
  assert.match(sidebar, /aria-label="Menu Sidebar"/);
  assert.match(navigationSource, /PCN_NAVIGATION_GROUPS/);
  assert.doesNotMatch(source, /Lĩnh vực nhanh/);
});

test('PCN dashboard passes its resolved user directory to the work queue', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /<PcnWorkQueueView[\s\S]{0,700}users=\{boardUsers\}/);
  assert.doesNotMatch(source, /<PcnWorkQueueView[\s\S]{0,700}users=\{pcn\.users\}/);
});

test('PCN dashboard shows one switchable work surface instead of duplicating queue and workflow', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /dashboardWorkSurface/);
  assert.match(source, /setDashboardWorkSurface/);
  assert.match(source, /useState<'QUEUE' \| 'WORKFLOW'>\('WORKFLOW'\)/);
  assert.match(source, /data-testid="pcn-dashboard-work-surface"/);
  assert.match(source, /Việc cần làm/);
  assert.match(source, /Bản đồ quy trình/);
  assert.match(source, /dashboardWorkSurface === 'WORKFLOW'/);
});

test('PCN intake form renders validation feedback beside the affected field', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /const emptyForm = \(\) => \([\s\S]*?fieldCodes: \[\]/);
  assert.doesNotMatch(source, /const emptyForm = \(\) => \([\s\S]*?fieldCodes: \['QC4'\]/);
  assert.match(source, /indexPcnIntakeValidationIssues/);
  assert.match(source, /validationErrors/);
  assert.match(source, /role="alert"/);
  assert.match(source, /error=\{validationErrors\['customerSnapshot\.name'\]\}/);
  assert.match(source, /error=\{validationErrors\.warehouseAddress\}/);
  assert.match(source, /aria-invalid=\{Boolean\(validationErrors\['customerSnapshot\.name'\]\)\}/);
});

test('PCN intake form restores server validation issues beside the affected field', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /PcnIntakeApiError/);
  assert.match(source, /error instanceof PcnIntakeApiError/);
  assert.match(source, /setValidationErrors\(indexPcnIntakeValidationIssues\(error\.issues\)\)/);
});

test('PCN intake surfaces source-code review hints without blocking the proposal form', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /reviewPcnCode/);
  assert.match(source, /Mã Đề nghị \/ mã đăng ký/);
  assert.match(source, /codeReview\.needsReview/);
  assert.match(source, /codeReview\.message/);
});

test('PCN visual inspection resolves uploader usernames to display names', () => {
  const source = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');

  assert.match(source, /function DossierVisualChecklist\([^)]*users/);
  assert.match(source, /Người tải: \{getPcnUserDisplayName\(item\.currentVersion\.uploadedBy, users\)/);
  assert.match(source, /<DossierVisualChecklist[^>]*users=\{users\}/);
});

test('PCN template management exposes surveyed annotation coverage before manual mapping', () => {
  const source = fs.readFileSync(new URL('../components/PcnTemplateManagementView.tsx', import.meta.url), 'utf8');

  assert.match(source, /getPcnTemplateAnnotationSuggestionCoverage/);
  assert.match(source, /annotationCoverage/);
  assert.match(source, /Gợi ý nhãn nguồn đã xác minh/);
  assert.match(source, /Chưa có nhãn nguồn khảo sát/);
  assert.match(source, /missingSuggestionKeys/);
});

test('PCN template management exposes private asset verification state on each card', () => {
  const source = fs.readFileSync(new URL('../components/PcnTemplateManagementView.tsx', import.meta.url), 'utf8');

  assert.match(source, /privateAssetVerificationIssue/);
  assert.match(source, /Asset private đã xác minh/);
  assert.match(source, /Định dạng asset không đúng/);
  assert.match(source, /Mã kiểm tra asset/);
  assert.match(source, /assetFilter/);
  assert.match(source, /Asset đã xác minh/);
  assert.match(source, /Asset cần rà soát/);
});

test('PYC workbench exposes the generated-document lineage and dossier shortcut', () => {
  const labRequestView = fs.readFileSync(new URL('../components/PcnLabRequestView.tsx', import.meta.url), 'utf8');

  assert.match(labRequestView, /generatedDocuments: PcnGeneratedDocument\[\]/);
  assert.match(labRequestView, /getPcnGeneratedDocumentsForKind/);
  assert.match(labRequestView, /getPcnLabFieldSelection/);
  assert.doesNotMatch(labRequestView, /fieldCodes\[0\]/);
  assert.match(labRequestView, /<option value="">Chọn Lĩnh vực<\/option>/);
  assert.match(labRequestView, /LAB_REQUEST/);
  assert.match(labRequestView, /Mở hồ sơ/);
  assert.match(labRequestView, /Mở phiếu/);
});

test('PCN document preflight exposes a read-only source snapshot before generation', () => {
  const documentPanel = fs.readFileSync(new URL('../components/PcnDocumentGenerationPanel.tsx', import.meta.url), 'utf8');

  assert.match(documentPanel, /Snapshot nguồn/);
  assert.match(documentPanel, /preflight\.proposalCode/);
  assert.match(documentPanel, /preflight\.dossierCode/);
  assert.match(documentPanel, /preflight\.customerName/);
  assert.match(documentPanel, /preflight\.productName/);
  assert.match(documentPanel, /preflight\.checklist\.length/);
  assert.match(documentPanel, /preflight\.attachments\.length/);
});

test('PCN icon-only modal controls have accessible names', () => {
  for (const source of modalSources) {
    assert.match(source, /<X\s+size=/);
    assert.match(source, /(aria-label|title)="[^"]+"[\s\S]{0,240}<X\s+size=/);
  }
});

test('PCN mobile navigation controls have accessible names', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  assert.match(sidebar, /aria-label="Đóng menu PCN"[\s\S]{0,180}<X\s+size=/);
  assert.match(source, /aria-label="Mở menu PCN"[\s\S]{0,180}<Menu\s+size=/);
});

test('PCN section dossier shortcuts preserve the operator station context', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /onOpenDossier=\{\(dossier\) => \{ setSelectedDossierTab\('proposal'\); setSelectedDossierId\(dossier\.id\); \}\}/);
  assert.match(source, /onOpenDossier=\{\(dossier\) => openDossierAtCurrentStation\(dossier\)\}/);
  assert.match(source, /function openDossierAtCurrentStation|const openDossierAtCurrentStation/);
  assert.match(source, /setSelectedDossierTab\(initialTab \|\| getPcnDossierStationTab\(station\.key/);
  assert.match(source, /onOpenDossier=\{\(dossierId\) => \{ setSelectedDossierTab\('lab'\); setSelectedDossierId\(dossierId\); \}\}/);
  assert.match(source, /onOpenDossier=\{\(dossier\) => \{ setSelectedDossierTab\('issuance'\); setSelectedDossierId\(dossier\.id\); \}\}/);
  assert.match(source, /openDossierAtCurrentStation\(response\.dossier\)/);
});

test('dashboard and section shortcuts share one station-aware dossier opener', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  assert.match(source, /const openDossierAtCurrentStation = \(dossier: CertificationDossier, initialTab\?/);
  assert.match(source, /<PcnDashboard[\s\S]*onOpenDossier=\{openDossierAtCurrentStation\}/);
});

// --- End of pcn-ui-contract.test.ts ---
