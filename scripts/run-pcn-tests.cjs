// Author: Codex
// Description: Run the active PCN product contract suite without retired UI contracts.

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const testDir = path.join(rootDir, 'test');
const preloadPath = path.join(__dirname, 'native-dev-preload.cjs');
const tsxPath = path.join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');

// These files validate retired screens or the research/import tooling that is
// intentionally kept as reference code but is not part of the PCN product
// navigation. The full historical repository suite remains available via
// `npm run test:all` for maintenance work on those utilities.
const retiredContractTests = new Set([
  'pcn-activity-log-ui.test.ts',
  'pcn-backup-ui.test.ts',
  'pcn-customer-import-ui.test.ts',
  'pcn-data-integrity-ui.test.ts',
  'pcn-historical-attachment-mapping.test.ts',
  'pcn-historical-discovery-ui.test.ts',
  'pcn-historical-import.test.ts',
  'pcn-historical-review.test.ts',
  'pcn-historical-selection.test.ts',
  'pcn-historical-source-discovery.test.ts',
  'pcn-operations-register.test.ts',
  'pcn-template-review.test.ts',
  'pcn-template-source-import.test.ts',
]);

const testFiles = fs.readdirSync(testDir)
  .filter((name) => /^pcn-.*\.test\.(?:ts|mjs)$/.test(name) || name === 'summary-register-grid.test.ts')
  .filter((name) => !retiredContractTests.has(name))
  .sort()
  .map((name) => path.join(testDir, name));

const child = spawn(
  process.execPath,
  ['--require', preloadPath, tsxPath, '--test', ...testFiles, ...process.argv.slice(2)],
  { cwd: rootDir, env: { ...process.env, APP_PROFILE: 'pcn' }, stdio: 'inherit' },
);

child.once('error', (error) => {
  console.error(`Không thể chạy bộ test PCN: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Bộ test PCN kết thúc bởi tín hiệu ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
