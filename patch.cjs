const fs = require('fs');
let code = fs.readFileSync('store.ts', 'utf8');

const target = `      if (configsToSave.length > 0) {
        await batchSaveToFirestore("systemConfig", configsToSave.map(cfg => ({ id: cfg.configKey, ...cfg })));
      }`;

const target2 = `      if (hasOutgoingChanges) {
        await saveDocToFirestore("systemConfig", "sync_signal", { timestamp: nowStr, sender: get().currentUser?.username || 'unknown', clientId: CLIENT_ID }).catch(() => {});
      }

      if (mergedNotifications.length > 0 && (!cloudNotifsRaw || cloudNotifsRaw.length === 0)) {
        await batchSaveToFirestore("notifications", mergedNotifications.slice(0, 30));
      }

      const localKqtn = get().kqtnRecords || [];`;

code = code.replace(
  `      if (configsToSave.length > 0) {
        await batchSaveToFirestore("systemConfig", configsToSave.map(cfg => ({ id: cfg.configKey, ...cfg })));
      }`,
  `      if (configsToSave.length > 0) {
        await batchSaveToFirestore("systemConfig", configsToSave.map(cfg => ({ id: cfg.configKey, ...cfg })));
      }

      const cloudNotifsMap = new Map<string, any>();
      (cloudNotifsRaw || []).forEach((n: any) => cloudNotifsMap.set(n.id, n));

      const notifsToSave: any[] = [];
      mergedNotifications.forEach(n => {
        const cloud = cloudNotifsMap.get(n.id);
        if (!cloud || n.read !== cloud.read) {
          notifsToSave.push(n);
        }
      });`
);

code = code.replace(
  `configsToSave.length > 0 ||`,
  `configsToSave.length > 0 ||\n                                notifsToSave.length > 0 ||`
);

code = code.replace(
  `if (mergedNotifications.length > 0 && (!cloudNotifsRaw || cloudNotifsRaw.length === 0)) {
        await batchSaveToFirestore("notifications", mergedNotifications.slice(0, 30));
      }`,
  `if (notifsToSave.length > 0) {
        await batchSaveToFirestore("notifications", notifsToSave);
      }`
);

fs.writeFileSync('store.ts', code);
