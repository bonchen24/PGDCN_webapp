import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const componentPaths = [
  '../components/PcnSampleFlowView.tsx',
  '../components/PcnLabRequestView.tsx',
  '../components/PcnResultReturnView.tsx',
  '../components/PcnArchiveView.tsx',
];

test('PCN operational lists use the dossier customer snapshot when its proposal is unavailable', () => {
  for (const componentPath of componentPaths) {
    const source = fs.readFileSync(new URL(componentPath, import.meta.url), 'utf8');
    assert.match(source, /getPcnDossierCustomerSnapshot/);
    assert.match(source, /customerSnapshot/);
  }
});

test('historical review gives precedence to the dossier snapshot', () => {
  const source = fs.readFileSync(new URL('../components/PcnHistoricalReviewPanel.tsx', import.meta.url), 'utf8');
  assert.match(source, /dossier\.customerSnapshot \|\| proposal\.customerSnapshot/);
});
