// Author: Codex
// Description: Start the native PCN development server without a legacy DDT path dependency.

const path = require('node:path');
const { spawn, execSync } = require('node:child_process');
const { buildPcnChildEnv } = require('./native-dev-env.cjs');

const projectRoot = path.resolve(__dirname, '..');
const preloadPath = path.resolve(__dirname, 'native-dev-preload.cjs');
const tsxCliPath = path.resolve(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const childEnv = buildPcnChildEnv({ projectRoot, env: process.env });

// Free port 1357 if an orphaned process from a previous run is lingering on Windows
if (process.platform === 'win32') {
  try {
    const port = childEnv.PORT || '1357';
    const stdout = execSync(`netstat -ano -p tcp | findstr :${port} | findstr LISTENING`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0' && pid !== String(process.pid)) {
        try {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        } catch (_) {}
      }
    }
  } catch (_) {}
}

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
  process.on(signal, () => {
    if (process.platform === 'win32' && child.pid) {
      try {
        execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      } catch (_) {}
    } else {
      child.kill(signal);
    }
  });
}

child.once('error', (error) => {
  console.error(`Native PCN server failed to start: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
