import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getSchedulerConfig,
  msUntilTargetHour,
  hasBackupToday,
} from '../utils/backupScheduler.ts';

test('getSchedulerConfig respects environment variables and defaults', () => {
  assert.deepEqual(getSchedulerConfig({} as unknown as NodeJS.ProcessEnv), {
    enabled: false,
    targetHour: 2,
  });

  assert.deepEqual(
    getSchedulerConfig({ BACKUP_ENABLED: 'true', BACKUP_HOUR: '3' } as unknown as NodeJS.ProcessEnv),
    {
      enabled: true,
      targetHour: 3,
    },
  );

  assert.deepEqual(
    getSchedulerConfig({ BACKUP_ENABLED: 'false', BACKUP_HOUR: '99' } as unknown as NodeJS.ProcessEnv),
    {
      enabled: false,
      targetHour: 2,
    },
  );
});

test('msUntilTargetHour calculates positive millisecond delay to next occurrence', () => {
  const baseTime = new Date('2026-10-30T01:00:00.000Z');
  // target hour in UTC terms (e.g. 2:00 UTC)
  const delay = msUntilTargetHour(baseTime.getHours() + 1, baseTime);
  assert.equal(delay, 60 * 60 * 1000);

  // If target has passed today, target is next day (+24h - 1h = 23h)
  const pastTargetDelay = msUntilTargetHour(baseTime.getHours() - 1, baseTime);
  assert.equal(pastTargetDelay, 23 * 60 * 60 * 1000);
});

test('hasBackupToday checks whether today already has a backup', () => {
  const today = new Date('2026-10-30T10:00:00.000Z');
  const pastBackup = {
    filename: 'pcn_certification_auto_20261029-020000.zip',
    sizeBytes: 1000,
    createdAt: '2026-10-29T02:00:00.000Z',
  };
  const todayBackup = {
    filename: 'pcn_certification_auto_20261030-020000.zip',
    sizeBytes: 1000,
    createdAt: '2026-10-30T02:00:00.000Z',
  };

  assert.equal(hasBackupToday([pastBackup], today), false);
  assert.equal(hasBackupToday([todayBackup, pastBackup], today), true);
  assert.equal(hasBackupToday([], today), false);
});
