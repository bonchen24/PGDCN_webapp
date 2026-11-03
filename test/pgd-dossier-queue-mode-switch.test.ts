import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdDossierQueueView from '../components/PgdDossierQueueView';

test('PGD queue enforces table presentation, touch-sized, unclipped and responsive', () => {
  const html = renderToStaticMarkup(
    createElement(PgdDossierQueueView, { rows: [], onOpenDossier: () => {} }),
  );
  
  // Card mode switch is removed per Superneat 100% table standard
  assert.doesNotMatch(html, /aria-label="Chọn chế độ hiển thị hàng đợi hồ sơ PGD"/, 'mode switcher removed in favor of table-only');
  assert.doesNotMatch(html, /Dạng thẻ/, 'card mode button removed');

  const toolbar = html.match(/<div class="pgd-queue-toolbar([^"]*)">/);
  const filters = html.match(/<div class="pgd-queue-filter-pills([^"]*)">/);
  assert.ok(toolbar, 'PGD toolbar uses a local responsive layout');
  assert.match(toolbar[1], /min-w-0/);
  assert.match(toolbar[1], /max-w-full/);
  assert.match(toolbar[1], /flex-col/);
  assert.doesNotMatch(toolbar[1], /overflow/);
  assert.doesNotMatch(html, /pgdcn-toolbar-nowrap/);
  assert.ok(filters, 'filter chips are present');
  assert.match(filters[1], /flex-col/);
  assert.match(filters[1], /max-w-full/);
  const wrappingChipGroups = [...html.matchAll(/<div role="group"[^>]*class="[^"]*flex-wrap[^"]*"/g)];
  assert.equal(wrappingChipGroups.length, 2, 'both product and status filter groups wrap independently');
});
