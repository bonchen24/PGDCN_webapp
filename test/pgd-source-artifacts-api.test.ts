import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PGD bootstrap and artifact mutations use dedicated PGD collections', () => {
  const source = readFileSync('utils/pgdApi.ts', 'utf8');
  const server = readFileSync('server.legacy.ts', 'utf8');
  for (const path of ['/api/pgd/inspection-plans', '/api/pgd/case-events', '/api/pgd/field-activity-logs', '/api/pgd/lab-result-reviews', '/api/pgd/dossier-indexes']) assert.match(server, new RegExp(path.replaceAll('/', '\\/')));
  assert.match(source, /savePgdInspectionPlan/);
  assert.match(server, /PGD_COLLECTIONS\.labResults[\s\S]*data->>'requestId' = \$3/);
  assert.match(server, /persistPgdArtifact[\s\S]*hồ sơ PGD khác/);
  for (const collection of ['inspectionPlans', 'caseEvents', 'fieldActivityLogs', 'labResultReviews', 'dossierIndexes']) {
    assert.match(server, new RegExp(`PGD_COLLECTIONS\\.${collection}`));
  }
  assert.match(server, /kind === 'CASE_TIMELINE'[\s\S]*kind === 'FIELD_ACTIVITY_LOG'[\s\S]*kind === 'INSPECTION_MINUTES'[\s\S]*kind === 'SAMPLE_HANDOVER'/);
  assert.match(server, /kind === 'LAB_RESULT_REVIEW'/);
});

test('artifact API does not mention Desktop, UNC or payment fields', () => {
  const source = readFileSync('utils/pgdApi.ts', 'utf8');
  assert.doesNotMatch(source, /TVCI_NAS|Desktop|\\\\/i);
  assert.doesNotMatch(source, /payment|thanh toán|phí thử nghiệm/i);
});
