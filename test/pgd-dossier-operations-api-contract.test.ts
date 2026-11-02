import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGD dossier operations expose owner, generated-document attachment, and package APIs', () => {
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  const server = read('server.legacy.ts');
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
  assert.match(server, /const manifest = error\?\.manifest/);
  assert.match(server, /assetId: entry\.assetId/);
  assert.match(server, /packageManifestHash/);
  assert.match(server, /ROW_NUMBER\(\) OVER/);
  assert.match(server, /resolvePgdTemplateSourcePath/);
});

test('custom PGD checklist confirmation verifies the current file provenance before satisfying the gate', () => {
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  const confirmRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/confirm/route.ts');
  assert.match(api, /confirmPgdDossierDocument/);
  assert.match(store, /confirmDossierDocument/);
  assert.match(confirmRoute, /requirePgdCollectionMutation/);
  assert.match(confirmRoute, /assertPgdRequestStationMutationAllowed/);
  assert.match(confirmRoute, /requirement\.customDefinition/);
  assert.match(confirmRoute, /ORDER BY COALESCE\(\(data->>'version'\)::int, 0\) DESC/);
  assert.match(confirmRoute, /source_collection/);
  assert.match(confirmRoute, /source_document_id/);
  assert.match(confirmRoute, /source_json_path/);
  assert.match(confirmRoute, /sha256/);
  assert.match(confirmRoute, /'CONFIRMED'/);
  assert.match(confirmRoute, /requirement\.stageLabel/);
});

test('custom PGD upload and generated attachment preserve stage context in the audit log', () => {
  const uploadRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/route.ts');
  const attachRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/attach-generated/route.ts');
  const confirmRoute = read('app/api/pgd/requests/[requestId]/dossier-documents/confirm/route.ts');
  for (const route of [uploadRoute, attachRoute, confirmRoute]) {
    assert.match(route, /workflowSnapshot\?\.stages/);
    assert.match(route, /getPgdDossierRequirementStationKeyForSnapshot/);
  }
  for (const route of [uploadRoute, attachRoute]) {
    assert.match(route, /requirement\.stageLabel/);
    assert.match(route, /writePgdActivity/);
  }
});

test('final PGD lab review persists conditional checklist applicability in the request snapshot', () => {
  const reviewRoute = read('app/api/pgd/lab-result-reviews/route.ts');
  const api = read('utils/pgdApi.ts');
  const store = read('store-pgd.ts');
  assert.match(reviewRoute, /applyPgdDossierConditionalRequirements/);
  assert.match(reviewRoute, /dossierChecklist/);
  assert.match(reviewRoute, /getDocumentPayload\(nextRequest\)/);
  assert.match(api, /request: payload\.request as PgdInspectionRequest/);
  assert.match(store, /if \(result\.request\) mergeRequest/);
});
