// Author: Gemini
// OS support: Web/Node
// Description: Tests for removing temporary report images before KQTN persistence

import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { stripTransientKqtnImages } from '../utils/transientReportImages.js';

test('stripTransientKqtnImages removes report and EMC image fields but keeps report data', () => {
  const source = {
    reportNo: 'ITD-001',
    testResultsData: { result: 'PASS' },
    productPhoto1: 'data:image/jpeg;base64,PRODUCT',
    productPhoto2: 'data:image/jpeg;base64,PRODUCT2',
    nameplatePhoto1: 'data:image/png;base64,NAMEPLATE',
    nameplatePhoto2: 'data:image/png;base64,NAMEPLATE2',
    nameplatePhotos: ['data:image/png;base64,NAMEPLATE'],
    emcData: {
      voltage: '220 V',
      images: { label: 'data:image/png;base64,LABEL', phaseL: 'data:image/png;base64,PHASE' },
    },
  };

  const persisted = stripTransientKqtnImages(source);

  assert.deepEqual(persisted, {
    reportNo: 'ITD-001',
    testResultsData: { result: 'PASS' },
    emcData: { voltage: '220 V' },
  });
  assert.equal(source.productPhoto1, 'data:image/jpeg;base64,PRODUCT');
  assert.deepEqual(source.emcData.images, { label: 'data:image/png;base64,LABEL', phaseL: 'data:image/png;base64,PHASE' });
});

test('ReportGeneratorView sanitizes the payload before persisting a KQTN record', () => {
  const source = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');
  assert.match(source, /stripTransientKqtnImages\(record\)/);
  assert.match(source, /await addKqtnRecord\(persistedRecord\)/);
});

test('KQTN store sanitizes direct updates and backup restores as well', () => {
  const source = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');
  assert.match(source, /const persistedInput = stripTransientKqtnImages\(record\)/);
  assert.match(source, /const persistedUpdates = stripTransientKqtnImages\(updates\)/);
  assert.match(source, /stripTransientKqtnImages\(\{\s*\.\.\.k/);
});

// --- End of transient-report-images.test.ts ---
