import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { normalizePcnDocumentWaiverPatch } from '../utils/pcnDocumentWaivers.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const dossierApiSource = fs.readFileSync(new URL('../utils/pcnDossierApi.ts', import.meta.url), 'utf8');

test('document waiver patches require a reason and normalize keys', () => {
  assert.deepEqual(normalizePcnDocumentWaiverPatch({
    ' QC4-ASSIGNMENT ': { reason: '  Không áp dụng trong phạm vi. ' },
    'QC4-OPTIONAL': null,
  }), {
    values: {
      'QC4-ASSIGNMENT': { reason: 'Không áp dụng trong phạm vi.' },
      'QC4-OPTIONAL': null,
    },
    errors: {},
  });
  assert.equal(normalizePcnDocumentWaiverPatch({ 'QC4-ASSIGNMENT': { reason: ' ' } }).errors['QC4-ASSIGNMENT'], 'Lý do bỏ qua tài liệu là bắt buộc.');
});

test('document waiver mutation is part of the PCN dossier boundary and is audited server-side', () => {
  assert.match(dossierApiSource, /documentWaivers/);
  assert.match(serverSource, /documentWaivers/);
  assert.match(serverSource, /mergePcnDocumentWaivers/);
  assert.match(serverSource, /actor\.username/);
  assert.match(serverSource, /new Date\(\)\.toISOString\(\)/);
  assert.match(serverSource, /withPgTransaction/);
});

test('indirect PYC and KQTN status changes reuse the same five-step gate', () => {
  const labRequestCreationRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/lab-requests'"),
    serverSource.indexOf("app.post('/api/pcn/lab-requests/:requestId/status'"),
  );
  const labRequestStatusRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/lab-requests/:requestId/status'"),
    serverSource.indexOf("app.post('/api/pcn/samples/lots'"),
  );
  const resultRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/results'"),
    serverSource.indexOf("app.post('/api/pcn/lab-requests'"),
  );

  assert.match(labRequestStatusRoute, /getPcnDossierStageGateDenial/);
  assert.match(labRequestStatusRoute, /nextStatus:\s*'SENT_TO_LAB'/);
  assert.match(labRequestStatusRoute, /canCreatePcnLabRequest/);
  assert.match(labRequestStatusRoute, /collection_name = 'dossierDocuments'/);
  assert.doesNotMatch(labRequestStatusRoute, /collection_name = 'pcnDossierDocuments'/);
  assert.match(labRequestCreationRoute, /canCreatePcnLabRequest/);
  assert.match(resultRoute, /getPcnDossierStageGateDenial/);
  assert.match(resultRoute, /nextStatus:\s*nextDossierStatus/);
  assert.match(resultRoute, /collection_name = 'dossierDocuments'/);
  assert.doesNotMatch(resultRoute, /collection_name = 'pcnDossierDocuments'/);
});
