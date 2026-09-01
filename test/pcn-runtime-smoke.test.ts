import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts?: Record<string, string>;
};
const scriptSource = fs.readFileSync(new URL('../scripts/smokePcnRuntime.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PCN runtime smoke command is registered and read-only for business data', () => {
  assert.equal(typeof packageJson.scripts?.['smoke:pcn-runtime'], 'string');
  assert.match(packageJson.scripts?.['smoke:pcn-runtime'] || '', /smokePcnRuntime\.ts/);
  assert.match(scriptSource, /PCN_SMOKE_BASE_URL/);
  assert.match(scriptSource, /PCN_SMOKE_USERNAME/);
  assert.match(scriptSource, /PCN_SMOKE_PASSWORD/);
  assert.match(scriptSource, /\/api\/health/);
  assert.match(scriptSource, /\/api\/auth\/pcn-session/);
  assert.match(scriptSource, /\/api\/db\/health/);
  assert.match(scriptSource, /\/api\/db\/certificationDossiers/);
  assert.match(scriptSource, /\/api\/pcn\/documents\/generate/);
  assert.match(scriptSource, /dryRun: true/);
  assert.match(scriptSource, /payload\.documents\.length === 0/);
  assert.match(scriptSource, /payload\.activityLogs\.length === 0/);
  assert.match(scriptSource, /\/api\/pcn\/settings/);
  assert.match(scriptSource, /\/api\/pcn\/ocr/);
  assert.match(scriptSource, /\/api\/backups/);
  assert.match(scriptSource, /\/verify/);
  assert.doesNotMatch(scriptSource, /\/api\/backups\/run/);
  assert.doesNotMatch(scriptSource, /\/restore/);
  assert.doesNotMatch(scriptSource, /\/api\/pcn\/(proposals|dossiers|pyc|kqtn|issuance)/i);
  assert.doesNotMatch(scriptSource, /console\.log\([^)]*password/i);
  assert.match(designSource, /Smoke runtime PCN/);
  assert.match(designSource, /không tạo\/sửa\/xóa hồ sơ/);
});

test('PCN runtime smoke checks the public application shell before authentication', () => {
  assert.match(scriptSource, /runCheck\(\s*'public app shell'[\s\S]{0,260}request\('\/'\)/);
  assert.match(scriptSource, /Phòng Chứng nhận - TVCI/);
});
