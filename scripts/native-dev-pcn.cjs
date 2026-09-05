// Author: Codex
// Description: Start the native PCN development server without a legacy DDT path dependency.

const path = require('node:path');
const { spawn } = require('node:child_process');
const { buildPcnChildEnv } = require('./native-dev-env.cjs');

const projectRoot = path.resolve(__dirname, '..');
const preloadPath = path.resolve(__dirname, 'native-dev-preload.cjs');
const tsxCliPath = path.resolve(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const childEnv = buildPcnChildEnv({ projectRoot, env: process.env });

const nodeOptions = childEnv.NODE_OPTIONS || '';
childEnv.NODE_OPTIONS = nodeOptions.includes(preloadPath)
  ? nodeOptions
  : `${nodeOptions} --require=${preloadPath}`.trim();

const child = spawn(process.execPath, [tsxCliPath, 'server.ts'], {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit',
  windowsHide: false,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.once('error', (error) => {
  console.error(`Native PCN server failed to start: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
