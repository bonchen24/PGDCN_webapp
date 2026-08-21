// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for normalized report metadata sent to DOCX templates

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportDocxMetadata } from '../lib/reportDocxMetadata.ts';

test('maps sealStamp into the legacy codingNumber placeholder', () => {
  const metadata = buildReportDocxMetadata({
    reportMeta: {
      rawReportDate: '2026-08-18',
      sealStamp: 'IEMM-8891',
      codingNumber: '01-EMC-26',
    },
    emcData: {},
  });

  assert.equal(metadata.sealStamp, 'IEMM-8891');
  assert.equal(metadata.codingNumber, 'IEMM-8891');
  assert.equal(metadata.reportDate, 'Hà Nội, ngày 18 tháng 08 năm 2026 (Hanoi, August 18, 2026)');
});

test('normalizes missing OCR report fields to N/A', () => {
  const metadata = buildReportDocxMetadata({
    reportMeta: {},
    ocrData: {},
    emcData: { voltage: '220V' },
  });

  assert.equal(metadata.manufacturer, 'N/A');
  assert.equal(metadata.countryOfOrigin, 'N/A');
  assert.equal(metadata.emcPower, 'N/A');
  assert.equal(metadata.emcVoltage, '220V');
  assert.equal(metadata.emcCurrent, 'N/A');
  assert.equal(metadata.emcFrequency, 'N/A');
  assert.equal(metadata.emcClockFreq, 'N/A');
});

test('prefers EMC form values and falls back to OCR values', () => {
  const metadata = buildReportDocxMetadata({
    reportMeta: { manufacturer: 'Factory', countryOfOrigin: 'Vietnam' },
    ocrData: { power: '1000W', voltage: '220V', current: '5A', frequency: '50Hz', clockFreq: '10MHz' },
    emcData: { power: '1200W' },
  });

  assert.equal(metadata.manufacturer, 'Factory');
  assert.equal(metadata.countryOfOrigin, 'Vietnam');
  assert.equal(metadata.emcPower, '1200W');
  assert.equal(metadata.emcVoltage, '220V');
  assert.equal(metadata.emcCurrent, '5A');
  assert.equal(metadata.emcFrequency, '50Hz');
  assert.equal(metadata.emcClockFreq, '10MHz');
});

// --- End of report-docx-metadata.test.ts ---
