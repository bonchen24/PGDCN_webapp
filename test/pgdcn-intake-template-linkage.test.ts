import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const includes = (source: string, fragment: string) => assert.ok(source.includes(fragment), `Expected source to include ${fragment}`);

test('PCN and PGD intake revalidate the selected published template and snapshot the selected version', () => {
  const pcn = read('app/api/pcn/intake/route.ts');
  const pgd = read('app/api/pgd/requests/route.ts');
  for (const source of [pcn, pgd]) {
    includes(source, 'match');
    includes(source, 'resolveWorkflowTemplateForCreate');
    includes(source, 'workflowTemplatePending');
    includes(source, 'workflowTemplateVersion');
    includes(source, 'workflowSnapshot');
  }
  includes(pcn, 'buildPcnWorkflowTaskSeed');
  includes(pcn, "data->>'status' = 'PUBLISHED'");
  includes(pgd, 'snapshotPgdWorkflowTemplate');
});

test('PCN intake allows mutation when the authorization guard returns no error', () => {
  const pcn = read('app/api/pcn/intake/route.ts');
  assert.match(pcn, /const mutationError = requirePcnMutation\(actor\);\s*if \(mutationError\) return mutationError;/);
  assert.doesNotMatch(pcn, /if\s*\(!requirePcnMutation\(actor\)\)/);
});

test('later attachment is restricted to pending intakes and stores an immutable snapshot', () => {
  const pcn = read('app/api/pcn/dossiers/[dossierId]/workflow-template/route.ts');
  const pgd = read('app/api/pgd/requests/[requestId]/workflow-template/route.ts');
  includes(pcn, 'workflowTemplatePending !== true');
  includes(pgd, 'workflowTemplatePending !== true');
  includes(pcn, 'buildPcnWorkflowTaskSeed');
  includes(pcn, 'workflowTemplateVersion');
  includes(pgd, 'snapshotPgdWorkflowTemplate');
  includes(pgd, 'workflowTemplatePending: false');
});

test('intake forms expose template matching controls and preserve pending no-match behavior', () => {
  const pcn = read('components/PcnWorkspace.tsx');
  const pgd = read('components/PgdWorkspace.tsx');
  includes(pcn, 'pcn-proposal-workflow-template');
  includes(pgd, 'pgd-intake-workflow-template');
  includes(pcn, 'workflowCandidates.length === 0');
  includes(pgd, 'workflowCandidates.length === 0');
  includes(pgd, 'function SelectInput');
  includes(pgd, 'PcnCatalogCombobox');
});

test('PCN proposal DOCX source uses explicit registry and standards data', () => {
  const drafting = read('utils/pcnDrafting.ts');
  const intake = read('components/PcnWorkspace.tsx');
  includes(drafting, "formKind === 'PROPOSAL_FORM'");
  includes(drafting, 'proposal?.registrationNumber');
  includes(drafting, 'proposal?.standards');
  includes(intake, 'registrationNumber: form.registrationNumber.trim()');
  includes(intake, 'standards: form.standards.split');
  includes(read('utils/pcnIntakePolicy.ts'), 'requireStandards');
});

test('existing PCN proposal edits do not require a new workflow-template decision', () => {
  const intake = read('components/PcnWorkspace.tsx');
  includes(intake, 'hidden={Boolean(editingProposal)}');
  includes(intake, 'if (!editingProposal && workflowSelection.isAmbiguous)');
});
