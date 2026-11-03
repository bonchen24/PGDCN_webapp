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
} from './backupManager';

let schedulerTimer: NodeJS.Timeout | null = null;
let isBackupRunning = false;

export interface DailySchedulerOptions {
  enabled?: boolean;
  targetHour?: number; // 0-23, default 2 (02:00 AM)
}

export function getSchedulerConfig(env: NodeJS.ProcessEnv = process.env): {
  enabled: boolean;
  targetHour: number;
} {
  const enabled = String(env.BACKUP_ENABLED || '').toLowerCase() === 'true';
  const targetHourParsed = parseInt(env.BACKUP_HOUR || '2', 10);
  const targetHour =
    !isNaN(targetHourParsed) && targetHourParsed >= 0 && targetHourParsed <= 23
      ? targetHourParsed
      : 2;
  return { enabled, targetHour };
}

export function msUntilTargetHour(targetHour: number, now = new Date()): number {
  const target = new Date(now);
  target.setHours(targetHour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

export function hasBackupToday(backups = listBackups(), now = new Date()): boolean {
  if (backups.length === 0) return false;
  const todayDateStr = now.toISOString().slice(0, 10);
  return backups.some((b) => b.createdAt.slice(0, 10) === todayDateStr);
}

export async function runDailyBackupJob(): Promise<void> {
  if (isBackupRunning) {
    console.warn('[backupScheduler] Backup job already running, skipping.');
    return;
  }
  isBackupRunning = true;
  try {
    const available = await isPgToolAvailable();
    if (!available) {
      console.warn('[backupScheduler] pg_dump not available, skipping auto backup.');
      return;
    }
    console.log('[backupScheduler] Starting daily automated backup...');
    const backup = await createBackup('auto');
    await recordBackupActivity('CREATED', backup.filename, { name: 'Lịch tự động' }, 'SYSTEM');
    const retention = getBackupRetentionPolicy();
    applyRetention(retention.retentionCount, retention.maxTotalBytes);
    console.log(`[backupScheduler] Daily backup completed: ${backup.filename}`);
  } catch (err: any) {
    console.error('[backupScheduler] Daily backup error:', err?.message || err);
  } finally {
    isBackupRunning = false;
  }
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
    console.log(`[backupScheduler] Next daily backup scheduled at ${nextDate.toLocaleString('vi-VN')}`);

    schedulerTimer = setTimeout(async () => {
      try {
        await runDailyBackupJob();
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
        runDailyBackupJob().catch(() => {});
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
