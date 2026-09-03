import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPgdcnNotificationNavigation,
  mergePgdcnNotifications,
  normalizePgdcnNotification,
} from '../utils/pgdcnNotification.ts';

test('normalizes legacy PCN rows and keeps explicit PGD domain', () => {
  assert.equal(normalizePgdcnNotification({
    id: 'legacy',
    type: 'SYSTEM',
    title: 'cũ',
    message: 'm',
    createdAt: '2026-09-03T01:00:00.000Z',
    read: false,
  }).domain, 'PCN');
  assert.equal(normalizePgdcnNotification({
    id: 'pgd-1',
    domain: 'PGD',
    type: 'BUSINESS_ACTIVITY',
    title: 'PGD',
    message: 'm',
    createdAt: '2026-09-03T02:00:00.000Z',
    read: false,
  }).domain, 'PGD');
});

test('merges by id, preserves read state, sorts deterministically and caps at 50', () => {
  const items = mergePgdcnNotifications([
    [{ id: 'same', domain: 'PCN', type: 'SYSTEM', title: 'old', message: 'm', createdAt: '2026-09-03T01:00:00.000Z', read: false }],
    [{ id: 'same', domain: 'PCN', type: 'SYSTEM', title: 'new', message: 'm', createdAt: '2026-09-03T02:00:00.000Z', read: true }],
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].read, true);
  assert.equal(items[0].title, 'new');

  const capped = mergePgdcnNotifications([Array.from({ length: 55 }, (_, index) => ({
    id: `n-${index}`,
    type: 'SYSTEM' as const,
    title: `n-${index}`,
    message: 'm',
    createdAt: `2026-09-03T00:${String(index).padStart(2, '0')}:00.000Z`,
    read: false,
  }))]);
  assert.equal(capped.length, 50);
});

test('maps PCN and PGD entities to typed domain navigation targets', () => {
  assert.deepEqual(getPgdcnNotificationNavigation({
    id: 'p',
    domain: 'PCN',
    type: 'BUSINESS_ACTIVITY',
    title: '',
    message: '',
    entityType: 'PCN_DOSSIER',
    entityId: 'd-1',
    createdAt: '',
    read: false,
  }), { domain: 'PCN', section: 'proposals', recordId: 'd-1' });
  assert.deepEqual(getPgdcnNotificationNavigation({
    id: 'g',
    domain: 'PGD',
    type: 'BUSINESS_ACTIVITY',
    title: '',
    message: '',
    entityType: 'PGD_LAB_RESULT',
    entityId: 'r-1',
    createdAt: '',
    read: false,
  }), { domain: 'PGD', section: 'results', recordId: 'r-1' });
  assert.equal(getPgdcnNotificationNavigation({
    id: 'unknown',
    domain: 'PGD',
    type: 'SYSTEM',
    title: '',
    message: '',
    entityId: 'x',
    createdAt: '',
    read: false,
  }), null);
});
