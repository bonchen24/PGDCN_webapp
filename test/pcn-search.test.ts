import assert from 'node:assert/strict';
import test from 'node:test';

import { filterPcnCatalogOptions, getPcnSearchTokens, matchesPcnSearchQuery, normalizePcnSearchText } from '../utils/pcnSearch';

test('PCN search removes Vietnamese accents without changing displayed values', () => {
  assert.equal(normalizePcnSearchText('Đặng Thị Hồng — Phòng thử nghiệm'), 'dang thi hong phong thu nghiem');
  assert.deepEqual(getPcnSearchTokens('  phong   THU nghiem  '), ['phong', 'thu', 'nghiem']);
});

test('PCN search matches every query token across catalog fields', () => {
  const fields = ['Công ty Điện tử Á Châu', 'Mã KH-0105', 'Hà Nội'];

  assert.equal(matchesPcnSearchQuery(fields, 'dien chau'), true);
  assert.equal(matchesPcnSearchQuery(fields, 'dien da nang'), false);
  assert.equal(matchesPcnSearchQuery(fields, 'KH 0105'), true);
});

test('PCN catalog filtering keeps original option objects and searches all fields', () => {
  const options = [
    { value: 'a', label: 'Phòng thử nghiệm Điện', description: 'Hà Nội' },
    { value: 'b', label: 'Phòng thử nghiệm Cơ khí', description: 'Đà Nẵng' },
  ];

  assert.deepEqual(
    filterPcnCatalogOptions(options, 'dien ha noi', (option) => [option.value, option.label, option.description]),
    [options[0]],
  );
  assert.deepEqual(filterPcnCatalogOptions(options, '', (option) => [option.label]), options);
});
