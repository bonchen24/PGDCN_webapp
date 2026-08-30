import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, root), 'utf8');
}

test('PCN uses native Windows development port 1357 and Docker production port 2357', () => {
  const server = read('server.ts');
  const envExample = read('.env.example');
  const dockerfile = read('Dockerfile');
  const dockerCompose = read('docker-compose.yml');
  const supabaseCompose = read('docker-compose.supabase.yml');
  const compose = read('docker-compose.pcn.yml');
  const viteConfig = read('vite.config.ts');
  const deployScript = read('deploy.sh');
  const readme = read('README.md');
  const design = read('design.md');
  const packageJson = JSON.parse(read('package.json'));

  assert.match(server, /process\.env\.NODE_ENV === ['"]production['"] \? 2357 : 1357/);
  assert.match(envExample, /^PORT=1357$/m);
  assert.match(dockerfile, /^ENV PORT=2357$/m);
  assert.match(dockerfile, /^EXPOSE 2357$/m);
  assert.match(dockerCompose, /PORT:\s*2357/);
  assert.match(dockerCompose, /- ['"]2357:2357['"]/);
  assert.match(supabaseCompose, /PORT:\s*2357/);
  assert.match(supabaseCompose, /- ['"]2357:2357['"]/);
  assert.match(compose, /^      PORT: 2357$/m);
  assert.match(compose, /- ['"]2357:2357['"]/);
  assert.match(viteConfig, /port:\s*1357/);
  assert.match(deployScript, /localhost:2357/);
  assert.match(readme, /localhost:2357/);
  assert.match(readme, /localhost:1357/);
  assert.match(design, /PORT=1357/);
  assert.match(design, /PORT=2357/);
  assert.equal(packageJson.scripts?.['dev:pcn'], 'node ./scripts/native-dev-pcn.cjs');
  assert.match(read('scripts/native-dev-pcn.cjs'), /APP_PROFILE\s*=\s*['"]pcn['"]/);
  assert.match(design, /npm run dev:pcn/);

  const pcnRunner = read('scripts/run-pcn-tsx.cjs');
  const pcnCliScripts = [
    'migrate:pcn-customers',
    'import:pcn-history',
    'reconcile:pcn-history-attachments',
    'discover:pcn-template',
    'import:pcn-template',
    'verify:pcn-cutover',
    'smoke:pcn-runtime',
    'reconcile:pcn-legacy',
    'reconcile:pcn-orphan-results',
    'discover:pcn-history',
  ];
  assert.match(pcnRunner, /APP_PROFILE\s*=\s*['"]pcn['"]/);
  assert.match(pcnRunner, /spawn\(/);
  for (const scriptName of pcnCliScripts) {
    assert.match(packageJson.scripts?.[scriptName] || '', /run-pcn-tsx\.cjs/);
  }

  for (const [name, source] of Object.entries({
    server,
    envExample,
    dockerfile,
    dockerCompose,
    supabaseCompose,
    compose,
    viteConfig,
    deployScript,
    readme,
    design,
  })) {
    assert.doesNotMatch(source, /2359|1359/, `${name} still contains a retired PCN port`);
  }
});
