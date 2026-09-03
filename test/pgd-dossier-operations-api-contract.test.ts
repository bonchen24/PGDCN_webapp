import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGD dossier operations expose owner, generated-document attachment, and package APIs', () => {
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  const server = read('server.ts');
  assert.match(api, /requests\/\$\{encodeURIComponent\(requestId\)\}\/owner/);
  assert.match(api, /attachPgdGeneratedDocument/);
  assert.match(api, /getPgdDossierPackageUrl/);
  assert.match(store, /assignOwner/);
  assert.match(store, /attachGeneratedDocument/);
  assert.match(server, /api\/pgd\/requests\/:requestId\/owner/);
  assert.match(server, /split_part\(lower\(COALESCE\(data->>'username'/);
  assert.match(server, /attach-generated/);
  assert.match(server, /api\/pgd\/requests\/:requestId\/package/);
  assert.match(server, /buildPgdDossierPackageManifest/);
  assert.match(server, /buildPgdDossierPackageSnapshot/);
  assert.match(server, /packageManifestHash/);
  assert.match(server, /ROW_NUMBER\(\) OVER/);
  assert.match(server, /resolvePgdTemplateSourcePath/);
});
