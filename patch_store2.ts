import fs from 'fs';

let content = fs.readFileSync('store.ts', 'utf-8');

// 1. Add uploadToFirebase to interface
if (!content.includes('uploadToFirebase: () => Promise<void>;')) {
  content = content.replace(
    'restoreFromBackup: (backupData: any) => Promise<void>;',
    'restoreFromBackup: (backupData: any) => Promise<void>;\n  uploadToFirebase: () => Promise<void>;'
  );
}

// 2. We will replace the entire restoreFromBackup function
// Let's use regex or string split.
const restoreStartStr = 'restoreFromBackup: async (backupData: any) => {';
const restoreStartIdx = content.indexOf(restoreStartStr);

// Find the end of restoreFromBackup. It ends at `}),\n    {` or similar.
const restoreEndStr = '  }\n    }),\n    {';
const restoreEndIdx = content.indexOf(restoreEndStr, restoreStartIdx);

if (restoreStartIdx > -1 && restoreEndIdx > -1) {
    const originalRestore = content.slice(restoreStartIdx, restoreEndIdx + 3);
    
    // We rewrite both functions
    const newCode = `restoreFromBackup: async (backupData: any) => {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error("Dữ liệu sao lưu không hợp lệ.");
    }

    set({ isLoading: true, isSyncing: false });
    try {
      const nowStr = new Date().toISOString();
      const rawReqs = Array.isArray(backupData.requests) ? backupData.requests : [];
      const rawHandovers = Array.isArray(backupData.handoverDocs) ? backupData.handoverDocs : [];
      const rawKqtn = Array.isArray(backupData.kqtnRecords) ? backupData.kqtnRecords : [];
      const rawCustomers = Array.isArray(backupData.customers) ? backupData.customers : [];
      const rawProducts = Array.isArray(backupData.products) ? backupData.products : [];
      const rawBrands = Array.isArray(backupData.brands) ? backupData.brands : [];
      const rawUsers = Array.isArray(backupData.systemUsers) ? backupData.systemUsers : [];
      const rawDayConfigs = backupData.dayConfigs && typeof backupData.dayConfigs === 'object' ? backupData.dayConfigs : {};
      const rawSettings = backupData.settings && typeof backupData.settings === 'object' ? backupData.settings : {};

      let reqCounter = 0;
      const normalizedRequests = rawReqs.map((r: any) => ({
        ...r,
        id: String(r.id || \`\${r.requestCode || 'req'}-\${Date.now()}-\${reqCounter++}\`),
        updatedAt: nowStr
      }));

      let handoverCounter = 0;
      const normalizedHandoverDocs = rawHandovers.map((h: any) => ({
        ...h,
        id: String(h.id || \`\${h.docNumber || 'doc'}-\${Date.now()}-\${handoverCounter++}\`),
        updatedAt: nowStr
      }));

      let kqtnCounter = 0;
      const normalizedKqtn = rawKqtn.map((k: any) => ({
        ...k,
        id: String(k.id || \`\${k.requestCode || 'kqtn'}-\${Date.now()}-\${kqtnCounter++}\`),
        updatedAt: nowStr
      }));

      const normalizedCustomers = rawCustomers.map((c: any) => {
        const name = String(c.name || '').trim();
        const customerCode = String(c.customerCode || '').trim();
        return { ...c, name: name || customerCode, customerCode, updatedAt: nowStr };
      }).filter((c: any) => c.name || c.customerCode);

      const normalizedProducts = rawProducts.map((p: any) => {
        const name = typeof p === 'string' ? p.trim() : String(p.name || p.id || '').trim();
        const testTimeEMC = typeof p === 'object' && p.testTimeEMC !== undefined ? Number(p.testTimeEMC) : 0;
        const testTimeATD = typeof p === 'object' && p.testTimeATD !== undefined ? Number(p.testTimeATD) : 0;
        return { id: name, name, testTimeEMC: isNaN(testTimeEMC) ? 0 : testTimeEMC, testTimeATD: isNaN(testTimeATD) ? 0 : testTimeATD, updatedAt: nowStr };
      }).filter((p: any) => p.name);

      const normalizedBrands = Array.from(new Set(
        rawBrands.map((b: any) => (typeof b === 'string' ? b.trim() : String(b.name || b.id || '').trim())).filter(Boolean)
      ));

      const currentUsers = get().systemUsers || [];
      let normalizedUsers = currentUsers;
      if (rawUsers.length > 0) {
        normalizedUsers = rawUsers.map((u: any) => ({
          ...u,
          id: String(u.id || u.username || u['Tên đăng nhập'] || Math.random().toString(36).substring(2, 9)),
          updatedAt: nowStr
        }));
      }

      const finalSettings = {
        ...(get().settings || { workOnSaturday: true, workOnSunday: false }),
        ...rawSettings,
        updatedAt: nowStr
      };

      set({
        requests: normalizedRequests,
        handoverDocs: normalizedHandoverDocs,
        kqtnRecords: normalizedKqtn,
        customers: normalizedCustomers,
        products: normalizedProducts,
        brands: normalizedBrands,
        systemUsers: normalizedUsers,
        dayConfigs: rawDayConfigs,
        settings: finalSettings,
        deletedRequestIds: [],
        deletedHandoverDocIds: [],
        deletedCustomerIds: [],
        deletedBrandNames: [],
        deletedProductNames: [],
        deletedUserIds: [],
        hasUnsyncedChanges: false, // Wait, if false it won't auto-sync! That's what we want.
        isLoading: false,
        isSyncing: false
      });

    } catch (err: any) {
      set({ isLoading: false, isSyncing: false });
      console.error("Lỗi restoreFromBackup:", err);
      throw err;
    }
  },

  uploadToFirebase: async () => {
    set({ isLoading: true, isSyncing: true });
    try {
      const nowStr = new Date().toISOString();
      const state = get();
      const {
        requests: normalizedRequests,
        handoverDocs: normalizedHandoverDocs,
        kqtnRecords: normalizedKqtn,
        customers: normalizedCustomers,
        products: normalizedProducts,
        brands: normalizedBrands,
        systemUsers: normalizedUsers,
        dayConfigs: rawDayConfigs,
        settings: finalSettings
      } = state;

      const [
        cloudReqs,
        cloudHandovers,
        cloudKqtnList,
        cloudCusts,
        cloudProds,
        cloudBrandsList
      ] = await Promise.all([
        fetchCollection("requests"),
        fetchCollection("handoverDocs"),
        fetchCollection("kqtnRecords"),
        fetchCollection("customers"),
        fetchCollection("products"),
        fetchCollection("brands")
      ]).catch(() => [[], [], [], [], [], []]);

      const backupReqIdSet = new Set(normalizedRequests.map((r: any) => String(r.id)));
      const backupHandoverIdSet = new Set(normalizedHandoverDocs.map((h: any) => String(h.id)));
      const backupKqtnIdSet = new Set(normalizedKqtn.map((k: any) => String(k.id)));
      const backupCustIdSet = new Set(normalizedCustomers.map((c: any) => String(c.customerCode || c.name || c.id)));
      const backupProdIdSet = new Set(normalizedProducts.map((p: any) => String(p.id || p.name)));
      const backupBrandIdSet = new Set(normalizedBrands as string[]);

      const staleReqIds = cloudReqs.filter((r: any) => r.id && !backupReqIdSet.has(String(r.id))).map((r: any) => String(r.id));
      const staleHandoverIds = cloudHandovers.filter((h: any) => h.id && !backupHandoverIdSet.has(String(h.id))).map((h: any) => String(h.id));
      const staleKqtnIds = cloudKqtnList.filter((k: any) => k.id && !backupKqtnIdSet.has(String(k.id))).map((k: any) => String(k.id));
      const staleCustIds = cloudCusts.filter((c: any) => {
        const id = c.id || c.customerCode || c.name;
        return id && !backupCustIdSet.has(String(id));
      }).map((c: any) => String(c.id || c.customerCode || c.name));
      const staleProdIds = cloudProds.filter((p: any) => {
        const id = p.id || p.name;
        return id && !backupProdIdSet.has(String(id));
      }).map((p: any) => String(p.id || p.name));
      const staleBrandIds = cloudBrandsList.filter((b: any) => {
        const id = b.id || b.name;
        return id && !backupBrandIdSet.has(String(id));
      }).map((b: any) => String(b.id || b.name));

      await Promise.all([
        batchDeleteFromFirestore("requests", staleReqIds),
        batchDeleteFromFirestore("handoverDocs", staleHandoverIds),
        batchDeleteFromFirestore("kqtnRecords", staleKqtnIds),
        batchDeleteFromFirestore("customers", staleCustIds),
        batchDeleteFromFirestore("products", staleProdIds),
        batchDeleteFromFirestore("brands", staleBrandIds)
      ]);

      await Promise.all([
        batchSaveToFirestore("requests", normalizedRequests),
        batchSaveToFirestore("handoverDocs", normalizedHandoverDocs),
        batchSaveToFirestore("kqtnRecords", normalizedKqtn),
        batchSaveToFirestore("customers", normalizedCustomers.map((c: any) => ({ id: c.customerCode || c.name || c.id, ...c }))),
        batchSaveToFirestore("products", normalizedProducts.map((p: any) => ({ id: p.id || p.name, ...p }))),
        batchSaveToFirestore("brands", (normalizedBrands as string[]).map(b => ({ id: b, name: b }))),
        normalizedUsers.length > 0 ? batchSaveToFirestore("systemUsers", normalizedUsers.map((u: any) => ({ id: u.id || u.username, ...u }))) : Promise.resolve()
      ]);

      const cleanConfigs = [
        { id: "deletedRequestIds", configKey: "deletedRequestIds", configValue: "", updatedAt: nowStr },
        { id: "deletedHandoverDocIds", configKey: "deletedHandoverDocIds", configValue: "", updatedAt: nowStr },
        { id: "deletedCustomerIds", configKey: "deletedCustomerIds", configValue: "", updatedAt: nowStr },
        { id: "deletedBrandNames", configKey: "deletedBrandNames", configValue: "", updatedAt: nowStr },
        { id: "deletedProductNames", configKey: "deletedProductNames", configValue: "", updatedAt: nowStr },
        { id: "deletedUserIds", configKey: "deletedUserIds", configValue: "", updatedAt: nowStr },
        { id: "appSettings", configKey: "appSettings", configValue: JSON.stringify(finalSettings), updatedAt: nowStr },
        { id: "dayConfigs", configKey: "dayConfigs", configValue: JSON.stringify(rawDayConfigs), updatedAt: nowStr }
      ];
      await batchSaveToFirestore("systemConfig", cleanConfigs);

      set({
        deletedRequestIds: [],
        deletedHandoverDocIds: [],
        deletedCustomerIds: [],
        deletedBrandNames: [],
        deletedProductNames: [],
        deletedUserIds: [],
        hasUnsyncedChanges: false,
        isLoading: false,
        isSyncing: false
      });

      await get().fetchData(false);
    } catch (err: any) {
      set({ isLoading: false, isSyncing: false });
      console.error("Lỗi uploadToFirebase:", err);
      throw err;
    }
  }
    }),
    {`;

    content = content.slice(0, restoreStartIdx) + newCode + content.slice(restoreEndIdx + 3);
    fs.writeFileSync('store.ts', content);
    console.log("Successfully patched store.ts");
} else {
    console.log("Could not find restore function start or end");
}
