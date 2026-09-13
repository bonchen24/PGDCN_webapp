import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('PGDCN overview KPI strips use the shared compact card and desktop multi-column layout', () => {
  const shared = read('../components/PgdcnDashboardView.tsx');
  const pcn = read('../components/PcnWorkspace.tsx');
  const pgd = read('../components/PgdWorkspace.tsx');
  const css = read('../index.css');

  assert.match(css, /\.pgdcn-kpi-card[\s\S]*min-height:\s*4\.25rem[\s\S]*align-items:\s*center/);
  assert.match(shared, /className="pgdcn-kpi-card/);
  assert.doesNotMatch(shared, /min-h-\[108px\]/);
  assert.match(shared, /grid-cols-2\s+gap-2\s+md:grid-cols-4\s+lg:grid-cols-6/);
  assert.match(pcn, /className="pgdcn-kpi-card/);
  assert.match(pcn, /grid-cols-2\s+gap-2\.5\s+md:grid-cols-4\s+xl:grid-cols-8\s+2xl:grid-cols-10/);
  assert.match(pgd, /className="pgdcn-kpi-card/);
  assert.match(pgd, /grid-cols-2\s+gap-2\s+md:grid-cols-4\s+lg:grid-cols-8/);
});

test('queue and sample-operation KPI strips use the same dense card contract', () => {
  for (const path of [
    '../components/PcnDossierQueueView.tsx',
    '../components/PgdDossierQueueView.tsx',
    '../components/PcnLabOperationsView.tsx',
    '../components/PcnSampleFlowView.tsx',
  ]) {
    assert.match(read(path), /pgdcn-kpi-card/, path);
  }
});

// --- End of pgdcn-kpi-density.test.ts ---
