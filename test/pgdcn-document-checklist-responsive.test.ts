import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PgdcnDossierDocumentActionTable from '../components/PgdcnDossierDocumentActionTable';

const row = {
  id: 'identity-document',
  step: 'Tiếp nhận hồ sơ',
  title: 'Giấy chứng nhận đăng ký',
  required: true,
  status: 'Chưa có',
  statusTone: 'warning' as const,
  detail: 'Tải lên bản sao còn hiệu lực.',
  action: createElement('button', { 'data-action': 'standard' }, 'Bổ sung tài liệu'),
};

test('default document rows stack as labelled mobile cards and mount one action', () => {
  const markup = renderToStaticMarkup(createElement(PgdcnDossierDocumentActionTable, {
    rows: [row],
    testId: 'document-checklist',
  }));

  assert.match(markup, /class="[^"]*block[^"]*md:table[^"]*"/);
  assert.match(markup, /class="sr-only[^"]*md:not-sr-only md:table-header-group/);
  assert.match(markup, /md:table-row/);
  assert.match(markup, /md:table-cell/);
  assert.doesNotMatch(markup, /min-w-\[760px\]/);
  assert.doesNotMatch(markup, /overflow-x-auto|touch-pan-x/);
  for (const label of ['Bước', 'Tài liệu cần có', 'Trạng thái', 'Hành động']) {
    assert.match(markup, new RegExp(`<span aria-hidden="true" class="[^"]*md:hidden">${label}</span>`));
  }
  assert.match(markup, /Tiếp nhận hồ sơ/);
  assert.match(markup, /Giấy chứng nhận đăng ký/);
  assert.match(markup, /Bắt buộc/);
  assert.match(markup, /Tải lên bản sao còn hiệu lực/);
  assert.equal((markup.match(/data-action="standard"/g) ?? []).length, 1);
  assert.equal((markup.match(/<th scope="col"/g) ?? []).length, 4);
});

test('custom row rendering keeps the keyboard and touch scrollable table fallback', () => {
  const markup = renderToStaticMarkup(createElement(PgdcnDossierDocumentActionTable, {
    rows: [row],
    testId: 'custom-document-checklist',
    renderRow: () => createElement('tr', { key: 'custom-row', 'data-custom-row': 'true' },
      createElement('td', null, 'PCN document row'),
      createElement('td', null, createElement('button', { 'data-action': 'custom' }, 'Open PCN document')),
    ),
  }));

  assert.match(markup, /aria-label="Bảng tài liệu cần xử lý, cuộn ngang để xem các cột khác"/);
  assert.match(markup, /tabindex="0"/);
  assert.match(markup, /touch-pan-x/);
  assert.match(markup, /min-w-\[760px\]/);
  assert.match(markup, /Kéo ngang để xem thêm các cột/);
  assert.match(markup, /data-custom-row="true"/);
  assert.match(markup, /data-action="custom"/);
  assert.doesNotMatch(markup, /data-action="standard"/);
});
