import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const apiSource = fs.readFileSync(new URL('../utils/pcnLabRequestApi.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const dossierSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const labRequestSource = fs.readFileSync(new URL('../components/PcnLabRequestView.tsx', import.meta.url), 'utf8');
const modalSource = fs.readFileSync(new URL('../components/PcnLabRequestDetailModal.tsx', import.meta.url), 'utf8');
const operationsSource = fs.readFileSync(new URL('../components/PcnLabOperationsView.tsx', import.meta.url), 'utf8');

test('canonical PYC card exposes dispatch and reconcile actions through the server boundary', () => {
  assert.match(apiSource, /\/api\/pcn\/lab-requests\/\$\{encodeURIComponent\(requestId\)\}\/dispatch/);
  assert.match(apiSource, /\/api\/pcn\/lab-requests\/\$\{encodeURIComponent\(requestId\)\}\/reconcile/);
  assert.match(storeSource, /dispatchLabRequest/);
  assert.match(storeSource, /reconcileLabRequest/);
  assert.match(workspaceSource, /dispatchLabRequest/);
  assert.match(dossierSource, /onDispatchLabRequest/);
  assert.match(labRequestSource, /onDispatchLabRequest/);
  assert.match(modalSource, /integration/);
  assert.match(modalSource, /Đồng bộ lại/);
  assert.match(operationsSource, /sample-register-grid/);
  assert.match(operationsSource, /Tạo Phiếu yêu cầu thử nghiệm/);
  assert.match(operationsSource, /PcnSampleRequestBundleModal/);
});

test('sample register keeps mutations behind the bundle callbacks and does not fetch from the grid', () => {
  assert.doesNotMatch(operationsSource, /fetch\(/);
  assert.match(operationsSource, /onSaveBundle/);
  assert.match(operationsSource, /onSendBundle/);
  assert.match(operationsSource, /onRetryBundleDispatch/);
  assert.match(operationsSource, /onOpenDossier/);
  assert.match(dossierSource, /onSaveLabRequest/);
  assert.match(dossierSource, /onUpdateLabRequest/);
});

// --- End of pcn-lab-request-ui.test.ts ---
