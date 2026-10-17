import assert from 'node:assert/strict';
import test from 'node:test';

import * as workspace from '../components/PgdDraftingWorkspaceView.tsx';

const confirmContextSwitch = (workspace as typeof workspace & {
  confirmPgdDraftContextSwitch?: (
    currentTitle: string,
    savedOrLoadedTitle: string,
    documentDirty: boolean,
    confirmDiscard: (message: string) => boolean,
  ) => boolean;
}).confirmPgdDraftContextSwitch;

test('PGD context switch warns once for dirty title or document and skips clean drafts', () => {
  assert.equal(typeof confirmContextSwitch, 'function', 'the workspace must expose its combined context-switch guard');
  if (typeof confirmContextSwitch !== 'function') return;

  let promptCount = 0;
  let promptMessage = '';
  const decline = (message: string) => {
    promptCount += 1;
    promptMessage = message;
    return false;
  };

  assert.equal(confirmContextSwitch('Bản A', 'Bản A', false, decline), true);
  assert.equal(promptCount, 0);

  assert.equal(confirmContextSwitch('Bản A đã sửa', 'Bản A', false, decline), false);
  assert.equal(promptCount, 1);
  assert.match(promptMessage, /tiêu đề hoặc nội dung tài liệu/i);

  assert.equal(confirmContextSwitch('Bản A', 'Bản A', true, decline), false);
  assert.equal(promptCount, 2);
  assert.equal(confirmContextSwitch('Bản A đã sửa', 'Bản A', true, decline), false);
  assert.equal(promptCount, 3);

  let acceptedPromptCount = 0;
  assert.equal(confirmContextSwitch('Bản A đã sửa', 'Bản A', true, () => {
    acceptedPromptCount += 1;
    return true;
  }), true);
  assert.equal(acceptedPromptCount, 1);
});
