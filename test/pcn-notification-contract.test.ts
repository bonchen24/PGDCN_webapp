import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { ActivityLog } from '../types.ts';
import { buildPcnNotificationFromActivity, isPcnNotification } from '../utils/pcnNotification.ts';
import { getPcnNotificationDossierTab } from '../utils/pcnDossierNavigation.ts';

const schemaSource = fs.readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');

const activity = (overrides: Partial<ActivityLog> = {}): ActivityLog => ({
  id: 'activity-1',
  createdAt: '2026-08-28T08:00:00.000Z',
  actorName: 'Nguyễn Văn A',
  actorUsername: 'nguyenvana',
  action: 'CREATED',
  entityType: 'PCN_PROPOSAL',
  entityId: 'proposal-1',
  entityLabel: 'DN-QC4-2026-001',
  summary: 'Tạo Đề nghị chứng nhận',
  source: 'UI',
  ...overrides,
});

test('PCN proposal creation becomes one targeted staff notification with a stable id', () => {
  const notification = buildPcnNotificationFromActivity(activity());

  assert.ok(notification);
  assert.equal(notification.id, 'pcn-notif-activity-1');
  assert.equal(notification.entityType, 'PCN_PROPOSAL');
  assert.equal(notification.targetRole, 'staff');
  assert.equal(notification.read, false);
  assert.equal(notification.createdBy, 'Nguyễn Văn A');
});

test('PCN issuance notification is visible to administrators and does not reuse DDT entity names', () => {
  const notification = buildPcnNotificationFromActivity(activity({
    id: 'activity-2',
    action: 'STATUS_CHANGED',
    entityType: 'PCN_ISSUANCE',
    entityLabel: 'GCN-QC4-001',
  }));

  assert.ok(notification);
  assert.equal(notification.targetRole, 'admin');
  assert.equal(isPcnNotification(notification), true);
  assert.equal(notification.entityType, 'PCN_ISSUANCE');
});

test('PCN dossier assignment notification targets newly assigned operators', () => {
  const notification = buildPcnNotificationFromActivity(activity({
    id: 'activity-dossier-assignment',
    action: 'UPDATED',
    entityType: 'PCN_DOSSIER',
    changes: [
      { field: 'ownerUsername', before: 'old-owner', after: 'new-owner' },
      { field: 'reviewerUsername', before: '', after: 'reviewer-qc4' },
      { field: 'evaluatorUsername', before: 'old-evaluator', after: '' },
    ],
  }));

  assert.ok(notification);
  assert.equal(notification.action, 'ASSIGNED');
  assert.equal(notification.targetRole, 'staff');
  assert.deepEqual(notification.targetUsernames, ['new-owner', 'reviewer-qc4']);
});

test('import and restore audit entries do not create noisy PCN notifications', () => {
  assert.equal(buildPcnNotificationFromActivity(activity({ source: 'IMPORT' })), null);
  assert.equal(buildPcnNotificationFromActivity(activity({ source: 'RESTORE' })), null);
});

test('PCN schema creates notifications from major activity rows inside the database', () => {
  assert.match(schemaSource, /CREATE OR REPLACE FUNCTION create_pcn_activity_notification/);
  assert.match(schemaSource, /CREATE TRIGGER trg_pcn_activity_notifications/);
  assert.match(schemaSource, /pcn-notif-/);
  assert.match(schemaSource, /PCN_PROPOSAL/);
  assert.match(schemaSource, /PCN_ISSUANCE/);
  assert.match(schemaSource, /ownerUsername/);
  assert.match(schemaSource, /targetUsernames/);
  assert.match(schemaSource, /ASSIGNED/);
  assert.match(schemaSource, /ON CONFLICT \(collection_name, document_id\) DO NOTHING/);
});

test('PCN shell and store expose a separate notification channel', () => {
  assert.match(workspaceSource, /PcnNotificationDropdown/);
  assert.match(workspaceSource, /pcn\.notifications/);
  assert.match(storeSource, /notifications: AppNotification\[\]/);
  assert.match(storeSource, /fetchCollection<AppNotification>\('notifications'\)/);
});

test('PCN notification types deep-link to the matching dossier detail area', () => {
  assert.equal(getPcnNotificationDossierTab('PCN_PROPOSAL'), 'proposal');
  assert.equal(getPcnNotificationDossierTab('PCN_SAMPLE_LOT'), 'lab');
  assert.equal(getPcnNotificationDossierTab('PCN_LAB_REQUEST'), 'lab');
  assert.equal(getPcnNotificationDossierTab('PCN_RESULT'), 'results');
  assert.equal(getPcnNotificationDossierTab('PCN_APPROVAL'), 'issuance');
  assert.equal(getPcnNotificationDossierTab('PCN_ISSUANCE'), 'issuance');
  assert.equal(getPcnNotificationDossierTab('PCN_DOSSIER'), undefined);
});

test('PCN notification handler passes the deep-link detail area when a dossier exists', () => {
  assert.match(workspaceSource, /getPcnNotificationDossierTab\(notification\.entityType\)/);
  assert.match(workspaceSource, /setSelectedDossierTab\(notificationTab\)/);
});

// --- End of pcn-notification-contract.test.ts ---
