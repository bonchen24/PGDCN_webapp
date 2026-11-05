import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGD workspace puts dossier owner, document generation, checklist, and package actions on the request card', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  const operations = read('components/PgdDossierOperationsPanel.tsx');
  assert.match(workspace, /PgdCaseEvidencePanel/);
  assert.match(operations, /Người phụ trách hồ sơ PGD/);
  assert.match(operations, /PgdDocumentGenerationPanel/);
  assert.match(operations, /Bộ hồ sơ & đóng gói/);
  assert.match(operations, /attachGeneratedDocument/);
  assert.match(operations, /getCurrentPgdDossierDocuments/);
  assert.match(operations, /getPgdDossierPackageUrl/);
  assert.match(operations, /missingRequirementCodes/);
  assert.match(operations, /Đang đóng gói/);
  assert.match(workspace, /ownerUsername/);
});

test('PGD dossier operations keeps owner status and lock policy without a second owner editor or creator fallback', () => {
  const operations = read('components/PgdDossierOperationsPanel.tsx');
  assert.match(operations, /ownerUsername \|\| 'Chưa gán'/);
  assert.match(operations, /lockedReason && <p/);
  assert.doesNotMatch(operations, /aria-label="Chọn người phụ trách hồ sơ PGD"/);
  assert.doesNotMatch(operations, /Lưu chủ hồ sơ/);
  assert.doesNotMatch(operations, /request\.ownerUsername \|\| currentUser\?\.username/);
});
