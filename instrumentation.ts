export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startDailyBackupScheduler } = await import('./utils/backupScheduler');
    startDailyBackupScheduler();
  }
}
