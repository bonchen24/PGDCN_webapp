import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';
import PcnDossierQueueView from '../components/PcnDossierQueueView';

test('PCN queue filters and empty results expose accessible, mobile-ready controls', () => {
  const markup = renderToStaticMarkup(React.createElement(PcnDossierQueueView, {
    rows: [],
    onOpenDossier: () => {},
  }));
  const $ = cheerio.load(markup);
  const source = fs.readFileSync(new URL('../components/PcnDossierQueueView.tsx', import.meta.url), 'utf8');

  const search = $('[role="search"] input[type="search"]');
  assert.equal(search.length, 1, 'search stays inside a named search landmark');
  assert.ok((search.attr('class') || '').includes('min-h-11'), 'search is easy to tap');
  assert.ok((search.attr('class') || '').includes('focus-visible:ring-2'), 'search has a visible keyboard focus ring');

  const chips = $('[role="group"][aria-label="Lọc hồ sơ theo trạng thái"] button');
  assert.equal(chips.length, 7, 'the existing filter chips remain available');
  chips.each((_, button) => {
    assert.ok(['true', 'false'].includes($(button).attr('aria-pressed') || ''), 'each chip announces whether it is selected');
    assert.ok(($(button).attr('class') || '').includes('min-h-11'), 'each chip meets the mobile touch target');
    assert.ok(($(button).attr('class') || '').includes('focus-visible:ring-2'), 'each chip has visible keyboard focus');
  });
  assert.equal(chips.filter((_, button) => $(button).text().includes('Tất cả')).attr('aria-pressed'), 'true');
  assert.equal(chips.filter((_, button) => $(button).text().includes('Quy chuẩn 4')).length, 1);
  assert.equal(chips.filter((_, button) => $(button).text().includes('Quy chuẩn 9')).length, 1);
  const selectedChip = chips.filter((_, button) => $(button).text().includes('Tất cả'));
  assert.ok((selectedChip.attr('class') || '').includes('bg-slate-900'), 'the active chip is visually distinct');
  assert.ok((selectedChip.attr('class') || '').includes('ring-2'), 'the active chip has a visible outline');
  assert.ok(source.includes("result = result.filter((r) => r.fieldCodes.includes('QC4'))"));
  assert.ok(source.includes("result = result.filter((r) => r.fieldCodes.includes('QC9'))"));

  const reset = $('[data-testid="pcn-filter-reset"]');
  assert.equal(reset.length, 1, 'empty results include a reset action');
  assert.equal(reset.text().trim(), 'Xóa tìm kiếm và bộ lọc');
  assert.ok((reset.attr('class') || '').includes('min-h-11'), 'the reset action meets the mobile touch target');
  assert.match(source, /const resetFilters = \(\) => \{[\s\S]*?setQuery\(''\)[\s\S]*?setActiveChip\('ALL'\)/);

  assert.ok(/className="flex min-w-0 max-w-full flex-col items-stretch[^"]*sm:flex-row sm:flex-wrap/.test(source), 'the toolbar wraps instead of clipping on narrow screens');
  assert.match(source, /data-testid="pcn-dossier-table-scroll"[\s\S]*?mobile-scroll-x min-w-0 max-w-full overflow-x-auto/);
  assert.ok(/role="region"\s+aria-label="Bảng hồ sơ PCN[^"]*"\s+tabIndex=\{0\}/.test(source), 'the scroll region can receive keyboard focus');
});

test('PCN queue view switch shows concise mobile labels and preserves desktop and accessibility labels', () => {
  const markup = renderToStaticMarkup(React.createElement(PcnDossierQueueView, {
    rows: [],
    onOpenDossier: () => {},
  }));
  const $ = cheerio.load(markup);
  const switcher = $('[role="group"][aria-label="Chế độ hiển thị hồ sơ"]');
  const cardButton = switcher.find('button[aria-label="Xem dạng thẻ"]');
  const tableButton = switcher.find('button[aria-label="Xem dạng bảng"]');
  const findLabel = (selector: string, label: string) =>
    switcher.find(selector).find('span').filter((_, span) => $(span).text().trim() === label);

  assert.equal(cardButton.attr('aria-pressed'), 'true', 'card remains the default view');
  assert.equal(tableButton.attr('aria-pressed'), 'false');

  const cardMobileLabel = findLabel('button[aria-label="Xem dạng thẻ"]', 'Thẻ');
  const tableMobileLabel = findLabel('button[aria-label="Xem dạng bảng"]', 'Bảng');
  assert.equal(cardMobileLabel.length, 1, 'the card toggle has a concise mobile label');
  assert.equal(tableMobileLabel.length, 1, 'the table toggle has a concise mobile label');
  assert.ok((cardMobileLabel.attr('class') || '').includes('sm:hidden'));
  assert.ok((tableMobileLabel.attr('class') || '').includes('sm:hidden'));

  const cardDesktopLabel = findLabel('button[aria-label="Xem dạng thẻ"]', 'Dạng thẻ');
  const tableDesktopLabel = findLabel('button[aria-label="Xem dạng bảng"]', 'Dạng bảng');
  assert.equal(cardDesktopLabel.length, 1, 'the full card label remains available on desktop');
  assert.equal(tableDesktopLabel.length, 1, 'the full table label remains available on desktop');
  assert.ok((cardDesktopLabel.attr('class') || '').includes('hidden sm:inline'));
  assert.ok((tableDesktopLabel.attr('class') || '').includes('hidden sm:inline'));
  assert.ok(switcher.parent().hasClass('flex-wrap'), 'the header can wrap the switcher below the title');
});
