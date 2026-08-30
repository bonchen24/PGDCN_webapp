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
const archive = read('components/PcnArchiveView.tsx');
const systemManagement = read('components/SystemManagementViews.tsx');
const notifications = read('components/PcnNotificationDropdown.tsx');

test('PCN workspace passes one viewer read-only capability to mutation-capable modules', () => {
  assert.match(workspace, /const canMutatePcn = currentUser\.systemRole !== 'viewer' && currentUser\.role !== 'viewer';/);
  assert.match(workspace, /PcnDashboard[\s\S]*?canEdit=\{canMutatePcn\}/);
  assert.match(workspace, /ProposalView[\s\S]*?canEdit=\{canMutatePcn\}/);
  assert.doesNotMatch(workspace, /<FieldDossierView[^>]*canEdit=\{canMutatePcn\}/);
  assert.match(workspace, /PcnLabRequestView[\s\S]*?canEdit=\{canMutatePcn\}/);
  assert.match(workspace, /PcnResultReturnView[\s\S]*?canEdit=\{canMutatePcn\}/);
  assert.match(workspace, /PcnIssuanceView[\s\S]*?canMutate=\{canMutatePcn\}/);
  assert.match(workspace, /PcnArchiveView[\s\S]*?canEdit=\{canMutatePcn\}/);
  assert.doesNotMatch(workspace, /onCancel=\{canEdit \? \(\) => onCancelDossier\(dossier\) : undefined\}/);
  assert.match(dossier, /CANCELLED/);
  assert.match(workspace, /canEditMilestones=\{currentUser\.systemRole !== 'viewer' && currentUser\.role !== 'viewer'\}/);
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

test('dossier, issuance, and archive modules keep viewer controls read-only', () => {
  assert.match(dossier, /if \(isUpdating\) return;\s*if \(!canEditMilestones\) return;/);
  assert.match(dossier, /if \(!canEditMilestones \|\| !file/);
  assert.match(dossier, /canEditMilestones \? <PcnHistoricalReviewPanel/);
  assert.match(dossier, /canEditMilestones && <label/);

  assert.match(issuance, /canMutate: boolean/);
  assert.match(issuance, /if \(!canMutate\) return;/);
  assert.match(issuance, /canMutate && !issuance/);
  assert.match(issuance, /canMutate && issuance &&/);

  assert.match(archive, /canEdit: boolean/);
  assert.match(archive, /if \(savingId === dossier\.id\) return;\s*if \(!canEdit\) return;/);
  assert.match(archive, /canEdit &&/);
});

test('PCN customer management is read-only for viewer accounts', () => {
  assert.match(systemManagement, /const canEditCustomers = source !== 'pcn' \|\|/);
  assert.match(systemManagement, /if \(!canEditCustomers\) return;/);
  assert.match(systemManagement, /!isAdding && canEditCustomers/);
  assert.match(systemManagement, /isAdding && canEditCustomers/);
  assert.match(systemManagement, /canEditCustomers && <div className="flex items-center justify-end gap-1">/);
});

test('PCN viewer can open notifications but cannot mutate the shared notification collection', () => {
  assert.match(notifications, /const canManageNotifications = currentUser\?\.systemRole !== 'viewer' && currentUser\?\.role !== 'viewer';/);
  assert.match(notifications, /if \(!canManageNotifications\) \{\s*onSelect\(notification\);\s*onClose\(\);\s*return;/);
  assert.match(notifications, /canManageNotifications && unreadCount > 0/);
  assert.match(notifications, /canManageNotifications && visibleNotifications\.length > 0/);
  assert.match(notifications, /Chỉ xem/);
});
