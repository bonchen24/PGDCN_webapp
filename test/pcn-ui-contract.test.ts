import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shell = fs.readFileSync(new URL('../components/PcnAppShell.tsx', import.meta.url), 'utf8');
const workspacePath = new URL('../components/PcnWorkspace.tsx', import.meta.url);
const pcnLogin = fs.readFileSync(new URL('../components/PcnLoginScreen.tsx', import.meta.url), 'utf8');
const pcnCustomers = fs.readFileSync(new URL('../components/PcnCustomersManagementView.tsx', import.meta.url), 'utf8');
const pcnStore = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const pcnSettings = fs.readFileSync(new URL('../components/PcnSettingsView.tsx', import.meta.url), 'utf8');
const sidebarPath = new URL('../components/PcnSidebar.tsx', import.meta.url);
const sidebar = fs.readFileSync(sidebarPath, 'utf8');
const navigationSource = fs.readFileSync(new URL('../utils/pcnNavigation.ts', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../utils/pcnWorkflow.ts', import.meta.url), 'utf8');
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
test('PCN workspace exposes field filters and the preserved customer list', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /Tổng quan/);
  assert.match(source, /Đề nghị/);
  assert.match(source, /Tạo Đề nghị & bộ hồ sơ/);
  assert.match(source, /Địa chỉ\/kho liên quan/);
  assert.match(source, /validatePcnProposalIntake/);
  assert.match(source, /formatPcnIntakeValidationIssues/);
  assert.match(source, /ProposalRegisterRow/);
  assert.match(workflow, /Quy chuẩn 4/);
  assert.match(workflow, /Quy chuẩn 9/);
  assert.doesNotMatch(workflow, /Quy chuẩn 20/);
  assert.match(source, /field\.name/);
  assert.match(source, /PcnDossierDetailView/);
  assert.match(source, /onDeleteDossier/);
  assert.match(source, /PcnPipelineBoard/);
  assert.match(source, /PcnWorkQueueView/);
  assert.match(source, /PcnCustomersManagementView/);
  assert.doesNotMatch(source, /SystemManagementViews/);
  assert.doesNotMatch(source, /Lịch ITD/);
  assert.doesNotMatch(source, /Lịch EMC/);
});

