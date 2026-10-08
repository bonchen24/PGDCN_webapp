// Author: Codex
// Description: Resolve non-secret runtime wiring for the native PCN server.

const fs = require('node:fs');
const path = require('node:path');

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

function readSupabaseEnv(projectRoot, env) {
  const explicitFile = String(env.SUPABASE_DOCKER_ENV_FILE || '').trim();
  const projectEnvFile = path.resolve(projectRoot, '.env');
  const sharedDockerEnvFile = path.resolve(projectRoot, '..', 'TVCI_APP', 'supabase-docker', '.env');
  const files = explicitFile
    ? [projectEnvFile, explicitFile]
    : [sharedDockerEnvFile, projectEnvFile];

  return Array.from(new Set(files)).reduce((values, filePath) => ({
    ...values,
    ...readEnvFile(filePath),
  }), {});
}

function buildPcnChildEnv({ projectRoot, env = process.env }) {
  const fileEnv = readSupabaseEnv(projectRoot, env);
  const childEnv = { ...env };
  const serviceRoleKey = String(
    env.SUPABASE_SERVICE_ROLE_KEY
      || env.SERVICE_ROLE_KEY
      || fileEnv.SUPABASE_SERVICE_ROLE_KEY
      || fileEnv.SERVICE_ROLE_KEY
      || '',
  ).trim();

  childEnv.APP_PROFILE = 'pcn';
  childEnv.PORT = '1357';
  childEnv.TEMP = path.resolve(projectRoot, 'tmp');
  childEnv.TMP = path.resolve(projectRoot, 'tmp');
  childEnv.SUPABASE_STORAGE_URL = String(
    env.SUPABASE_STORAGE_URL || fileEnv.SUPABASE_STORAGE_URL || 'http://127.0.0.1:8000/storage/v1',
  ).trim();
  if (!childEnv.SUPABASE_SERVICE_ROLE_KEY && serviceRoleKey) childEnv.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  childEnv.PCN_STORAGE_BUCKET = String(
    env.PCN_STORAGE_BUCKET || fileEnv.PCN_STORAGE_BUCKET || fileEnv.SUPABASE_STORAGE_BUCKET || 'pcn-files',
  ).trim() || 'pcn-files';
  childEnv.OCR_SERVICE_URL = String(env.OCR_SERVICE_URL || 'http://127.0.0.1:8100').trim();

  return childEnv;
}

module.exports = {
  buildPcnChildEnv,
};
