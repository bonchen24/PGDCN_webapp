import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const schema = fs.readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');

test('PCN schema contains only the shared JSON document and file metadata primitives', () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS app_documents/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS file_assets/);
  assert.match(schema, /collection_name\s+(?:TEXT|VARCHAR\(100\)) NOT NULL/);
  assert.match(schema, /payload|data\s+JSONB/);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS requests/);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS handover_docs/);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS kqtn_records/);
  assert.match(schema, /CREATE OR REPLACE FUNCTION prevent_pcn_activity_log_mutation/);
  assert.match(schema, /CREATE TRIGGER trg_pcn_activity_logs_append_only/);
  assert.match(schema, /pcnCertificationFields/);
  assert.match(schema, /pcnDocumentRequirements/);
  assert.match(schema, /dossierDocuments/);
  assert.match(schema, /QC4-PROPOSAL/);
  assert.match(schema, /QC9-SAMPLE_RETURN/);
  assert.match(schema, /QC4/);
  assert.match(schema, /QC9/);
  assert.match(schema, /pcnDepartmentRoles/);
  assert.match(schema, /luongxuanhung/);
  assert.match(schema, /tranhoangphuong/);
  assert.match(schema, /vuthitham/);
  assert.match(schema, /PCN_INITIAL_IMPORT/);
  assert.match(schema, /ON CONFLICT \(collection_name, document_id\) DO UPDATE/);
  assert.match(schema, /stationKeys/);
  assert.match(schema, /idx_pcn_sample_lots_lot_code_ci/);
  assert.match(schema, /LOWER\(data->>'lotCode'\)/);
  assert.match(schema, /idx_pcn_lab_requests_pyc_number_ci/);
  assert.match(schema, /idx_pcn_lab_requests_sample_route/);
});

test('PCN server collection allowlist names only PCN business collections', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const pcnBlock = server.slice(server.indexOf('const PCN_DB_COLLECTIONS'), server.indexOf('function getDbCollection'));

  assert.match(pcnBlock, /pcnCertificationFields/);
  assert.match(pcnBlock, /pcnDocumentRequirements/);
  assert.match(pcnBlock, /dossierDocuments/);
  assert.match(pcnBlock, /certificationProposals/);
  assert.match(pcnBlock, /certificationDossiers/);
  assert.match(pcnBlock, /labRequests/);
  assert.match(pcnBlock, /returnedResults/);
  assert.match(pcnBlock, /pcnSampleLots/);
  assert.match(pcnBlock, /pcnSampleRoutes/);
  assert.match(pcnBlock, /pcnSampleFlowEvents/);
  assert.match(pcnBlock, /approvalSteps/);
  assert.match(pcnBlock, /issuancePackages/);
  assert.doesNotMatch(pcnBlock, /"requests"/);
  assert.doesNotMatch(pcnBlock, /"handoverDocs"/);
  assert.doesNotMatch(pcnBlock, /"kqtnRecords"/);
  assert.match(server, /ACTIVE_DB_COLLECTIONS/);
  assert.doesNotMatch(pcnBlock, /pcnSchemeBranches|branchCodes|branchCode/);
});

// --- End of pcn-schema-contract.test.ts ---
