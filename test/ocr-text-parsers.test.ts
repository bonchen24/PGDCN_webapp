import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseNameplateOcrText,
  parseRequestOcrText,
  parseTestResultsOcrText,
} from '../utils/ocrTextParsers.ts';

test('parses common nameplate fields from PaddleOCR text without inventing values', () => {
  const result = parseNameplateOcrText([
    'Brand: Panasonic',
    'Model: CS-XPU9XKH',
    'Rated Voltage: 220-240V',
    'Frequency: 50Hz',
    'Power: 900W',
    'Made in: Vietnam',
    'IEMM.26/EMC/0403-SP-M01',
  ].join('\n'));

  assert.equal(result.brand, 'Panasonic');
  assert.equal(result.model, 'CS-XPU9XKH');
  assert.equal(result.voltage, '220-240V');
  assert.equal(result.frequency, '50Hz');
  assert.equal(result.power, '900W');
  assert.equal(result.countryOfOrigin, 'Vietnam');
  assert.equal(result.sealStamp, 'IEMM.26/EMC/0403-SP');
  assert.equal(result.manufacturer, '');
});

test('parses result metrics from OCR text and leaves absent values undefined', () => {
  const result = parseTestResultsOcrText([
    'Serial Number: SN-01',
    'Measured Capacity: 3412',
    'Measured Power: 1120 W',
    'CSPF: 4.2',
    'Energy Level: 5',
  ].join('\n'));

  assert.deepEqual(result, {
    serialNumber: 'SN-01',
    measuredCapacity: 3412,
    measuredPower: 1120,
    cspf: 4.2,
    energyLevel: 5,
  });
});

test('parses request identity and a model row from OCR text', () => {
  const result = parseRequestOcrText([
    'Customer: Công ty ABC',
    'Address: Hà Nội',
    'Phone: 0901234567',
    'Model: ABC-123',
    'Brand: ACME',
    'Quantity: 2',
    'Standard: TCVN 5699',
  ].join('\n'));

  assert.equal(result.customerInfo.name, 'Công ty ABC');
  assert.equal(result.customerInfo.address, 'Hà Nội');
  assert.equal(result.customerInfo.phone, '0901234567');
  assert.equal(result.samples[0].modelName, 'ABC-123');
  assert.equal(result.samples[0].brand, 'ACME');
  assert.equal(result.samples[0].quantity, 2);
  assert.equal(result.samples[0].standard, 'TCVN 5699');
  assert.equal(result.sealStamp, '');
});

// --- End of ocr-text-parsers.test.ts ---
