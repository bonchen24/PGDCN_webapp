import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('PCN template catalog projects a safe reason for private asset verification failures', () => {
  const catalogRoute = serverSource.slice(serverSource.indexOf('if (DATABASE_PROFILE === \'pcn\' && collectionName === \'pcnTemplateDefinitions\')'));

  assert.match(catalogRoute, /privateAssetVerificationIssue/);
  assert.match(catalogRoute, /MISSING_ASSET/);
  assert.match(catalogRoute, /ASSET_NOT_FOUND/);
  assert.match(catalogRoute, /SOURCE_DOCUMENT_MISMATCH/);
  assert.match(catalogRoute, /MIME_TYPE_MISMATCH/);
  assert.match(catalogRoute, /BYTE_SIZE_MISMATCH/);
  assert.match(catalogRoute, /SHA256_MISMATCH/);
  assert.match(catalogRoute, /privateAssetVerified/);
});

test('PCN template verification projections are stripped before generic persistence', () => {
  assert.match(serverSource, /delete data\.privateAssetVerified/);
  assert.match(serverSource, /delete data\.privateAssetVerificationIssue/);
});

test('PCN template runtime responses do not expose authoring provenance', () => {
  assert.match(serverSource, /toPcnTemplateRuntimeProjection\(item as PcnTemplateDefinition\)/);
  assert.match(serverSource, /res\.json\(\{ \.\.\.result, template: toPcnTemplateRuntimeProjection\(result\.template\) \}\)/);
  assert.doesNotMatch(serverSource, /sourceRelativePath.*res\.json/);
});

test('PCN template verification accepts the MIME type declared by the catalog format', () => {
  const catalogRoute = serverSource.slice(serverSource.indexOf("if (DATABASE_PROFILE === 'pcn' && collectionName === 'pcnTemplateDefinitions')"));

  assert.match(catalogRoute, /const expectedMimeType = item\.format === 'DOC'/);
  assert.match(catalogRoute, /application\/msword/);
  assert.match(catalogRoute, /asset\.mime_type !== expectedMimeType/);
});
