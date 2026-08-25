import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  mergeColumnConfig,
  shouldPersistColumnConfig,
} from '../utils/columnConfigPersistence';

const defaults: Array<{ id: string; label: string; width: number; visible: boolean }> = [
  { id: 'stt', label: '#', width: 40, visible: true },
  { id: 'requestCode', label: 'Số phiếu', width: 120, visible: true },
  { id: 'customerName', label: 'Khách hàng', width: 160, visible: true },
  { id: 'newColumn', label: 'Cột mới', width: 100, visible: true },
];

test('restores saved column order while keeping new default columns', () => {
  const restored = mergeColumnConfig(defaults, [
    { id: 'stt', width: 40, visible: true },
    { id: 'customerName', width: 240, visible: false },
    { id: 'requestCode', width: 140, visible: true },
  ]);

  assert.deepEqual(restored.map(column => column.id), [
    'stt',
    'customerName',
    'requestCode',
    'newColumn',
  ]);
  assert.equal(restored[1].width, 240);
  assert.equal(restored[1].visible, false);
});

test('does not persist until the active user configuration has finished loading', () => {
  assert.equal(shouldPersistColumnConfig(null, 'tester'), false);
  assert.equal(shouldPersistColumnConfig('admin', 'tester'), false);
  assert.equal(shouldPersistColumnConfig('tester', 'tester'), true);
});

test('both table views use the shared loader and guarded persistence', () => {
  for (const fileName of ['components/SummaryLogView.tsx', 'components/KQTNView.tsx']) {
    const source = fs.readFileSync(new URL(`../${fileName}`, import.meta.url), 'utf8');
    assert.match(source, /mergeColumnConfig\(DEFAULT_COLUMNS, parsed\)/, fileName);
    assert.match(source, /shouldPersistColumnConfig\(loadedColumnsUsername, currentUsername\)/, fileName);
  }
});
