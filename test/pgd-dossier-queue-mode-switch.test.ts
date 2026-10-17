import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdDossierQueueView from '../components/PgdDossierQueueView';

test('PGD queue mode switch stays labeled, accessible, touch-sized, and unclipped', () => {
  const html = renderToStaticMarkup(
    createElement(PgdDossierQueueView, { rows: [], onOpenDossier: () => {} }),
  );
  const group = html.match(
    /<div\b(?=[^>]*role="group")(?=[^>]*aria-label="Chọn chế độ hiển thị hàng đợi hồ sơ PGD")[^>]*>[\s\S]*?<\/div>/,
  );

  assert.ok(group, 'mode switch has a Vietnamese accessible group label');

  for (const { label, pressed } of [
    { label: 'Dạng thẻ', pressed: 'true' },
    { label: 'Dạng bảng', pressed: 'false' },
  ]) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const button = group[0].match(
      new RegExp(`<button\\b(?=[^>]*aria-label="${escapedLabel}")(?=[^>]*aria-pressed="${pressed}")([^>]*)>([\\s\\S]*?)<\\/button>`),
    );

    assert.ok(button, `${label} button exposes its name and pressed state`);
    const markup = `${button[1]}${button[2]}`;
    assert.match(markup, new RegExp(`<span[^>]*>${escapedLabel}<\\/span>`), `${label} remains visible`);
    assert.match(markup, /min-h-11/);
    assert.match(markup, /min-w-11/);
    assert.match(markup, /focus-visible:ring-2/);
    assert.doesNotMatch(markup, /hidden\s+sm:inline/);
  }

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
