import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import React from 'react';
import * as cheerio from 'cheerio';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnCustomersView, { filterCustomersBySearch } from '../components/PgdcnCustomersView';
import type { CustomerRef } from '../types';

test('PGD customer projection searches normalized identity and contact fields accessibly', () => {
  const customer: CustomerRef = {
    name: 'Công ty Điện lực Ánh Dương',
    address: 'Hà Nội',
    customerCode: 'KH-DIEN-01',
    taxId: '0102040608',
    contactPerson: 'Đặng Thị Ánh',
    phone: '0987654321',
    email: 'anh@example.vn',
  };

  for (const query of ['cong ty dien luc', 'kh-dien-01', '0102040608', 'dang thi anh', '0987654321', 'ANH@EXAMPLE.VN']) {
    assert.deepEqual(filterCustomersBySearch([customer], query), [customer], `query should find customer by ${query}`);
  }
  assert.deepEqual(filterCustomersBySearch([customer], 'khong-co-ket-qua'), []);
  assert.deepEqual(filterCustomersBySearch([customer], '   '), [customer]);

  const source = fs.readFileSync(new URL('../components/PgdcnCustomersView.tsx', import.meta.url), 'utf8');
  const markup = renderToStaticMarkup(React.createElement(PgdcnCustomersView, { scopes: ['PGD'] }));
  const $ = cheerio.load(markup);

  const search = $('[role="search"][aria-label="Tìm kiếm khách hàng dùng chung"] input[type="search"]');
  assert.equal(search.length, 1);
  assert.match(search.parent().text(), /Tìm khách hàng/);
  assert.ok((search.attr('class') || '').includes('min-h-11'));
  assert.ok((search.attr('class') || '').includes('focus-visible:ring-2'));
  assert.equal($('[role="status"]').text().trim(), '0 khách hàng');
  assert.match($('.pcn-page-surface').text(), /Chưa có khách hàng dùng chung/);
  assert.match(source, /Không tìm thấy khách hàng phù hợp/);
  assert.match(source, /Xóa tìm kiếm/);
  assert.match(source, /aria-live="polite"[\s\S]*?filteredCustomers\.length/);
  assert.match(source, /if \(scopes\.includes\('PCN'\)\) return <PcnCustomersManagementView \/>;/);
});
