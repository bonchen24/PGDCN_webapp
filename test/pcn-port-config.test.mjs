import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, root), 'utf8');
}

test('PCN uses native Windows development port 1357 and Docker production port 2357', () => {
  const envExample = read('.env.example');
  const dockerfile = read('Dockerfile');
  const dockerCompose = read('docker-compose.yml');
  const supabaseCompose = read('docker-compose.supabase.yml');
  const compose = read('docker-compose.pcn.yml');
  const deployScript = read('deploy.sh');
  const readme = read('README.md');
  const design = read('design.md');
  const packageJson = JSON.parse(read('package.json'));

  assert.match(envExample, /^PORT=1357$/m);
  assert.match(dockerfile, /^ENV PORT=2357$/m);
  assert.match(dockerfile, /^EXPOSE 2357$/m);
  assert.match(dockerCompose, /PORT:\s*2357/);
  assert.match(dockerCompose, /- ['"]2357:2357['"]/);
  assert.match(supabaseCompose, /PORT:\s*2357/);
  assert.match(supabaseCompose, /- ['"]2357:2357['"]/);
  assert.match(compose, /^      PORT: 2357$/m);
  assert.match(compose, /- ['"]2357:2357['"]/);
  assert.match(deployScript, /localhost:2357/);
  assert.match(readme, /localhost:2357/);
  assert.match(readme, /localhost:1357/);
  assert.match(design, /PORT=1357/);
  assert.match(design, /PORT=2357/);
  assert.equal(packageJson.scripts?.['dev:pcn'], 'node ./scripts/run-next-dev.cjs');
  assert.equal(packageJson.scripts?.['dev:server'], undefined);
  assert.equal(packageJson.scripts?.['start:server'], undefined);
  const devLauncher = read('scripts/run-next-dev.cjs');
  const startLauncher = read('scripts/run-next-start.cjs');
  const nativeEnv = read('scripts/native-dev-env.cjs');
  assert.match(devLauncher, /buildPcnChildEnv/);
  assert.match(devLauncher, /const port = process\.env\.PORT \|\| ['"]1357['"]/);
  assert.match(devLauncher, /nextBinPath, ['"]dev['"], ['"]-p['"], String\(port\)/);
  assert.match(startLauncher, /const port = process\.env\.PORT \|\| ['"]2357['"]/);
  assert.match(startLauncher, /nextBinPath, ['"]start['"], ['"]-p['"], String\(port\)/);
  assert.match(nativeEnv, /APP_PROFILE\s*=\s*['"]pcn['"]/);
  assert.match(nativeEnv, /PORT\s*=\s*['"]1357['"]/);
  assert.match(nativeEnv, /PCN_STORAGE_BUCKET/);
  assert.match(nativeEnv, /SUPABASE_STORAGE_URL/);
  assert.match(nativeEnv, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(devLauncher, /TVCI_APP|supabase-docker|Desktop/);
  assert.match(design, /npm run dev:pcn/);

  assert.equal(packageJson.scripts?.['dev'], 'node ./scripts/run-next-dev.cjs');
  assert.equal(packageJson.scripts?.['dev:pcn'], 'node ./scripts/run-next-dev.cjs');
  assert.equal(packageJson.scripts?.['dev:next'], 'node ./scripts/run-next-dev.cjs');
  assert.equal(packageJson.scripts?.['start'], 'node ./scripts/run-next-start.cjs');
  assert.equal(packageJson.scripts?.['start:next'], 'node ./scripts/run-next-start.cjs');
  assert.equal(packageJson.scripts?.['build'], 'next build --webpack');
  assert.match(nativeEnv, /PORT\s*=\s*['"]1357['"]/);
  assert.match(read('scripts/run-pcn-tsx.cjs'), /APP_PROFILE\s*=\s*['"]pcn['"]/);

  // The active PCN example intentionally documents the internal DDT target
  // on port 2359; that is a room-app port, not a retired PCN port.
  const envExampleForPcnPortCheck = envExample.replaceAll('http://ddt_webapp-webapp:2359', '');
  const designForPcnPortCheck = design.replaceAll('ddt_webapp-webapp:2359', '');

  for (const [name, source] of Object.entries({
    devLauncher,
    startLauncher,
    envExample: envExampleForPcnPortCheck,
    dockerfile,
    dockerCompose,
    supabaseCompose,
    compose,
    deployScript,
    readme,
    design: designForPcnPortCheck,
  })) {
    assert.doesNotMatch(source, /2359|1359/, `${name} still contains a retired PCN port`);
  }
});
