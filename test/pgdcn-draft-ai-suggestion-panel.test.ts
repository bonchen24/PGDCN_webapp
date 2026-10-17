import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PgdcnDraftAiSuggestionPanel, {
  type PgdcnDraftAiSuggestionPanelProps,
} from '../components/PgdcnDraftAiSuggestionPanel.tsx';

test('renders the unchanged field and AI proposal separately with explicit review actions', () => {
  const props: PgdcnDraftAiSuggestionPanelProps = {
    domain: 'PGD',
    fieldLabel: 'Kết luận',
    currentValue: 'Nội dung gốc\nGiữ nguyên văn bản này.',
    isBusy: false,
    suggestion: 'Đề xuất mới\nChỉ áp dụng khi người dùng chọn.',
    explanation: 'Câu chữ ngắn gọn hơn.',
    warnings: ['Vui lòng đối chiếu số liệu trước khi áp dụng.'],
    error: null,
    onRequest: () => {},
    onApply: () => {},
    onDismiss: () => {},
  };

  const render = (overrides: Partial<typeof props> = {}) => renderToStaticMarkup(
    createElement(PgdcnDraftAiSuggestionPanel, { ...props, ...overrides }),
  );
  const markup = render();

  assert.ok(markup.includes('Nội dung gốc'));
  assert.ok(markup.includes('Đề xuất mới'));
  assert.ok(markup.includes('Văn bản hiện tại'));
  assert.ok(markup.includes('Đề xuất AI'));
  assert.ok(markup.includes('nội dung hiện tại của trường'));
  assert.ok(markup.includes('Áp dụng đề xuất'));
  assert.ok(markup.includes('Giữ nguyên'));
  assert.ok(markup.includes('Vui lòng đối chiếu số liệu trước khi áp dụng.'));
  assert.match(markup, /aria-live="polite"/);

  const emptyMarkup = render({ suggestion: null, explanation: null, warnings: [], error: null });
  assert.ok(emptyMarkup.includes('Chưa có đề xuất.'));

  const loadingMarkup = render({ isBusy: true, suggestion: null, explanation: null, warnings: [], error: null });
  assert.ok(loadingMarkup.includes('Đang tạo đề xuất'));
  assert.match(loadingMarkup, /role="status" aria-live="polite"/);

  const errorMarkup = render({ suggestion: null, explanation: null, warnings: [], error: 'Không thể tạo gợi ý.' });
  assert.match(errorMarkup, /role="alert" aria-live="assertive"/);
  assert.ok(errorMarkup.includes('Không thể tạo gợi ý.'));
});
