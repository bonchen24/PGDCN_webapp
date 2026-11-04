// Author: Codex
// Description: Start native Next.js development server with Windows Node.js 26 preload safety patch.

const path = require('node:path');
const { spawn } = require('node:child_process');
const { buildPcnChildEnv } = require('./native-dev-env.cjs');

const projectRoot = path.resolve(__dirname, '..');
const preloadPath = path.resolve(__dirname, 'native-dev-preload.cjs');
const nextBinPath = path.resolve(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const childEnv = buildPcnChildEnv({ projectRoot, env: process.env });

const nodeOptions = childEnv.NODE_OPTIONS || '';
childEnv.NODE_OPTIONS = nodeOptions.includes(preloadPath)
  ? nodeOptions
  : `${nodeOptions} --require=${preloadPath}`.trim();

const port = process.env.PORT || '1357';
const child = spawn(process.execPath, [nextBinPath, 'dev', '-p', String(port), '--webpack'], {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit',
  windowsHide: false,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.once('error', (error) => {
  console.error(`Next.js dev server failed to start: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
