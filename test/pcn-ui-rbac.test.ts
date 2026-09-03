import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const workspace = read('components/PcnWorkspace.tsx');
const labRequests = read('components/PcnLabRequestView.tsx');
const results = read('components/PcnResultReturnView.tsx');
const dossier = read('components/PcnDossierDetailView.tsx');
const issuance = read('components/PcnIssuanceView.tsx');
const pcnCustomers = read('components/PcnCustomersManagementView.tsx');
const notifications = read('components/PcnNotificationDropdown.tsx');

test('PCN workspace passes one viewer read-only capability to mutation-capable modules', () => {
  assert.match(workspace, /const canMutatePcn = currentUser\.systemRole !== 'viewer' && currentUser\.role !== 'viewer';/);
  assert.match(workspace, /PcnDashboard[\s\S]*?canEdit=\{canMutatePcn\}/);
  assert.match(workspace, /ProposalView[\s\S]*?canEdit=\{canMutatePcn\}/);
  assert.match(workspace, /PcnDossierDetailView[\s\S]*?canEditMilestones=\{currentUser\.systemRole !== 'viewer' && currentUser\.role !== 'viewer'\}/);
  assert.doesNotMatch(workspace, /<FieldDossierView|<PcnArchiveView/);
  assert.match(dossier, /CANCELLED/);
});

test('PYC and KQTN modules hide mutation controls and guard callbacks for viewers', () => {
  assert.match(labRequests, /canEdit: boolean/);
  assert.match(labRequests, /if \(saving\) return;\s*if \(!canEdit\) return;/);
  assert.match(labRequests, /!openForm && canEdit &&/);
  assert.match(labRequests, /canEdit \? <button/);
  assert.match(labRequests, /canEdit && nextStatus/);

  assert.match(results, /canEdit: boolean/);
  assert.match(results, /if \(saving\) return;\s*if \(!canEdit\) return;/);
  assert.match(results, /!openForm && canEdit &&/);
  assert.match(results, /canEdit && !hasIntegrityIssues/);
});

test('dossier and issuance modules keep viewer controls read-only', () => {
  assert.match(dossier, /if \(isUpdating\) return;\s*if \(!canEditDossierSteps\) return;/);
  assert.match(dossier, /if \(!canEditDossierSteps \|\| !file/);
  assert.doesNotMatch(dossier, /PcnHistoricalReviewPanel|historicalImport|historicalReview/);
  assert.match(dossier, /canEditDossierSteps && \(canProcessRequirement \?/);

  assert.match(issuance, /canMutate: boolean/);
  assert.match(issuance, /if \(!canMutate\) return;/);
  assert.match(issuance, /canMutate && dossier\.status === 'TECHNICAL_REVIEW' && \(!issuance/);
  assert.match(issuance, /canMutate && issuance &&/);

});

test('PCN customer management is read-only for viewer accounts', () => {
  assert.match(pcnCustomers, /const canEditCustomers = currentUser\?\.systemRole !== 'viewer' && currentUser\?\.role !== 'viewer';/);
  assert.match(pcnCustomers, /if \(!canEditCustomers\) return;/);
  assert.match(pcnCustomers, /!isAdding && canEditCustomers/);
  assert.match(pcnCustomers, /isAdding && canEditCustomers/);
  assert.match(pcnCustomers, /canEditCustomers && <div className="flex justify-end gap-1">/);
});

test('PCN viewer can open notifications but cannot mutate the shared notification collection', () => {
  assert.match(notifications, /const canManageNotifications = currentUser\?\.systemRole !== 'viewer' && currentUser\?\.role !== 'viewer';/);
  assert.match(notifications, /if \(!canManageNotifications\) \{\s*onSelect\(notification\);\s*onClose\(\);\s*return;/);
  assert.match(notifications, /canManageNotifications && unreadCount > 0/);
  assert.match(notifications, /canManageNotifications && visibleNotifications\.length > 0/);
  assert.match(notifications, /Chỉ xem/);
});
