import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('PCN store loads workflow catalog and dossier tasks as first-class state', () => {
  const source = read('store-pcn.ts');
  assert.match(source, /PcnWorkflowTemplate/);
  assert.match(source, /PcnDossierWorkflowTask/);
  assert.match(source, /workflowTemplates:\s*PcnWorkflowTemplate\[\]/);
  assert.match(source, /workflowTasks:\s*PcnDossierWorkflowTask\[\]/);
  assert.match(source, /fetchPcnWorkflowTemplates\(\)/);
  assert.match(source, /fetchCollection<PcnDossierWorkflowTask>\('pcnDossierWorkflowTasks'\)/);
  assert.match(source, /workflowTasks:\s*activeWorkflowTasks/);
});

test('workflow template changes use the manager guard and workflow task actions use the normal mutation guard', () => {
  const source = read('store-pcn.ts');
  assert.match(source, /getPcnWorkflowTemplateMutationDenial/);
  for (const method of ['createWorkflowTemplate', 'createWorkflowRevision', 'publishWorkflowTemplate', 'retireWorkflowTemplate']) {
    const methodBody = source.match(new RegExp(`${method}: async[\\s\\S]*?(?=\\n\\n\\s{2}\\w+: async|\\n\\n}\\);)`))?.[0] || '';
    assert.match(methodBody, /assertPcnStoreWorkflowManagerMutationAllowed\(\);/, `${method} must be manager-only`);
  }
  for (const method of ['startWorkflowTask', 'completeWorkflowTask', 'returnWorkflowTask']) {
    const methodBody = source.match(new RegExp(`${method}: async[\\s\\S]*?(?=\\n\\n\\s{2}\\w+: async|\\n\\n}\\);)`))?.[0] || '';
    assert.match(methodBody, /assertPcnStoreMutationAllowed\(\);/, `${method} must preserve the normal mutation guard`);
  }
});

test('intake mutations merge server-created workflow tasks into the store', () => {
  const source = read('store-pcn.ts');
  const intakeMethods = source.match(/addProposal:[\s\S]*?\n\n  updateProposal:/)?.[0] || '';
  const dossierMethods = source.match(/addDossier:[\s\S]*?\n\n  updateProposal:/)?.[0] || '';
  assert.match(intakeMethods, /result\.workflowTasks/);
  assert.match(dossierMethods, /result\.workflowTasks/);
});
