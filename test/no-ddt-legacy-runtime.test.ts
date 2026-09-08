import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = (relativePath: string) => fs.existsSync(path.join(root, relativePath));

test('active product has no legacy Vite/DDT entrypoint', () => {
  for (const relativePath of ['App.tsx', 'index.tsx', 'index.html', 'vite.config.ts', 'store.ts', 'scripts/native-dev.cjs']) {
    assert.equal(exists(relativePath), false, `legacy runtime file must be removed: ${relativePath}`);
  }

  const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  assert.equal(packageJson.scripts?.['dev:ddt'], undefined);
  const allDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const dependency of ['vite', '@vitejs/plugin-react', '@tailwindcss/vite']) {
    assert.equal(allDependencies[dependency], undefined, `legacy Vite dependency must be removed: ${dependency}`);
  }

  const activeSource = [
    read('index.css'),
    read('components/PcnAssistantView.tsx'),
    read('components/PgdcnAssistantView.tsx'),
    read('components/PgdcnDashboardView.tsx'),
    read('components/PgdcnAppShell.tsx'),
    read('components/PcnSidebar.tsx'),
    read('components/PgdcnSidebar.tsx'),
    read('components/PcnWorkspace.tsx'),
  ].join('\n');
  assert.doesNotMatch(activeSource, /ddt-compact/);
});

test('server exposes only PCN/PGD document-template boundaries', () => {
  const server = read('server.ts');
  assert.doesNotMatch(server, /REPORT_TEMPLATES_CATALOG|\/api\/templates/);
  assert.match(server, /\/api\/pcn\/templates/);
  assert.match(server, /\/api\/pgd\/document-templates/);
});

test('PCN keeps the external DDT laboratory integration contract', () => {
  const integration = read('utils/pcnLabIntegration.ts');
  const compose = read('docker-compose.pcn.yml');
  assert.match(integration, /DDT/);
  assert.match(compose, /PCN_LAB_DDT_SECRET/);
  assert.match(compose, /PCN_LAB_INTEGRATIONS_JSON/);
});
