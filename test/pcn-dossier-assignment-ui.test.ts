import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read = (fileName: string) => fs.readFileSync(path.resolve('components', fileName), 'utf8');

test('assignment control exposes manager assignment and staff self-claim states', () => {
  const source = read('PcnDossierAssignmentControl.tsx');

  assert.match(source, /Chưa gán người thực hiện/);
  assert.match(source, /Nhận hồ sơ/);
  assert.match(source, /getPcnAssignableDossierUsers/);
  assert.match(source, /isPcnSystemManager/);
});

test('pipeline card wires the shared assignment control and manager assignment callback', () => {
  const source = read('PcnPipelineBoard.tsx');

  assert.match(source, /PcnDossierAssignmentControl/);
  assert.match(source, /onAssignDossier/);
});

test('dossier detail uses the shared assignment control', () => {
  const source = read('PcnDossierDetailView.tsx');

  assert.match(source, /PcnDossierAssignmentControl/);
});

test('summary register limits editable rows to the dossier operator', () => {
  const gridSource = read('PgdcnDossierSummaryGrid.tsx');
  const registerSource = read('PcnOperationsRegisterView.tsx');

  assert.match(gridSource, /canEditRow/);
  assert.match(registerSource, /getPcnDossierOperatorDenial/);
  assert.match(registerSource, /currentUser/);
});
