import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const pcnList = source('../app/api/pcn/workflow-templates/route.ts');
const pgdList = source('../app/api/pgd/workflow-templates/route.ts');
const pcnUpdate = source('../app/api/pcn/workflow-templates/[templateId]/route.ts');
const pgdUpdate = source('../app/api/pgd/workflow-templates/[templateId]/route.ts');
const pcnPublish = source('../app/api/pcn/workflow-templates/[templateId]/publish/route.ts');
const pgdPublish = source('../app/api/pgd/workflow-templates/[templateId]/publish/route.ts');
const pcnRetire = source('../app/api/pcn/workflow-templates/[templateId]/retire/route.ts');
const pgdRetire = source('../app/api/pgd/workflow-templates/[templateId]/retire/route.ts');
const pcnRevisions = source('../app/api/pcn/workflow-templates/[templateId]/revisions/route.ts');
const pgdRevisions = source('../app/api/pgd/workflow-templates/[templateId]/revisions/route.ts');
const pgdBootstrap = source('../app/api/pgd/bootstrap/route.ts');
const managementView = source('../components/PgdcnDossierTemplateManagementView.tsx');

test('workflow template lists isolate personal drafts by creator and show only published common templates', () => {
  for (const listRoute of [pcnList, pgdList]) {
    assert.match(listRoute, /COALESCE\(data->>'scope', 'COMMON'\) = 'COMMON' AND data->>'status' = 'PUBLISHED'/);
    assert.match(listRoute, /data->>'scope' = 'PERSONAL' AND data->>'status' = 'DRAFT' AND data->>'createdBy' = \$[12]/);
    assert.match(listRoute, /canProposePcnWorkflow|canProposePgdWorkflow/);
  }
});

test('PCN readers without proposal rights can still load shared published templates', () => {
  assert.match(pcnList, /departmentScopes\s*\|\|\s*\[\]/);
  assert.match(pcnList, /canProposePcnWorkflow\(actor\)/);
  assert.match(pcnList, /COALESCE\(data->>'scope', 'COMMON'\) = 'COMMON' AND data->>'status' = 'PUBLISHED'/);
});

test('template creation derives COMMON or PERSONAL scope from server authorization', () => {
  for (const listRoute of [pcnList, pgdList]) {
    assert.match(listRoute, /template\.scope = manager \? 'COMMON' : 'PERSONAL'/);
    assert.match(listRoute, /status !== 'DRAFT'/);
  }
});

test('only managers or the owner can update personal drafts and updates keep them draft', () => {
  for (const updateRoute of [pcnUpdate, pgdUpdate]) {
    assert.match(updateRoute, /existing\.scope === 'PERSONAL' && existing\.createdBy !== actor\.username/);
    assert.match(updateRoute, /!manager && existing\.scope !== 'PERSONAL'/);
    assert.match(updateRoute, /next\.status = 'DRAFT'/);
    assert.match(updateRoute, /allowIncompleteDraft: true/);
  }
  assert.match(managementView, /activeCanManage && sourceTemplate\?\.scope !== 'PERSONAL'/);
  assert.match(managementView, /template\.scope === 'PERSONAL' && template\.createdBy !== props\.currentUser\.username/);
});

test('personal proposals cannot be published, retired or revised directly', () => {
  for (const protectedRoute of [pcnPublish, pgdPublish, pcnRetire, pgdRetire, pcnRevisions, pgdRevisions]) {
    assert.match(protectedRoute, /existing\.scope === 'PERSONAL'/);
  }
});

test('PGD bootstrap applies the same per-user proposal visibility policy as the template API', () => {
  assert.match(pgdBootstrap, /getPgdSessionUser/);
  assert.match(pgdBootstrap, /isPgdWorkflowManager/);
  assert.match(pgdBootstrap, /canProposePgdWorkflow/);
  assert.match(pgdBootstrap, /filterPgdWorkflowTemplatesByScope/);
});
