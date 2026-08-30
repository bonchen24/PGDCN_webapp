import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const approval = read('components/PcnApprovalModal.tsx');
const archive = read('components/PcnArchiveView.tsx');
const backup = read('components/PcnBackupView.tsx');
const dossierDetail = read('components/PcnDossierDetailView.tsx');
const documentGeneration = read('components/PcnDocumentGenerationPanel.tsx');
const haimy = read('components/PcnHaimyImportView.tsx');
const historical = read('components/PcnHistoricalDiscoveryView.tsx');
const issuance = read('components/PcnIssuanceView.tsx');
const notifications = read('components/PcnNotificationDropdown.tsx');
const signerDelegation = read('components/PcnSignerDelegationPanel.tsx');
const templates = read('components/PcnTemplateManagementView.tsx');
const users = read('components/PcnUserManagementView.tsx');

test('PCN mutation handlers guard against repeated calls at the function boundary', () => {
  assert.match(approval, /if \(isSaving\) return;/);
  assert.match(dossierDetail, /const saveMilestones = async \(\) => \{\s*if \(isUpdating\) return;/);
  assert.match(dossierDetail, /const changeStatus = async \(status: PcnDossierStatus\) => \{\s*if \(isUpdating\) return;/);
  assert.match(documentGeneration, /const runPreflight = async \(\) => \{\s*if \(isPreflighting\) return;/);
  assert.match(documentGeneration, /const generate = async \(\) => \{\s*if \(isGenerating \|\| isPreflighting\) return;/);
  assert.match(issuance, /const preflightOfficialDocuments = async \(issuanceId: string, format: PcnGeneratedDocumentFormat\) => \{\s*if \(preflightingIssuanceId === issuanceId\) return;/);
  assert.match(issuance, /const generateOfficialDocuments = async \(issuanceId: string, format: PcnGeneratedDocumentFormat\) => \{\s*if \(generatingIssuanceId === issuanceId\) return;/);
  assert.match(issuance, /const \[preparingDossierId, setPreparingDossierId\] = useState<string>\(\);/);
  assert.match(issuance, /const prepareIssuance = async \(dossier: CertificationDossier\) => \{\s*if \(preparingDossierId === dossier\.id\) return;/);
  assert.match(signerDelegation, /const submit = async \(event: React\.FormEvent\) => \{\s*event\.preventDefault\(\);\s*if \(saving\) return;/);
  assert.match(signerDelegation, /const revoke = async \(delegation: PcnSignerDelegation\) => \{\s*if \(saving\) return;/);
  assert.match(templates, /const review = async \(template: PcnTemplateDefinition, action: PcnTemplateReviewAction\) => \{\s*if \(!editable \|\| busyId === template\.id\) return;/);
  assert.match(templates, /const submitAnnotation = async \(event: React\.FormEvent<HTMLFormElement>\) => \{\s*event\.preventDefault\(\);\s*if \(isAnnotating\) return;/);
  assert.match(templates, /const importTemplate = async \(template: PcnTemplateDefinition, mode: PcnTemplateImportInput\['mode'\]\) => \{\s*if \(!editable \|\| isImporting\) return;/);
  assert.match(historical, /const runDiscovery = async \(\) => \{\s*if \(isLoading\) return;/);
  assert.match(historical, /const runDryRun = async \(\) => \{\s*if \(isDryRunLoading\) return;/);
  assert.match(historical, /const applyBatch = async \(\) => \{\s*if \(isApplyLoading\) return;/);
  assert.match(haimy, /const reload = async \(\) => \{\s*if \(loading\) return;/);
  assert.match(haimy, /const submit = async \(\) => \{\s*if \(importing\) return;/);
  assert.match(haimy, /const promote = async \(\) => \{\s*if \(promoting\) return;/);
  assert.match(backup, /const handleRunBackup = async \(\) => \{\s*if \(isRunning\) return;/);
  assert.match(backup, /const handleRestore = async \(\) => \{\s*if \(isRestoring\) return;/);
  assert.match(backup, /const handleDelete = async \(\) => \{\s*if \(isDeleting\) return;/);
  assert.match(users, /const submit = async \(event: React\.FormEvent\) => \{\s*event\.preventDefault\(\);\s*if \(saving\) return;/);
  assert.match(archive, /const submitHold = async \(dossier: CertificationDossier, legalHold: boolean\) => \{\s*if \(savingId === dossier\.id\) return;/);
  assert.match(notifications, /const runNotificationAction = async/);
});

test('PCN mutation forms disable their mutation controls while pending', () => {
  assert.match(approval, /<button disabled=\{isSaving\}/);
  assert.match(dossierDetail, /onClick=\{\(\) => void saveMilestones\(\)\} disabled=\{isUpdating\}/);
  assert.match(documentGeneration, /disabled=\{isPreflighting \|\|/);
  assert.match(documentGeneration, /disabled=\{isGenerating \|\| isPreflighting/);
  assert.match(issuance, /disabled=\{preflightingIssuanceId === issuance\.id\}/);
  assert.match(issuance, /disabled=\{generatingIssuanceId === issuance\.id \|\| !docxPreflightReady\}/);
  assert.match(signerDelegation, /disabled=\{saving\}/);
  assert.match(templates, /disabled=\{isAnnotating\}/);
  assert.match(templates, /disabled=\{isImporting\}/);
  assert.match(historical, /onClick=\{\(\) => void applyBatch\(\)\} disabled=\{isApplyLoading/);
  assert.match(haimy, /onClick=\{\(\) => void promote\(\)\} disabled=\{promoting/);
  assert.match(backup, /onClick=\{\(\) => void handleRestore\(\)\} disabled=\{isRestoring/);
  assert.match(users, /disabled=\{resettingUsername !== undefined \|\| saving \|\| deletingUsername !== undefined\}/);
  assert.match(users, /disabled=\{deletingUsername !== undefined \|\| saving \|\| resettingUsername !== undefined\}/);
  assert.match(archive, /disabled=\{savingId === dossier\.id\}/);
  assert.match(notifications, /disabled=\{busyNotificationAction !== null\}/);
});

// --- End of pcn-ui-mutation-guards.test.ts ---
