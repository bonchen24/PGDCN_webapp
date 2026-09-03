import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const stylesheet = read('index.css');
const pcnWorkspace = read('components/PcnWorkspace.tsx');
const pcnSidebar = read('components/PcnSidebar.tsx');
const workflowMap = read('components/PcnWorkflowMap.tsx');
const dossierDetail = read('components/PcnDossierDetailView.tsx');
const approvalModal = read('components/PcnApprovalModal.tsx');
const horizontalSurfaces = [
  read('components/PcnWorkflowMap.tsx'),
  read('components/PcnSampleFlowView.tsx'),
];
const verticalSurfaces = [
  'components/PcnIssuanceView.tsx',
  'components/PcnLabRequestView.tsx',
  'components/PcnResultReturnView.tsx',
];
const legacyVerticalSurfaces = ['components/PcnSampleFlowView.tsx'];
const pageSurfaces = [
  'components/PcnPipelineBoard.tsx',
  'components/PcnWorkQueueView.tsx',
  'components/PcnOperationsRegisterView.tsx',
  'components/PcnLabOperationsView.tsx',
  'components/PcnDraftingWorkspaceView.tsx',
  'components/PcnSettingsView.tsx',
  'components/PcnUserManagementView.tsx',
  'components/PcnCustomersManagementView.tsx',
  'components/PcnAssistantView.tsx',
  'components/PcnIssuanceView.tsx',
  'components/PcnLabRequestView.tsx',
  'components/PcnResultReturnView.tsx',
  'components/PcnSampleFlowView.tsx',
];
const modalSurfaces = [
  'components/PcnProposalDetailModal.tsx',
  'components/PcnLabRequestDetailModal.tsx',
  'components/PcnResultDetailModal.tsx',
  'components/PcnSampleHandoverModal.tsx',
  'components/PcnDocumentOutputModal.tsx',
  'components/PcnOperationalFormModal.tsx',
  'components/PcnTemplateSettingsModal.tsx',
];

test('defines visible reusable vertical and horizontal scrollbar contracts', () => {
  assert.match(stylesheet, /html,\s*body\s*\{[\s\S]*overflow-x:\s*hidden/);
  assert.match(stylesheet, /#root\s*\{[\s\S]*min-height:\s*100%/);
  assert.match(stylesheet, /\.pcn-page-surface\s*\{[\s\S]*min-width:\s*0[\s\S]*min-height:\s*100%/);
  assert.match(stylesheet, /\.mobile-scroll-y\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(stylesheet, /\.mobile-scroll-y\s*\{[\s\S]*overflow-x:\s*hidden/);
  assert.match(stylesheet, /\.mobile-scroll-x[\s\S]*scrollbar-width:\s*thin/);
  assert.match(stylesheet, /\.mobile-scroll-y[\s\S]*::-webkit-scrollbar/);
  assert.match(stylesheet, /\.mobile-scroll-x[\s\S]*::-webkit-scrollbar/);
});

test('keeps the PCN shell and overlays inside a mobile scroll surface', () => {
  assert.match(pcnWorkspace, /<main className="min-h-0 min-w-0 flex-1 mobile-scroll-y overflow-x-hidden overflow-y-auto/);
  assert.match(pcnWorkspace, /<nav className="pcn-mobile-nav mobile-scroll-x flex shrink-0/);
  assert.match(pcnWorkspace, /mobile-touch-target flex min-h-11 min-w-\[4\.5rem\] shrink-0/);
  assert.match(pcnSidebar, /mobile-scroll-y/);
  assert.match(dossierDetail, /<main className="h-0 min-h-0 flex-1 pcn-dossier-focus-scroll/);
  assert.match(approvalModal, /<main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto/);
});

test('gives the focused dossier workspace a definite mobile scroll boundary', () => {
  assert.match(dossierDetail, /data-testid="pcn-dossier-focus-shell"/);
  assert.match(dossierDetail, /className="flex h-\[100dvh\] min-h-0 w-full flex-col overflow-hidden/);
  assert.match(dossierDetail, /<main className="h-0 min-h-0 flex-1 pcn-dossier-focus-scroll/);
  assert.match(stylesheet, /\.pcn-dossier-focus-scroll\s*\{[\s\S]*height:\s*0[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto/);
});

test('keeps the dossier workflow summary inside the mobile scroll body', () => {
  const shellStart = dossierDetail.indexOf('return <div data-testid="pcn-dossier-focus-shell"');
  const shell = dossierDetail.slice(shellStart);
  const mainIndex = shell.indexOf('<main className="h-0 min-h-0 flex-1 pcn-dossier-focus-scroll');
  const workflowIndex = shell.indexOf('<DossierWorkflowSummary');

  assert.ok(shellStart >= 0, 'focused dossier shell should be present');
  assert.ok(mainIndex >= 0, 'focused dossier scroll body should be present');
  assert.ok(workflowIndex > mainIndex, 'workflow summary must scroll with dossier content on mobile');
});

test('keeps every PCN vertical work surface discoverably scrollable', () => {
  for (const path of verticalSurfaces) {
    assert.match(read(path), /mobile-scroll-y/, path);
  }
  for (const path of pageSurfaces) {
    const source = read(path);
    assert.match(source, /pcn-page-surface/, path);
    assert.doesNotMatch(source, /className="h-full[^\"]*overflow-y-auto/, path);
  }
  for (const path of legacyVerticalSurfaces) {
    assert.match(read(path), /pcn-page-surface/, path);
  }
  assert.match(stylesheet, /\.pcn-compact \.overflow-y-auto/);
});

test('keeps modal content independently scrollable on narrow viewports', () => {
  for (const path of modalSurfaces) {
    assert.match(read(path), /mobile-scroll-y/, path);
  }
  assert.match(stylesheet, /\.pcn-mobile-nav\s*\{[\s\S]*safe-area-inset-bottom/);
});

test('keeps workflow and dense PCN tables discoverably scrollable horizontally', () => {
  for (const source of horizontalSurfaces) {
    assert.match(source, /overflow-x-auto/);
  }
  assert.match(workflowMap, /mobile-scroll-x[^\n]*overflow-x-auto/);
  assert.match(stylesheet, /\.pcn-compact \.overflow-x-auto/);
});
