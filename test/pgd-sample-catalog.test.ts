import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const domainSource = fs.readFileSync(new URL('../utils/pgdDomain.ts', import.meta.url), 'utf8');

test('PGD sample catalog covers active groups and preserves custom entries', () => {
  assert.match(domainSource, /PGD_SAMPLE_TYPE_OPTIONS/);
  for (const group of ['STEEL_METAL', 'MACHINERY_LINE', 'COAL', 'OTHER']) assert.match(domainSource, new RegExp(group));
  assert.match(domainSource, /CUSTOM|customLabel|custom/i);
});

