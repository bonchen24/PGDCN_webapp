// Author: Gemini
// OS support: Web/Node
// Description: Unit test for Docx Templates Catalog and Template Management

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { REPORT_TEMPLATES_CATALOG } from '../lib/reportTemplatesCatalog.js';

test('REPORT_TEMPLATES_CATALOG contains valid template definitions', () => {
  assert.ok(REPORT_TEMPLATES_CATALOG.length >= 40, 'Must contain at least 40 templates');

  const seenIds = new Set<string>();
  const seenFilenames = new Set<string>();

  for (const tpl of REPORT_TEMPLATES_CATALOG) {
    assert.ok(tpl.id, 'Template must have an id');
    assert.ok(!seenIds.has(tpl.id), `Duplicate template id: ${tpl.id}`);
    seenIds.add(tpl.id);

    assert.ok(['atd', 'emc', 'cable', 'general'].includes(tpl.category), `Invalid category: ${tpl.category}`);
    assert.ok(tpl.categoryName, 'Category name must be defined');
    assert.ok(tpl.standardId, 'standardId must be defined');
    assert.ok(tpl.standardName, 'standardName must be defined');
    assert.ok(tpl.deviceName, 'deviceName must be defined');
    assert.ok(tpl.variantName, 'variantName must be defined');
    assert.ok(tpl.filename.endsWith('.docx'), `Filename must end with .docx: ${tpl.filename}`);

    assert.ok(!seenFilenames.has(tpl.filename), `Duplicate template filename: ${tpl.filename}`);
    seenFilenames.add(tpl.filename);
  }
});

test('All catalog template files exist in public/ directory', () => {
  const publicDir = path.join(process.cwd(), 'public');
  const distDir = path.join(process.cwd(), 'dist');

  for (const tpl of REPORT_TEMPLATES_CATALOG) {
    const publicPath = path.join(publicDir, tpl.filename);
    const distPath = path.join(distDir, tpl.filename);

    const exists = fs.existsSync(publicPath) || fs.existsSync(distPath);
    assert.ok(exists, `Template file must exist in public/ or dist/: ${tpl.filename}`);

    const filePath = fs.existsSync(publicPath) ? publicPath : distPath;
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 0, `Template file ${tpl.filename} must not be empty`);
  }
});

test('An toàn điện (TCVN 5699) templates have both full and reduced variants', () => {
  const atdStandards = [
    'toaster',
    'iron',
    'rice_cooker',
    'fan',
    'storage_heater',
    'hair_dryer',
    'instant_heater',
    'microwave',
  ];

  for (const stdId of atdStandards) {
    const full = REPORT_TEMPLATES_CATALOG.find(t => t.standardId === stdId && t.variantName === 'Đầy đủ chỉ tiêu');
    const reduced = REPORT_TEMPLATES_CATALOG.find(t => t.standardId === stdId && t.variantName === 'Giảm thiểu chỉ tiêu');

    assert.ok(full, `Missing full template for ${stdId}`);
    assert.ok(reduced, `Missing reduced template for ${stdId}`);
  }
});

test('EMC templates cover all supported appliance types and suboptions', () => {
  const emcTemplates = REPORT_TEMPLATES_CATALOG.filter(t => t.category === 'emc');
  assert.ok(emcTemplates.length >= 20, 'Must have at least 20 EMC templates');

  // Verify specific key templates
  const bepDien1V = emcTemplates.find(t => t.filename === 'bepdien1vungnau placeholder.docx');
  assert.ok(bepDien1V, 'bepdien1vungnau placeholder.docx must be in catalog');

  const bepTu1V = emcTemplates.find(t => t.filename === '1T placeholder.docx');
  assert.ok(bepTu1V, '1T placeholder.docx must be in catalog');

  const dieuHoa2Chieu = emcTemplates.find(t => t.filename === 'loai2chieu placeholder.docx');
  assert.ok(dieuHoa2Chieu, 'loai2chieu placeholder.docx must be in catalog');

  const tuLanh = emcTemplates.find(t => t.filename === 'tulanh placeholder.docx');
  assert.ok(tuLanh, 'tulanh placeholder.docx must be in catalog');
});

// --- End of test/docx-template-settings.test.ts ---