test('active PCN route keeps session, customer and store boundaries separate from DDT legacy runtime', () => {
  const workspace = fs.readFileSync(workspacePath, 'utf8');
  const activeSources = [workspace, pcnLogin, pcnCustomers, pcnStore];
  for (const source of activeSources) {
    assert.doesNotMatch(source, /from ['"][^'"]*\/store['"]/);
    assert.doesNotMatch(source, /from ['"][^'"]*SystemManagementViews['"]/);
    assert.doesNotMatch(source, /from ['"][^'"]*\/LoginScreen['"]/);
    assert.doesNotMatch(source, /from ['"][^'"]*\/firebase['"]/);
  }
  assert.match(workspace, /PcnLoginScreen/);
  assert.match(workspace, /usePcnSessionStore/);
  assert.match(pcnLogin, /establishPcnSession/);
  assert.match(pcnCustomers, /usePcnStore/);
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
  assert.match(sidebar, /app-compact-sidebar/);
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
  assert.match(source, /Hồ sơ cần hoàn thiện/);
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

test('PCN intake displays server-owned proposal-code allocation without a manual code field', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');

  assert.match(source, /hệ thống tự cấp|server|máy chủ/i);
  assert.match(source, /PCN-YYMMDD-TT/);
  assert.doesNotMatch(source, /reviewPcnCodes\(form\.fieldCodes, form\.proposalCode\)/);
  assert.doesNotMatch(source, /placeholder="Ví dụ: 0665/);
});

test('PCN visual inspection resolves uploader usernames to display names', () => {
  const source = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');

  assert.match(source, /function DossierVisualChecklist\([^)]*users/);
  assert.match(source, /Người tải: \{getPcnUserDisplayName\(item\.currentVersion\.uploadedBy, users\)/);
  assert.match(source, /<DossierVisualChecklist[^>]*users=\{users\}/);
});

test('PCN configuration keeps template configuration in the single admin surface', () => {
  assert.match(pcnSettings, /Cấu hình PCN/);
  assert.match(pcnSettings, /Khung danh mục tài liệu theo QC4\/QC9/);
  assert.doesNotMatch(pcnSettings, /QC20/);
  assert.match(pcnSettings, /getPcnDossierTemplateProfiles/);
  assert.match(pcnSettings, /stationGroups/);
  assert.doesNotMatch(pcnSettings, /PcnTemplateManagementView/);
});

test('PCN official generated documents keep their private asset verification boundary', () => {
  const source = fs.readFileSync(new URL('../components/PcnDocumentGenerationPanel.tsx', import.meta.url), 'utf8');

  assert.match(source, /private|riêng|Storage/i);
  assert.match(source, /preflight/);
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

  assert.match(documentPanel, /Snapshot nguồn|Dữ liệu nguồn/);
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

  assert.match(source, /function openDossierAtCurrentStation|const openDossierAtCurrentStation/);
  assert.match(source, /router\.push\(`\/pgdcn\/pcn\/dossiers/);
  assert.match(source, /initialTab \? `\?tab=/);
  assert.match(source, /<PcnDashboard[\s\S]*onOpenDossier=\{openDossierAtCurrentStation\}/);
  assert.match(source, /<PcnPipelineBoard[\s\S]*onOpenDossier=\{onOpenDossier\}/);
  assert.match(source, /<PcnWorkQueueView[\s\S]*onOpenDossier=\{onOpenDossier\}/);
});

test('dashboard and section shortcuts share one station-aware dossier opener', () => {
  const source = fs.readFileSync(workspacePath, 'utf8');
  assert.match(source, /const openDossierAtCurrentStation = \(dossier: CertificationDossier, initialTab\?/);
  assert.match(source, /<PcnDashboard[\s\S]*onOpenDossier=\{openDossierAtCurrentStation\}/);
});

test('dossier generation shortcut opens the document output modal without a new tab', () => {
  const source = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');

  assert.match(source, /const \[documentOutput, setDocumentOutput\]/);
  assert.match(source, /setDocumentOutput\(\{ kind:/);
  assert.match(source, /const openGenerationRegion = \(\) =>/);
  assert.match(source, /onOpenGeneration=\{openGenerationRegion\}/);
  assert.match(source, /PcnDocumentOutputModal/);
  assert.doesNotMatch(source, /window\.open\([^)]*generation/);
});

// --- End of pcn-ui-contract.test.ts ---

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

test('PCN shell owns page scroll and reserves scrollbar gutter', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  const css = read('index.css');

  assert.match(workspace, /<main[^>]*mobile-scroll-y[^>]*overflow-x-hidden[^>]*overflow-y-auto/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
});

test('all PCN modal source files declare a viewport bound and scrollable body', () => {
  const files = [
    'components/PcnDossierDetailView.tsx',
    'components/PcnDocumentOutputModal.tsx',
    'components/PcnLabRequestView.tsx',
    'components/PcnIssuanceView.tsx',
    'components/PcnOperationalFormModal.tsx',
    'components/PcnSampleHandoverModal.tsx',
    'components/PcnTemplateSettingsModal.tsx',
    'components/PcnPersonalSettingsPanel.tsx',
    'components/PcnDossierFilePreview.tsx',
    'components/PcnLabRequestDetailModal.tsx',
    'components/PcnResultDetailModal.tsx',
  ];

  for (const file of files) {
    const source = read(file);
    assert.match(source, /max-h-\[/, file);
    assert.match(source, /mobile-scroll-y|pcn-dossier-focus-scroll|overflow-auto/, file);
  }
});

test('read-only approval and signer delegation modal branches keep an independently scrollable body', () => {
  const approval = read('components/PcnApprovalModal.tsx');
  const approvalStart = approval.indexOf('if (current && !canAct)');
  const approvalReadOnlyEnd = approval.indexOf('return <div className="fixed', approval.indexOf('return <div className="fixed', approvalStart) + 1);
  const approvalReadOnly = approval.slice(approvalStart, approvalReadOnlyEnd);
  assert.match(approvalReadOnly, /max-h-\[/);
  assert.match(approvalReadOnly, /min-h-0/);
  assert.match(approvalReadOnly, /mobile-scroll-y/);

  const delegation = read('components/PcnSignerDelegationPanel.tsx');
  const delegationStart = delegation.indexOf('{open &&');
  const delegationModal = delegation.slice(delegationStart, delegation.indexOf('\n  </section>;', delegationStart));
  assert.match(delegationModal, /max-h-\[/);
  assert.match(delegationModal, /min-h-0/);
  assert.match(delegationModal, /mobile-scroll-y/);
});

test('proposal customer field uses a dropdown component instead of datalist', () => {
  const workspace = read('components/PcnWorkspace.tsx');

  assert.doesNotMatch(workspace, /<datalist[^>]*pcn-customer-options/);
  assert.match(workspace, /PcnCatalogCombobox/);
});

test('lab request laboratory field uses the configured catalog control', () => {
  const source = read('components/PcnLabRequestView.tsx');

  assert.match(source, /PCN_SAMPLE_LAB_OPTIONS/);
  assert.match(source, /Phòng thử nghiệm nhận[^]*<select/);
});

test('catalog combobox exposes keyboard and assistive technology semantics', () => {
  const source = read('components/PcnCatalogCombobox.tsx');

  assert.match(source, /role="combobox"/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /aria-controls/);
  assert.match(source, /aria-autocomplete="list"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /Escape/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /Enter/);
  assert.match(source, /max-h-64[^"']*overflow-y-auto[^"']*mobile-scroll-y/);
});

test('long PCN catalogs support accent-insensitive Vietnamese token search', () => {
  const combobox = read('components/PcnCatalogCombobox.tsx');
  const search = read('utils/pcnSearch.ts');
  assert.match(combobox, /normalizePcnSearchText/);
  assert.match(combobox, /filterPcnCatalogOptions/);
  assert.match(search, /tokens\.every/);
  assert.match(search, /Đđ/);
  assert.match(search, /normalize\('NFD'\)/);
});

test('long PCN data catalogs use the searchable combobox instead of native selects', () => {
  const files = [
    'components/PcnDocumentGenerationPanel.tsx',
    'components/PcnDossierDetailView.tsx',
    'components/PcnDraftingWorkspaceView.tsx',
    'components/PcnIssuanceView.tsx',
    'components/PcnOperationalFormModal.tsx',
    'components/PcnPersonalSettingsPanel.tsx',
    'components/PcnResultReturnView.tsx',
    'components/PcnSampleFlowView.tsx',
    'components/PcnSignerDelegationPanel.tsx',
    'components/PcnLabRequestView.tsx',
  ];

  for (const file of files) {
    assert.match(read(file), /PcnCatalogCombobox/, file);
  }
});
