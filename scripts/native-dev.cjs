// Author: Codex
// Description: Start the Windows-native dev server with the local Docker
// Supabase/PaddleOCR services reachable from the host machine.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const preloadPath = path.resolve(__dirname, 'native-dev-preload.cjs');
const tsxCliPath = path.resolve(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

function readEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split(/\r?\n/).reduce((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return values;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) return values;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      values[key] = value;
      return values;
    }, {});
  } catch {
    return {};
  }
}

function addNodePreload(nodeOptions) {
  if (nodeOptions.includes(preloadPath)) return nodeOptions;
  return `${nodeOptions} --require=${preloadPath}`.trim();
}

const dockerEnvFile = process.env.SUPABASE_DOCKER_ENV_FILE || path.resolve(
  __dirname,
  '..',
  '..',
  'TVCI_APP',
  'supabase-docker',
  '.env',
);
const dockerEnv = readEnvFile(dockerEnvFile);
const childEnv = { ...process.env };

const serviceRoleKey = childEnv.SUPABASE_SERVICE_ROLE_KEY ||
  childEnv.SERVICE_ROLE_KEY ||
  dockerEnv.SUPABASE_SERVICE_ROLE_KEY ||
  dockerEnv.SERVICE_ROLE_KEY;
if (!childEnv.SUPABASE_SERVICE_ROLE_KEY && serviceRoleKey) {
  childEnv.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
}

if (!childEnv.SUPABASE_STORAGE_URL) {
  childEnv.SUPABASE_STORAGE_URL = dockerEnv.SUPABASE_STORAGE_URL || 'http://127.0.0.1:8000/storage/v1';
}
if (!childEnv.SUPABASE_STORAGE_BUCKET) {
  childEnv.SUPABASE_STORAGE_BUCKET = dockerEnv.SUPABASE_STORAGE_BUCKET || 'ddt-files';
}
if (!childEnv.OCR_SERVICE_URL) {
  childEnv.OCR_SERVICE_URL = 'http://127.0.0.1:8100';
}
childEnv.NODE_OPTIONS = addNodePreload(childEnv.NODE_OPTIONS || '');

const child = spawn(process.execPath, [tsxCliPath, 'server.ts'], {
  cwd: projectRoot,
  env: childEnv,
  stdio: 'inherit',
  windowsHide: false,
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', (error) => {
  console.error('Native dev server failed to start:', error);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
