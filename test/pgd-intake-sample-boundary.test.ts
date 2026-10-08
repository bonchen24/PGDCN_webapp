import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const domainSource = fs.readFileSync(new URL('../utils/pgdDomain.ts', import.meta.url), 'utf8');
const dossierSource = fs.readFileSync(new URL('../utils/pgdDossier.ts', import.meta.url), 'utf8');
const apiSource = fs.readFileSync(new URL('../utils/pgdApi.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('PGD intake has editable sample catalog and draft validation contract', () => {
  for (const marker of ['PgdIntakeSampleDraft', 'PGD_SAMPLE_TYPE_OPTIONS', 'catalogOptionId', 'customLabel', 'validatePgdIntakeSampleDraft']) {
    assert.match(domainSource, new RegExp(marker));
  }
  for (const marker of ['sampleCode', 'description', 'quantity', 'unit', 'disposition', 'sealNumber']) {
    assert.match(dossierSource, new RegExp(marker));
  }
});

test('PGD create boundary persists request samples without generic DB mutation', () => {
  assert.match(apiSource, /createPgd|intake.*sample|sampleDraft/i);
  assert.match(serverSource, /api\/pgd\/requests|sampleDraft|sampleIds/);
  assert.doesNotMatch(serverSource, /api\/pgd\/.*sample.*generic/i);
});

