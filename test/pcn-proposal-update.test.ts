import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const apiPath = new URL('../utils/pcnProposalApi.ts', import.meta.url);
const apiSource = fs.existsSync(apiPath) ? fs.readFileSync(apiPath, 'utf8') : '';
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const proposalViewSource = workspaceSource.slice(
  workspaceSource.indexOf('function ProposalView'),
  workspaceSource.indexOf('function Field', workspaceSource.indexOf('function ProposalView')),
);
const fieldDossierSource = workspaceSource.slice(
  workspaceSource.indexOf('function FieldDossierView'),
  workspaceSource.indexOf('function Field(', workspaceSource.indexOf('function FieldDossierView')),
);

test('proposal editing has a dedicated client and store boundary', () => {
  assert.equal(fs.existsSync(apiPath), true);
  assert.match(apiSource, /updatePcnProposal/);
  assert.match(apiSource, /\/api\/pcn\/proposals/);
  assert.match(storeSource, /updateProposal:/);
  assert.match(storeSource, /updatePcnProposal/);
  assert.match(workspaceSource, /onUpdateProposal/);
  assert.match(workspaceSource, /Sửa Đề nghị/);
  assert.match(workspaceSource, /onUpdateStatus/);
  assert.match(proposalViewSource, /ProposalRegisterRow/);
  assert.match(proposalViewSource, /Tìm Đề nghị/);
  assert.match(proposalViewSource, /statusFilter/);
  assert.match(proposalViewSource, /fieldFilter/);
  assert.match(proposalViewSource, /visibleProposals/);
});

test('proposal editing is validated, status-gated, and synchronizes its dossier', () => {
  assert.match(serverSource, /app\.post\('\/api\/pcn\/proposals\/:proposalId'/);
  assert.match(serverSource, /validatePcnProposalIntake/);
  assert.match(serverSource, /INTAKE_REVIEW.*AWAITING_DOCUMENTS/);
  assert.doesNotMatch(serverSource, /PENDING_REVIEW/);
  assert.match(serverSource, /customerSnapshot/);
  assert.match(serverSource, /PCN_PROPOSAL/);
  assert.match(serverSource, /PCN_DOSSIER/);
  assert.match(serverSource, /idempotencyKey/);
});

test('proposal UI preserves the intake form when the server rejects a mutation', () => {
  assert.match(proposalViewSource, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(proposalViewSource, /if \(saving\) return/);
  assert.match(proposalViewSource, /try \{/);
  assert.match(proposalViewSource, /toast\.error\(error\?\.message/);
  assert.match(proposalViewSource, /finally \{\s*setSaving\(false\)/s);
  assert.match(proposalViewSource, /disabled=\{saving\}/);
});

test('proposal and field lists keep dossier mutations in the canonical detail view', () => {
  assert.doesNotMatch(proposalViewSource, /onDownloadPackage|onCancelDossier/);
  assert.doesNotMatch(fieldDossierSource, /onDownloadPackage|onCancelDossier/);
});

test('proposal cards link to the canonical dossier without duplicating dossier cards', () => {
  assert.match(workspaceSource, /function ProposalRegisterRow/);
  assert.match(proposalViewSource, /ProposalRegisterRow/);
  assert.doesNotMatch(proposalViewSource, /<DossierCard/);
  assert.doesNotMatch(fieldDossierSource, /<DossierCard/);
  assert.match(workspaceSource, /Mở hồ sơ chuẩn/);
});
