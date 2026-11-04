// Author: Gemini
// OS support: Web/Node
// Description: Trigger one-shot daily backup with retention from CLI/Cron

import { runDailyBackupJob } from '../utils/backupScheduler';

async function main() {
  await runDailyBackupJob();
}

main().catch((err) => {
  console.error('Daily backup failed:', err);
  process.exit(1);
});
