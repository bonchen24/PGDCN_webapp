import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { filterPcnFutureWorkSnapshot } from '../utils/pcnActiveData.ts';
import { DEFAULT_PCN_CERTIFICATION_FIELDS, mergePcnCertificationFields } from '../utils/pcnWorkflow.ts';
import { DEFAULT_PCN_DOCUMENT_REQUIREMENTS, mergePcnDocumentRequirements } from '../utils/pcnDossierDocuments.ts';

const root = process.cwd();
const read = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PCN workspace exposes only new-work operations, not historical dossier management', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  const navigation = read('utils/pcnNavigation.ts');
  const queue = read('utils/pcnWorkQueue.ts');

  assert.doesNotMatch(workspace, /PcnHistoricalDiscoveryView|historicalDiscovery|reviewHistoricalDossier|mapHistoricalAttachment/);
  assert.doesNotMatch(navigation, /historicalDiscovery/);
  assert.match(queue, /historicalImport/);
  assert.match(queue, /return \[\]/);
});

test('PCN runtime rejects historical source-path and historical-review endpoints', () => {
  const server = read('server.ts');

  assert.match(server, /PCN_FUTURE_WORK_ONLY/);
  assert.doesNotMatch(server, /app\.post\('\/api\/pcn\/historical\//);
  assert.doesNotMatch(server, /app\.post\('\/api\/pcn\/historical-review'/);
  assert.doesNotMatch(server, /app\.post\('\/api\/pcn\/historical-attachment-mapping'/);
  assert.doesNotMatch(server, /sourceRoot\s*=\s*String\(req\.body\?\.sourceRoot/);
});

test('research sources are explicitly separated from the PCN product in the design contract', () => {
  const design = read('design.md');

  assert.match(design, /công việc và bộ hồ sơ phát sinh mới/);
  assert.match(design, /không .*dữ liệu runtime/);
  assert.match(design, /không có .*historicalDiscovery.*historicalReview.*historicalImport.*sourceRoot/);
});

test('PCN navigation keeps dossier cards while exposing management projections and drafting', () => {
  const navigation = read('utils/pcnNavigation.ts');
  const workspace = read('components/PcnWorkspace.tsx');
  const dossierDetail = read('components/PcnDossierDetailView.tsx');
  const dashboard = workspace.slice(workspace.indexOf('function PcnDashboard'), workspace.indexOf('function EmptyState'));

  assert.match(navigation, /PCN_WORKSPACE_NAVIGATION[\s\S]*'dashboard'[\s\S]*'proposals'[\s\S]*'operations'[\s\S]*'lab-operations'[\s\S]*'drafting'[\s\S]*'assistant'[\s\S]*'customers'/);
  assert.match(navigation, /items:\s*\['users',\s*'activityLogs',\s*'settings'\]/);
  assert.doesNotMatch(navigation, /'fields'/);
  assert.doesNotMatch(navigation, /'agent'|'samples'|'labRequests'|'results'|'issuance'|'archive'|'templates'|'qualityDocuments'|'operationsRegister'|'dataIntegrity'|'cutover'|'haimy'|'backup'/);
  assert.match(workspace, /PcnOperationsRegisterView|PcnLabOperationsView|PcnAssistantView|PcnDraftingWorkspaceView/);
  assert.match(workspace, /ActivityLogView/);
  assert.doesNotMatch(workspace, /PcnDataIntegrityView|PcnCutoverVerificationView|PcnAgentWorkspaceView|PcnTemplateManagementView|PcnQualityDocumentsView|PcnHaimyImportView|PcnBackupView|PcnArchiveView/);
  assert.doesNotMatch(workspace, /FieldDossierView|activeSection\s*===\s*['"]fields['"]|onOpenSection\([^)]*['"]fields['"]/);
  assert.doesNotMatch(dashboard, /Toàn vẹn dữ liệu|Mở module/);
  assert.match(dossierDetail, /PcnSampleFlowView/);
  assert.match(dossierDetail, /PcnLabRequestView/);
  assert.match(dossierDetail, /PcnResultReturnView/);
  assert.match(dossierDetail, /PcnIssuanceView/);
  assert.match(dossierDetail, /label: 'Tài liệu hồ sơ'/);
  assert.match(dossierDetail, /label: 'Mẫu & PYC'/);
  assert.match(dossierDetail, /label: 'KQTN'/);
  assert.match(dossierDetail, /label: 'Phê duyệt'/);
  assert.doesNotMatch(dossierDetail, /label: '(Sinh Word\/PDF|Đề nghị & đầu vào|Tệp đính kèm|Lịch sử)'/);
  assert.match(dossierDetail, /data-testid="pcn-proposal-summary"/);
  assert.match(dossierDetail, /PcnDocumentOutputModal/);
});

test('opening a dossier from the proposal register lets the detail view choose the current region', () => {
  const workspace = read('components/PcnWorkspace.tsx');

  assert.match(workspace, /onOpenDossier=\{\(dossier\) => \{ setSelectedDossierTab\(undefined\); setSelectedDossierId\(dossier\.id\); \}\}/);
  assert.doesNotMatch(workspace, /onOpenDossier=\{\(dossier\) => \{ setSelectedDossierTab\('overview'\); setSelectedDossierId\(dossier\.id\); \}\}/);
});

test('dashboard create action opens the new-proposal form directly', () => {
  const workspace = read('components/PcnWorkspace.tsx');

  assert.match(workspace, /onCreateProposal/);
  assert.match(workspace, /onClick=\{onCreateProposal\}[\s\S]{0,160}>[\s\S]{0,80}Tạo Đề nghị/);
  assert.match(workspace, /setProposalFormRequest\(\(current\) => current \+ 1\)/);
  assert.match(workspace, /openFormRequest=\{proposalFormRequest\}/);
});

test('the default runtime entrypoint cannot accidentally launch the legacy DDT surface', () => {
  const packageJson = read('package.json');
  const nativePcnLauncher = read('scripts/native-dev-pcn.cjs');
  const nativePcnEnv = read('scripts/native-dev-env.cjs');
  const dockerfile = read('Dockerfile');
  const compose = read('docker-compose.yml');

  assert.match(packageJson, /"dev":\s*"node \.\/scripts\/native-dev-pcn\.cjs"/);
  assert.match(packageJson, /"dev:ddt":\s*"node \.\/scripts\/native-dev\.cjs"/);
  assert.match(nativePcnLauncher, /buildPcnChildEnv/);
  assert.match(nativePcnEnv, /APP_PROFILE\s*=\s*'pcn'/);
  assert.match(nativePcnEnv, /PORT\s*=\s*'1357'/);
  assert.doesNotMatch(packageJson, /"build:vite"/);
  assert.match(dockerfile, /ENV APP_PROFILE=pcn/);
  assert.match(compose, /APP_PROFILE:\s*pcn/);
  assert.match(compose, /PCN_POSTGRES_DB:/);
  assert.doesNotMatch(compose, /POSTGRES_DB:\s*ddt_lab/);
});

test('PCN operational projection hides historical dossier data but preserves the customer catalog', () => {
  const historicalProposal = { id: 'proposal-history', historicalImport: { batchId: 'batch-1' } } as any;
  const currentProposal = { id: 'proposal-current' } as any;
  const historicalDossier = { id: 'dossier-history', proposalId: historicalProposal.id, historicalImport: { batchId: 'batch-1' } } as any;
  const currentDossier = { id: 'dossier-current', proposalId: currentProposal.id } as any;
  const historicalCustomer = { id: 'customer-history', name: 'Khách hàng cũ' } as any;
  const currentCustomer = { id: 'customer-current', name: 'Khách hàng mới' } as any;

  const snapshot = filterPcnFutureWorkSnapshot({
    proposals: [historicalProposal, currentProposal],
    dossiers: [historicalDossier, currentDossier],
    customers: [historicalCustomer, currentCustomer],
  });

  assert.deepEqual(snapshot.proposals, [currentProposal]);
  assert.deepEqual(snapshot.dossiers, [currentDossier]);
  assert.deepEqual(snapshot.customers, [historicalCustomer, currentCustomer]);
});

test('PCN field catalog does not backfill the PGD stainless-steel scope', () => {
  const fields = mergePcnCertificationFields(DEFAULT_PCN_CERTIFICATION_FIELDS);

  assert.deepEqual(fields.map((field) => field.code), ['QC4', 'QC9']);
  assert.equal(fields.some((field) => field.code === 'QC20'), false);
});

test('PCN checklist does not backfill a PGD dossier pack', () => {
  const requirements = mergePcnDocumentRequirements(DEFAULT_PCN_DOCUMENT_REQUIREMENTS);

  assert.equal(requirements.some((item) => item.fieldCode === 'QC20'), false);
  assert.equal(requirements.some((item) => /QC20/i.test(item.id)), false);
});

test('PCN bootstrap keeps imported staff as PCN personnel with a separate department-role field', () => {
  const schema = read('sql/pcn-schema.sql');

  assert.match(schema, /Trần Hoàng Phương/);
  assert.match(schema, /Vũ Thị Thắm/);
  assert.match(schema, /"systemRole":"staff"/);
  assert.match(schema, /"departmentRoleCode":"UNASSIGNED"/);
  assert.doesNotMatch(schema, /Khách DDT/);
});

test('dossier visual checklist stays read-only and keeps the upload action in one document area', () => {
  const detail = read('components/PcnDossierDetailView.tsx');
  const visualChecklist = detail.slice(detail.indexOf('function DossierStationChecklist'), detail.indexOf('function DossierWorkflowSummary('));

  assert.doesNotMatch(visualChecklist, /type="file"/);
  assert.match(detail, /data-testid="pcn-document-history"/);
  assert.match(detail, /Chi tiết phiên và tải tài liệu/);
});
