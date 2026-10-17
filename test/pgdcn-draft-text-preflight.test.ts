import assert from 'node:assert/strict';
import test from 'node:test';

import { preflightPgdcnDraftText } from '../utils/pgdcnDraftTextPreflight.ts';

test('reports local spacing and repeated-punctuation issues without flagging decimals', () => {
  const text = 'Mẫu  10 mg/L , p < .05??';
  const issues = preflightPgdcnDraftText(text);

  assert.deepEqual(
    issues.map(({ code, offset }) => [code, offset]),
    [
      ['double-space', 3],
      ['space-before-punctuation', 12],
      ['repeated-punctuation', 22],
    ],
  );
});

test('reports unresolved known placeholders and malformed known placeholder braces', () => {
  const text = 'Biểu mẫu {TEN_DON_VI}, {NGAY_THANG và {khac}.';
  const issues = preflightPgdcnDraftText(text, {
    placeholderKeys: ['TEN_DON_VI', 'NGAY_THANG'],
  });

  assert.deepEqual(
    issues.map(({ code, offset }) => [code, offset]),
    [
      ['unfilled-placeholder', text.indexOf('{TEN_DON_VI}')],
      ['broken-placeholder', text.indexOf('{NGAY_THANG')],
    ],
  );
});

test('reports required empty text and leaves scientific notation and units alone', () => {
  assert.deepEqual(
    preflightPgdcnDraftText('   ', { required: true }).map(({ code }) => code),
    ['required-empty'],
  );
  assert.deepEqual(
    preflightPgdcnDraftText('p < .05; liều 1.25 mg/kg, nhiệt độ 20 °C.', { required: true }),
    [],
  );
});

test('recognizes a generic unfilled marker without mistaking a one-letter math variable', () => {
  const text = 'Giá trị {placeholder}; tập hợp {x}.';
  const issues = preflightPgdcnDraftText(text);

  assert.deepEqual(
    issues.map(({ code, offset }) => [code, offset]),
    [['unfilled-placeholder', text.indexOf('{placeholder}')]],
  );
});
