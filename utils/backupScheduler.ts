// Author: Gemini
// OS support: Web/Node
// Description: Daily automated backup scheduler with bounded retention and daily deduplication

import {
  createBackup,
  getBackupRetentionPolicy,
  applyRetention,
  recordBackupActivity,
  listBackups,
  isPgToolAvailable,
  type BackupInfo,
} from './backupManager';

let schedulerTimer: NodeJS.Timeout | null = null;
let isBackupRunning = false;

export interface DailySchedulerOptions {
  enabled?: boolean;
  targetHour?: number; // 0-23 UTC, default 2 (02:00 UTC)
}

export interface DailyBackupDependencies {
  listBackups?: () => BackupInfo[];
  isPgToolAvailable?: () => Promise<boolean>;
  createBackup?: (label: 'auto') => Promise<BackupInfo>;
  recordBackupActivity?: (
    action: 'CREATED',
    filename: string,
    actor: { name: string },
    source: 'SYSTEM',
  ) => Promise<unknown>;
  getBackupRetentionPolicy?: () => { retentionCount: number; maxTotalBytes: number };
  applyRetention?: (retentionCount?: number, maxTotalBytes?: number) => void;
}

export function getSchedulerConfig(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  targetHour: number;
} {
  const enabled = String(env.BACKUP_ENABLED || '').toLowerCase() === 'true';
  const rawHour = env.BACKUP_HOUR;
  let targetHour = 2;
  if (rawHour !== undefined && /^\s*\d+\s*$/.test(rawHour)) {
    const parsed = Number(rawHour.trim());
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 23) {
      targetHour = parsed;
    }
  }
  return { enabled, targetHour };
}

export function msUntilTargetHour(targetHour: number, now = new Date()): number {
  const target = new Date(now.getTime());
  target.setUTCHours(targetHour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - now.getTime();
}

export function hasBackupToday(backups: BackupInfo[] = listBackups(), now = new Date()): boolean {
  if (!backups || backups.length === 0) return false;
  const todayUtc = now.toISOString().slice(0, 10);
  return backups.some((b) => {
    try {
      const createdUtc = new Date(b.createdAt).toISOString().slice(0, 10);
      return createdUtc === todayUtc;
    } catch {
      return false;
    }
  });
}

export function createDailyBackupJob(customDeps: DailyBackupDependencies = {}) {
  const deps = {
    listBackups,
    isPgToolAvailable,
    createBackup,
    recordBackupActivity,
    getBackupRetentionPolicy,
    applyRetention,
    ...customDeps,
  };

  return async (now = new Date()): Promise<BackupInfo | null> => {
    if (isBackupRunning) {
      console.warn('[backupScheduler] Backup job already running, skipping.');
      return null;
    }
    isBackupRunning = true;
    try {
      const backups = deps.listBackups();
      if (hasBackupToday(backups, now)) {
        console.log('[backupScheduler] Backup for today (UTC) already exists, skipping.');
        return null;
      }

      const available = await deps.isPgToolAvailable();
      if (!available) {
        console.warn('[backupScheduler] pg_dump not available, skipping auto backup.');
        throw new Error('pg_dump not available');
      }

      console.log('[backupScheduler] Starting daily automated backup...');
      const backup = await deps.createBackup('auto');
      await deps.recordBackupActivity('CREATED', backup.filename, { name: 'Lịch tự động' }, 'SYSTEM');
      const retention = deps.getBackupRetentionPolicy();
      deps.applyRetention(retention.retentionCount, retention.maxTotalBytes);
      console.log(`[backupScheduler] Daily backup completed: ${backup.filename}`);
      return backup;
    } finally {
      isBackupRunning = false;
    }
  };
}

export async function runDailyBackupJob(now = new Date()): Promise<BackupInfo | null> {
  const job = createDailyBackupJob();
  return await job(now);
}

export function startDailyBackupScheduler(options?: DailySchedulerOptions): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  const config = {
    ...getSchedulerConfig(),
    ...options,
  };

  if (!config.enabled) {
    console.log('[backupScheduler] Disabled (set BACKUP_ENABLED=true to enable).');
    return;
  }

  const scheduleNext = () => {
    const delayMs = msUntilTargetHour(config.targetHour);
    const nextDate = new Date(Date.now() + delayMs);
    console.log(`[backupScheduler] Next daily backup scheduled at ${nextDate.toISOString()}`);

    schedulerTimer = setTimeout(async () => {
      try {
        await runDailyBackupJob();
      } catch (err: any) {
        console.error('[backupScheduler] Daily backup error:', err?.message || err);
      } finally {
        scheduleNext();
      }
    }, delayMs);
  };

  // If server starts and today has no backup, and last backup was > 24 hours ago, catch up after 60s
  try {
    const backups = listBackups();
    const latest = backups[0];
    const lastBackupAgeMs = latest ? Date.now() - new Date(latest.createdAt).getTime() : Infinity;
    const oneDayMs = 24 * 60 * 60 * 1000;

    if (lastBackupAgeMs >= oneDayMs && !hasBackupToday(backups)) {
      console.log('[backupScheduler] No backup in >24h. Catch-up backup scheduled in 60 seconds.');
      setTimeout(() => {
        runDailyBackupJob().catch((err: any) => {
          console.error('[backupScheduler] Catch-up backup error:', err?.message || err);
        });
      }, 60 * 1000);
    }
  } catch (err: any) {
    console.warn('[backupScheduler] Error checking last backup status:', err?.message);
  }

  scheduleNext();
}

export function stopDailyBackupScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}
