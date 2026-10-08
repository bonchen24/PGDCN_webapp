import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const retiredViews = [
  'components/PcnAgentWorkspaceView.tsx',
  'components/PcnArchiveView.tsx',
  'components/PcnBackupView.tsx',
  'components/PcnCutoverVerificationView.tsx',
  'components/PcnDataIntegrityView.tsx',
  'components/PcnHaimyImportView.tsx',
  'components/PcnHistoricalDiscoveryView.tsx',
  'components/PcnHistoricalReviewPanel.tsx',
  'components/PcnHistoricalScopeBadge.tsx',
  'components/PcnQualityDocumentsView.tsx',
  'components/PcnTemplateManagementView.tsx',
];

test('PCN navigation contains active work projections plus Admin settings only', () => {
  const navigation = read('utils/pcnNavigation.ts');
  assert.match(navigation, /dashboard/);
  assert.match(navigation, /proposals/);
  assert.match(navigation, /customers/);
  assert.match(navigation, /operations/);
  assert.match(navigation, /lab-operations/);
  assert.match(navigation, /drafting/);
  assert.match(navigation, /assistant/);
  assert.match(navigation, /settings/);
  assert.doesNotMatch(navigation, /cutover|haimy|archive|backup|historical|integrity|operationsRegister|agent/i);
});

test('PCN runtime and server expose no Haimy or Cutover surface', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  const server = read('server.legacy.ts');
  const rbac = read('utils/pcnRbac.ts');
  assert.match(workspace, /Pcn(OperationsRegister|LabOperations|Assistant|DraftingWorkspace)View/);
  assert.doesNotMatch(workspace, /Pcn(Haimy|Cutover|Archive|Backup|DataIntegrity|AgentWorkspace|Historical)/);
  assert.doesNotMatch(server, /\/api\/pcn\/cutover-status|\/api\/pcn\/integrations\/haimy/);
  assert.doesNotMatch(rbac, /pcnHaimyStaging/);
});

test('retired PCN-only views are removed from the source tree', () => {
  for (const relativePath of retiredViews) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), false, `${relativePath} must be removed`);
  }
});

test('active PCN keeps valid dossier regions without exposing them as workspace pages', () => {
  const detail = read('components/PcnDossierDetailView.tsx');
  const workspace = read('components/PcnWorkspace.tsx');
  assert.match(detail, /PcnSampleFlowView/);
  assert.match(detail, /PcnLabRequestView/);
  assert.match(detail, /PcnResultReturnView/);
  assert.match(detail, /PcnIssuanceView/);
  assert.doesNotMatch(workspace, /Pcn(SampleFlow|LabRequest|ResultReturn|Issuance)View/);
});
