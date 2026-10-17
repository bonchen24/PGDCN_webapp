import assert from 'node:assert/strict';
import test from 'node:test';
import type { PgdDossierQueueRow } from '../components/PgdDossierQueueView.tsx';

test('PGD queue filters use document counts and canonical status codes', async () => {
  const { filterPgdDossierQueueRows } = await import('../components/PgdDossierQueueView.tsx');
  assert.equal(typeof filterPgdDossierQueueRows, 'function');

  const rows: PgdDossierQueueRow[] = [
    {
      requestId: 'draft', requestCode: 'PYC-1', customerName: '', productName: '',
      status: 'DRAFT', statusLabel: 'Đã hoàn thành', currentStepNumber: 1, currentStepLabel: '',
      requiredDocumentPresent: 1, requiredDocumentTotal: 1, missingRequiredCount: 0,
      productGroup: '', catalogLabel: '',
    },
    {
      requestId: 'signed', requestCode: 'PYC-2', customerName: '', productName: '',
      status: 'SIGNED', statusLabel: 'Đang xử lý', currentStepNumber: 6, currentStepLabel: '',
      requiredDocumentPresent: 1, requiredDocumentTotal: 1, missingRequiredCount: 0,
      productGroup: '', catalogLabel: '',
    },
    {
      requestId: 'archived-missing', requestCode: 'PYC-3', customerName: '', productName: '',
      status: 'ARCHIVED', statusLabel: 'Chưa phát hành', currentStepNumber: 6, currentStepLabel: '',
      requiredDocumentPresent: 0, requiredDocumentTotal: 1, missingRequiredCount: 1,
      productGroup: '', catalogLabel: '',
    },
    {
      requestId: 'returned', requestCode: 'PYC-4', customerName: '', productName: '',
      status: 'RESULT_RETURNED', statusLabel: 'Đang xử lý', currentStepNumber: 6, currentStepLabel: '',
      requiredDocumentPresent: 1, requiredDocumentTotal: 1, missingRequiredCount: 0,
      productGroup: '', catalogLabel: '',
    },
  ];

  const ids = (filterId: 'ACTION_NEEDED' | 'COMPLETED' | 'MISSING_DOCS') =>
    filterPgdDossierQueueRows(rows, filterId).map((row) => row.requestId);

  assert.deepEqual(ids('ACTION_NEEDED'), ['draft', 'archived-missing']);
  assert.deepEqual(ids('COMPLETED'), ['signed', 'archived-missing', 'returned']);
  assert.deepEqual(ids('MISSING_DOCS'), ['archived-missing']);
});
