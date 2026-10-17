import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdDossierQueueView, { type PgdDossierQueueRow } from '../components/PgdDossierQueueView';

const row: PgdDossierQueueRow = {
  requestId: 'pgd-queue-ui-1',
  requestCode: 'PYC-PGD-001',
  customerName: 'Công ty Thử nghiệm',
  productName: 'Thép cuộn',
  status: 'IN_PROGRESS',
  statusLabel: 'Đang xử lý',
  currentStepNumber: 3,
  currentStepLabel: 'Kiểm tra hiện trường',
  nextActionLabel: 'Bổ sung phiếu thử nghiệm',
  requiredDocumentPresent: 2,
  requiredDocumentTotal: 3,
  missingRequiredCount: 1,
  ownerUsername: 'inspector',
  ownerDisplayName: 'Nguyễn An',
  productGroup: 'Thép / kim loại',
  catalogLabel: 'Thép cuộn cán nóng',
};

function renderQueue() {
  return renderToStaticMarkup(React.createElement(PgdDossierQueueView, {
    rows: [row],
    onOpenDossier: () => undefined,
  }));
}

test('PGD queue separates product filters from dossier state and exposes selection accessibly', () => {
  const $ = cheerio.load(renderQueue());
  const productFilters = $('[role="group"][aria-labelledby="pgd-queue-product-filter-label"]');
  const stateFilters = $('[role="group"][aria-labelledby="pgd-queue-state-filter-label"]');

  assert.equal(productFilters.length, 1);
  assert.equal(productFilters.find('button').length, 3);
  assert.equal(stateFilters.length, 1);
  assert.equal(stateFilters.find('button').length, 6);
  assert.equal(stateFilters.find('button[aria-label="Tất cả, 1 hồ sơ"]').attr('aria-pressed'), 'true');
  assert.equal(productFilters.find('button[aria-label="Thép/Kim loại, 1 hồ sơ"]').attr('aria-pressed'), 'false');
  assert.match(productFilters.attr('class') || '', /flex-wrap/);
  assert.match(stateFilters.attr('class') || '', /flex-wrap/);
});

test('PGD queue search remains readable on mobile and keeps search within the responsive toolbar', () => {
  const $ = cheerio.load(renderQueue());
  const search = $('input[type="search"]');

  assert.match(search.attr('class') || '', /(?:^|\s)text-base(?:\s|$)/);
  assert.match(search.attr('class') || '', /md:text-\[11px\]/);
  assert.match($('.pgd-queue-toolbar').attr('class') || '', /flex-col/);
  assert.match($('.pgd-queue-filter-pills').attr('class') || '', /flex-col/);
});

test('PGD table names status, product group, missing items, and the next action explicitly', () => {
  const source = fs.readFileSync(new URL('../components/PgdDossierQueueView.tsx', import.meta.url), 'utf8');

  assert.match(source, /<th scope="col" className="border-b border-slate-200 px-3 py-3">Trạng thái hồ sơ<\/th>/);
  assert.match(source, /Nhóm sản phẩm \/ phân loại/);
  assert.match(source, /Bước hiện tại \/ tiếp theo/);
  assert.match(source, /Tiếp theo:<\/span> \{row\.nextActionLabel/);
  assert.match(source, /Đầu mục hồ sơ còn thiếu/);
  assert.match(source, /Còn thiếu \$\{row\.missingRequiredCount\} đầu mục/);
  assert.match(source, /row\.productGroup \|\| 'Chưa xác định nhóm'/);
  assert.match(source, /row\.catalogLabel \|\| 'Chưa phân loại'/);
});

test('PGD table scroll region is keyboard focusable and labeled with horizontal scroll guidance', () => {
  const source = fs.readFileSync(new URL('../components/PgdDossierQueueView.tsx', import.meta.url), 'utf8');
  const scrollRegion = source.match(/<div\s+data-testid="pgd-dossier-table-scroll"[\s\S]*?>/);

  assert.ok(scrollRegion, 'the PGD table needs a dedicated scroll region');
  assert.match(scrollRegion[0], /role="region"/);
  assert.match(scrollRegion[0], /aria-label="Bảng hồ sơ PGD, cuộn ngang để xem các cột khác"/);
  assert.match(scrollRegion[0], /tabIndex=\{0\}/);
  assert.match(scrollRegion[0], /focus-visible:ring-blue-500/);
  assert.match(source, /Vuốt ngang để xem đầy đủ bảng hồ sơ PGD\./);
});
