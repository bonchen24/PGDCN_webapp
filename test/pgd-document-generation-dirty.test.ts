import assert from 'node:assert/strict';
import test from 'node:test';

import * as documentPanel from '../components/PgdDocumentGenerationPanel.tsx';

const createSnapshot = (documentPanel as typeof documentPanel & {
  createPgdDraftDirtySnapshot?: (
    format: string,
    cellValues: Record<string, unknown>,
    editableCellKeys: string[],
  ) => string;
}).createPgdDraftDirtySnapshot;

test('PGD draft snapshots compare format and nested table content, not object identity', () => {
  assert.equal(typeof createSnapshot, 'function', 'the panel must expose its semantic draft snapshot helper');
  if (typeof createSnapshot !== 'function') return;

  const original = {
    requestCode: 'PGD-01',
    eventRows: [
      { time: '08:00', activity: 'Kiểm tra', actor: 'an' },
      { time: '09:00', activity: 'Lấy mẫu', actor: 'binh' },
    ],
  };
  const hydratedAgain = {
    eventRows: [
      { actor: 'an', activity: 'Kiểm tra', time: '08:00' },
      { actor: 'binh', activity: 'Lấy mẫu', time: '09:00' },
    ],
    requestCode: 'PGD-01',
  };

  const baseline = createSnapshot('DOCX', original, ['eventRows', 'requestCode']);
  assert.equal(createSnapshot('DOCX', hydratedAgain, ['requestCode', 'eventRows']), baseline);
  assert.notEqual(createSnapshot('PDF', hydratedAgain, ['requestCode', 'eventRows']), baseline);
  assert.notEqual(createSnapshot('DOCX', { ...hydratedAgain, requestCode: 'PGD-02' }, ['requestCode', 'eventRows']), baseline);
  assert.notEqual(createSnapshot('DOCX', { ...hydratedAgain, eventRows: [...hydratedAgain.eventRows].reverse() }, ['requestCode', 'eventRows']), baseline);
});
