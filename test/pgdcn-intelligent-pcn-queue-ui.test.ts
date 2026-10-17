import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';

import PcnDossierQueueView from '../components/PcnDossierQueueView';
import type { PcnOperationsRegisterRow } from '../utils/pcnOperationsRegister';

const dossierRow: PcnOperationsRegisterRow = {
  dossierId: 'pcn-queue-1',
  dossierCode: 'CN-2026-001',
  registrationCode: 'DN-2026-001',
  customerName: 'Công ty Minh An',
  sampleQuantity: 7,
  sampleLocations: [],
  productName: 'Thiết bị đo áp suất',
  standardRefs: [],
  fieldCodes: ['QC4'],
  reportNumbers: [],
  testCriteria: [],
  labStatuses: [],
  dossierStatus: 'AWAITING_DOCUMENTS',
  stationKey: 'DOCUMENTS',
  stationTitle: 'Bổ sung hồ sơ',
  stationActionLabel: 'Tải tài liệu còn thiếu',
  completenessScore: 60,
  requiredDocumentTotal: 5,
  requiredDocumentPresent: 3,
  missingRequiredCount: 2,
  stationDocumentTotal: 5,
  stationDocumentPresent: 3,
  missingRequiredByStage: [],
  stationMissingLabels: [],
};

test('PCN queue announces matching results and surfaces the next action and assignment state in each card', () => {
  const markup = renderToStaticMarkup(React.createElement(PcnDossierQueueView, {
    rows: [dossierRow],
    onOpenDossier: () => {},
  }));
  const $ = cheerio.load(markup);

  const resultStatus = $('[role="status"]');
  assert.equal(resultStatus.length, 1, 'filtered result changes have one status announcement');
  assert.equal(resultStatus.attr('aria-live'), 'polite');
  assert.equal(resultStatus.attr('aria-atomic'), 'true', 'the full contextual count is announced');
  assert.match(resultStatus.text(), /1 trong 1 hồ sơ PCN/);

  const actionFilter = $('[role="group"][aria-label="Lọc hồ sơ theo trạng thái"] button')
    .filter((_, button) => $(button).text().includes('Cần xử lý'));
  assert.equal(actionFilter.length, 1);
  assert.match(actionFilter.text(), /1/);

  const card = $('[data-testid="pgdcn-dossier-card"]');
  assert.equal(card.length, 1);
  assert.ok(card.text().includes('Chưa phân công'), 'an unassigned dossier is identified directly on its card');
  assert.ok(card.text().includes('Tải tài liệu còn thiếu'), 'the immediate work is visible without expanding the card');
  assert.ok(card.text().includes('Thiếu 2 tài liệu bắt buộc'), 'the document blocker remains visible');
  assert.ok(card.text().includes('Mẫu 7'), 'the sample quantity remains visible on the card');
  assert.ok(card.parent().hasClass('grid-cols-1'), 'cards use a single column on small screens');
  assert.ok(card.parent().hasClass('md:grid-cols-2'), 'cards use two columns on wider screens');
});

test('search indexes the sample quantity displayed on PCN cards and uses an accurate hint', () => {
  const source = fs.readFileSync(new URL('../components/PcnDossierQueueView.tsx', import.meta.url), 'utf8');
  const filterStart = source.indexOf('return result.filter((row) =>');
  const filterEnd = source.indexOf('].filter(Boolean)', filterStart);
  assert.ok(filterStart >= 0 && filterEnd > filterStart, 'the searchable row fields are present');
  assert.ok(source.slice(filterStart, filterEnd).includes('row.sampleQuantity'), 'the displayed quantity can be searched');

  const deepTokensStart = source.indexOf('deepSearchTokens: [');
  const deepTokensEnd = source.indexOf(']', deepTokensStart);
  assert.ok(deepTokensStart >= 0 && deepTokensEnd > deepTokensStart);
  assert.ok(source.slice(deepTokensStart, deepTokensEnd).includes('row.sampleQuantity'), 'searching by quantity also expands the matching card');
  assert.match(source, /placeholder="[^"]*số lượng mẫu[^"]*"/);
});
