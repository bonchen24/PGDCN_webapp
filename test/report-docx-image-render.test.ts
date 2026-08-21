// Author: Gemini
// OS support: Web/Node
// Description: Verifies that mapped dynamic label photos are actually embedded in a DOCX template

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
// @ts-ignore
import ImageModule from 'docxtemplater-image-module-free';
import { buildReportDocxImageSlots, combineReportDocxLabelImages } from '../lib/reportDocxImageMapping';

const onePixelPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('renders the combined dynamic label photo into the DOCX image module', async () => {
  const combinedLabelImage = await combineReportDocxLabelImages([onePixelPng, onePixelPng]);
  const slots = buildReportDocxImageSlots({
    standardId: 'emc_tu_lanh',
    combinedLabelImage,
    images: {
      label: onePixelPng,
      label2: onePixelPng,
      sample: onePixelPng,
      setupVoltage: onePixelPng,
    },
  });
  const zip = new PizZip(fs.readFileSync('public/tulanh placeholder.docx'));
  const imageModule = new ImageModule({
    getImage: (value: string) => Buffer.from(value.split(',')[1], 'base64'),
    getSize: () => [100, 100],
  });
  const doc = new Docxtemplater(zip, { modules: [imageModule], nullGetter: () => '' });

  doc.render(slots);

  const output = new PizZip(doc.getZip().generate({ type: 'nodebuffer' }));
  const generatedImages = Object.keys(output.files).filter(file => file.startsWith('word/media/image_generated_'));
  assert.equal(generatedImages.length, 3);
});

// --- End of report-docx-image-render.test.ts ---
