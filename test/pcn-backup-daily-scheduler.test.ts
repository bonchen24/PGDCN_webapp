import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDailyBackupJob,
  getSchedulerConfig,
  hasBackupToday,
  msUntilTargetHour,
} from '../utils/backupScheduler.ts';

const todayBackup = {
  filename: 'pcn_certification_manual_20261030-020000.zip',
  sizeBytes: 1000,
  createdAt: '2026-10-30T02:00:00.000Z',
};
const newBackup = {
  filename: 'pcn_certification_auto_20261030-020000.zip',
  sizeBytes: 1200,
  createdAt: '2026-10-30T02:00:00.000Z',
};

function createDependencies(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const dependencies = {
    listBackups: () => {
      calls.push('list');
      return [];
    },
    isPgToolAvailable: async () => {
      calls.push('pg-tool');
      return true;
    },
    createBackup: async (label: 'auto') => {
      calls.push(`create:${label}`);
      return newBackup;
    },
    recordBackupActivity: async () => {
      calls.push('audit');
    },
    getBackupRetentionPolicy: () => {
      calls.push('policy');
      return { retentionCount: 3, maxTotalBytes: 2048 };
    },
    applyRetention: () => {
      calls.push('retention');
    },
    ...overrides,
  };
  return { calls, dependencies };
}

test('getSchedulerConfig is disabled by default and validates UTC target hour', () => {
  assert.deepEqual(getSchedulerConfig({} as NodeJS.ProcessEnv), {
    enabled: false,
    targetHour: 2,
  });
  assert.deepEqual(
    getSchedulerConfig({ BACKUP_ENABLED: 'true', BACKUP_HOUR: '3' } as unknown as NodeJS.ProcessEnv),
    { enabled: true, targetHour: 3 },
  );
  assert.deepEqual(
    getSchedulerConfig({ BACKUP_ENABLED: 'true', BACKUP_HOUR: '3x' } as unknown as NodeJS.ProcessEnv),
    { enabled: true, targetHour: 2 },
  );
});

test('msUntilTargetHour calculates the next UTC occurrence independent of host timezone', () => {
  const now = new Date('2026-10-30T01:00:00.000Z');
  assert.equal(msUntilTargetHour(2, now), 60 * 60 * 1000);
  assert.equal(msUntilTargetHour(0, now), 23 * 60 * 60 * 1000);
});

test('hasBackupToday compares UTC calendar dates', () => {
  const now = new Date('2026-10-30T10:00:00.000Z');
  const yesterdayBackup = {
    filename: 'pcn_certification_auto_20261029-020000.zip',
    sizeBytes: 1000,
    createdAt: '2026-10-29T02:00:00.000Z',
  };
  assert.equal(hasBackupToday([yesterdayBackup], now), false);
  assert.equal(hasBackupToday([todayBackup], now), true);
  assert.equal(hasBackupToday([], now), false);
});

test('daily job skips creating a second archive on the same UTC day', async () => {
  const { calls, dependencies } = createDependencies({ listBackups: () => { calls.push('list'); return [todayBackup]; } });
  await createDailyBackupJob(dependencies)(new Date('2026-10-30T10:00:00.000Z'));
  assert.deepEqual(calls, ['list']);
});

test('daily job audits and applies retention after creating an archive', async () => {
  const { calls, dependencies } = createDependencies();
  await createDailyBackupJob(dependencies)(new Date('2026-10-30T01:00:00.000Z'));
  assert.deepEqual(calls, ['list', 'pg-tool', 'create:auto', 'audit', 'policy', 'retention']);
});

test('daily job propagates archive failures to the one-shot CLI caller', async () => {
  const { dependencies } = createDependencies({
    createBackup: async () => { throw new Error('archive failed'); },
  });
  await assert.rejects(
    createDailyBackupJob(dependencies)(new Date('2026-10-30T01:00:00.000Z')),
    /archive failed/,
  );
});

test('daily job rejects when pg_dump is unavailable so the one-shot CLI exits unsuccessfully', async () => {
  const { calls, dependencies } = createDependencies({
    isPgToolAvailable: async () => {
      calls.push('pg-tool');
      return false;
    },
  });

  await assert.rejects(
    createDailyBackupJob(dependencies)(new Date('2026-10-30T01:00:00.000Z')),
    /pg_dump not available/,
  );
  assert.deepEqual(calls, ['list', 'pg-tool']);
});

test('daily job prevents overlapping runs in the same process', async () => {
  let releaseBackup: () => void = () => {};
  const backupBlocker = new Promise<void>((resolve) => {
    releaseBackup = resolve;
  });

  const { calls, dependencies } = createDependencies({
    createBackup: async (label: 'auto') => {
      calls.push(`create:${label}`);
      await backupBlocker;
      return newBackup;
    },
  });

  const job = createDailyBackupJob(dependencies);
  const firstRun = job(new Date('2026-10-30T01:00:00.000Z'));
  const secondRunResult = await job(new Date('2026-10-30T01:00:00.000Z'));

  assert.equal(secondRunResult, null);
  releaseBackup();
  await firstRun;
});
