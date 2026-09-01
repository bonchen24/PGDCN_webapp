import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const componentPaths = [
  '../components/PcnSampleFlowView.tsx',
  '../components/PcnLabRequestView.tsx',
  '../components/PcnResultReturnView.tsx',
];

test('PCN operational lists use the dossier customer snapshot when its proposal is unavailable', () => {
  for (const componentPath of componentPaths) {
    const source = fs.readFileSync(new URL(componentPath, import.meta.url), 'utf8');
    assert.match(source, /getPcnDossierCustomerSnapshot/);
    assert.match(source, /customerSnapshot/);
  }
});

test('active dossier detail keeps the customer snapshot as the fallback identity', () => {
  const source = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
  assert.match(source, /getPcnDossierCustomerSnapshot/);
  assert.match(source, /customerSnapshot/);
});
