// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for RequestModal draft persistence and reset behavior
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const draftUtilityUrl = new URL('../utils/requestDraft.ts', import.meta.url);
const requestModalSource = fs.readFileSync(new URL('../components/RequestModal.tsx', import.meta.url), 'utf8');

test('request draft utility scopes keys by normalized account identity', async () => {
  assert.equal(fs.existsSync(draftUtilityUrl), true, 'Missing request draft utility');
  const { getRequestDraftKey } = await import(draftUtilityUrl.href);

  assert.equal(getRequestDraftKey(' Nguyễn Văn A '), getRequestDraftKey('nguyen van a'));
  assert.notEqual(getRequestDraftKey('nguyen van a'), getRequestDraftKey('tran van b'));
  assert.match(getRequestDraftKey('nguyen van a'), /request-modal-draft/);
});

test('request draft payload excludes transient OCR files', async () => {
  assert.equal(fs.existsSync(draftUtilityUrl), true, 'Missing request draft utility');
  const { buildRequestModalDraft } = await import(draftUtilityUrl.href);
  const draft = buildRequestModalDraft({
    generalInfo: { requestCode: 'DDT-001' },
    sampleList: [{ modelName: 'Model A' }],
    currentSample: { modelName: 'Model B' },
    useCustomerInfoForInvoice: false,
    scanFiles: [{ mimeType: 'image/png', data: 'base64-data' }]
  } as any);

  assert.equal(draft.version, 1);
  assert.deepEqual(draft.payload.generalInfo, { requestCode: 'DDT-001' });
  assert.equal('scanFiles' in draft.payload, false);
});

test('RequestModal offers draft restore/delete and keeps the modal open after reset', () => {
  assert.match(requestModalSource, /loadRequestModalDraft/);
  assert.match(requestModalSource, /saveRequestModalDraft/);
  assert.match(requestModalSource, /deleteRequestModalDraft/);
  assert.match(requestModalSource, /Xóa bản nháp/);
  assert.match(requestModalSource, /draftResetToken/);

  const deleteHandlerStart = requestModalSource.indexOf('const handleDeleteRequestDraft');
  const deleteHandlerEnd = requestModalSource.indexOf('const ', deleteHandlerStart + 10);
  assert.ok(deleteHandlerStart >= 0, 'Missing draft delete handler');
  const deleteHandler = requestModalSource.slice(deleteHandlerStart, deleteHandlerEnd);
  assert.match(deleteHandler, /setDraftResetToken/);
  assert.doesNotMatch(deleteHandler, /onClose\s*\(/);
});

// --- End of request-modal-draft.test.ts ---
