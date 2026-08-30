import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPcnIntegrityDossierTab } from '../utils/pcnDataIntegrity.ts';

const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const viewUrl = new URL('../components/PcnDataIntegrityView.tsx', import.meta.url);

test('PCN exposes a dedicated read-only data integrity module', () => {
  assert.equal(fs.existsSync(viewUrl), true);
  const viewSource = fs.readFileSync(viewUrl, 'utf8');

  assert.match(workspaceSource, /PcnDataIntegrityView/);
  assert.match(workspaceSource, /dataIntegrity/);
  assert.match(workspaceSource, /Kiểm tra dữ liệu/);
  assert.match(viewSource, /getPcnDataIntegrityReport/);
  assert.match(viewSource, /Cảnh báo toàn vẹn dữ liệu/);
  assert.match(viewSource, /read-only/);
  assert.match(viewSource, /customers/);
  assert.match(viewSource, /Danh sách khách hàng/);
  assert.match(viewSource, /Biểu mẫu PCN/);
  assert.match(viewSource, /pcnTemplateDefinitions/);
  assert.match(workspaceSource, /customers: pcn\.customers/);
  assert.match(workspaceSource, /templates: pcn\.templates/);
  assert.match(workspaceSource, /pcnTemplateDefinitions: 'templates'/);
  assert.doesNotMatch(viewSource, /onDelete|onUpdate|onSave|fetch\(/);
});

test('integrity warnings open the matching PCN dossier or module context', () => {
  const viewSource = fs.readFileSync(viewUrl, 'utf8');
  assert.match(viewSource, /onOpenIssue\(issue\.collection, issue\.entityId\)/);
  assert.match(workspaceSource, /const handleIntegrityNavigation =/);
  assert.match(workspaceSource, /onOpenIssue=\{handleIntegrityNavigation\}/);
  assert.equal(getPcnIntegrityDossierTab('certificationProposals'), 'proposal');
  assert.equal(getPcnIntegrityDossierTab('pcnSampleLots'), 'lab');
  assert.equal(getPcnIntegrityDossierTab('pcnSampleRoutes'), 'lab');
  assert.equal(getPcnIntegrityDossierTab('labRequests'), 'lab');
  assert.equal(getPcnIntegrityDossierTab('returnedResults'), 'results');
  assert.equal(getPcnIntegrityDossierTab('issuancePackages'), 'issuance');
  assert.equal(getPcnIntegrityDossierTab('certificationDossiers'), undefined);
  assert.equal(getPcnIntegrityDossierTab('customers'), undefined);
  assert.equal(getPcnIntegrityDossierTab('pcnTemplateDefinitions'), undefined);
});
