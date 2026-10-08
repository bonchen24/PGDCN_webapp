import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiSource = readFileSync(new URL('../utils/pgdWorkflowTemplateApi.ts', import.meta.url), 'utf8');
const pgdApiSource = readFileSync(new URL('../utils/pgdApi.ts', import.meta.url), 'utf8');
const storeSource = readFileSync(new URL('../store-pgd.ts', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const domainSource = readFileSync(new URL('../utils/pgdDomain.ts', import.meta.url), 'utf8');
const sqlSource = readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');

test('PGD workflow template API exposes dedicated CRUD and lifecycle endpoints', () => {
  for (const name of [
    'fetchPgdWorkflowTemplates',
    'createPgdWorkflowTemplate',
    'updatePgdWorkflowTemplate',
    'createPgdWorkflowRevision',
    'publishPgdWorkflowTemplate',
    'retirePgdWorkflowTemplate',
  ]) assert.match(apiSource, new RegExp(`export async function ${name}`));
  assert.match(apiSource, /\/api\/pgd\/workflow-templates/);
  assert.match(apiSource, /revisions/);
  assert.match(apiSource, /publish/);
  assert.match(apiSource, /retire/);
});

test('PGD bootstrap and store carry workflow templates without using PCN collection fallback', () => {
  assert.match(domainSource, /workflowTemplates:\s*'pgdWorkflowTemplates'/);
  assert.match(pgdApiSource, /workflowTemplates/);
  assert.match(storeSource, /workflowTemplates/);
  assert.match(serverSource, /PGD_COLLECTIONS\.workflowTemplates/);
  assert.doesNotMatch(serverSource, /PGD_COLLECTIONS\.workflowTemplates[^\n]*pcnWorkflowTemplates/);
  assert.match(sqlSource, /pgdWorkflowTemplates/);
});

test('PGD mutations are manager-gated and published templates are immutable', () => {
  assert.match(serverSource, /app\.put\('\/api\/pgd\/workflow-templates\/:templateId'/);
  assert.match(serverSource, /requirePgdWorkflowManager/);
  assert.match(serverSource, /PUBLISHED[^\n]*bất biến|bất biến[^\n]*PUBLISHED/);
  assert.match(serverSource, /updatedAt/);
  assert.match(serverSource, /writePgdActivity/);
});

test('fresh PGD databases seed a published standard workflow template', () => {
  assert.match(sqlSource, /'pgdWorkflowTemplates'/);
  assert.match(sqlSource, /'pgd-standard-v1'/);
  assert.match(sqlSource, /"domain":"pgd"/);
  assert.match(sqlSource, /"requirementCodes"/);
  assert.match(sqlSource, /"ARCHIVE_INDEX"/);
});
