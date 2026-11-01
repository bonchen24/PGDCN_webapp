// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for combining dynamic label photos into the DOCX anh_1 image slot

import assert from 'node:assert/strict';
import test from 'node:test';
import sizeOf from 'image-size';
import { buildReportDocxImageSlots, combineReportDocxLabelImages, getReportDocxLabelImages } from '../lib/reportDocxImageMapping';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('keeps dynamic label photos in numeric order and removes empty slots', () => {
  const labels = getReportDocxLabelImages({
    standardId: 'emc_tu_lanh',
    images: {
      label: 'label-1',
      label2: '',
      label10: 'label-10',
      label3: 'label-3',
    },
  });

  assert.deepEqual(labels, ['label-1', 'label-3', 'label-10']);
});

test('maps the combined label photo only to anh_1 before supporting photos', () => {
  const slots = buildReportDocxImageSlots({
    standardId: 'emc_tu_lanh',
    combinedLabelImage: 'combined-labels',
    images: {
      label: 'label-1',
      label2: 'label-2',
      sample: 'sample',
      setupVoltage: 'setup-voltage',
      setupPower: 'setup-power',
    },
    productPhoto1: 'product-1',
  });

  assert.deepEqual(
    [slots.anh_1, slots.anh_2, slots.anh_3, slots.anh_4, slots.anh_5, slots.anh_6],
    ['combined-labels', 'sample', 'setup-voltage', 'setup-power', '', ''],
  );
  assert.deepEqual(
    [slots.anh_1_1, slots.anh_1_2, slots.anh_tem_1, slots.anh_tem_2,
      slots.has_anh_1_1, slots.has_anh_1_2, slots.has_anh_tem_1, slots.has_anh_tem_2,
      slots.has_anh_1_3, slots.has_anh_tem_3],
    ['label-1', 'label-2', 'label-1', 'label-2', true, true, true, true, false, false],
  );
});

test('combines all label photos side by side while preserving a valid PNG output', async () => {
  const combined = await combineReportDocxLabelImages([onePixelPng, onePixelPng]);

  assert.match(combined, /^data:image\/png;base64,/);
  const dimensions = sizeOf(Buffer.from(combined.split(',')[1], 'base64'));
  assert.equal(dimensions.height, 1);
  assert.ok((dimensions.width || 0) > 1);
});

// --- End of report-docx-image-mapping.test.ts ---
