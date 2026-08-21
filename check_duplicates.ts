import fs from 'fs';

async function check() {
  const files = fs.readdirSync('./public');
  let backupFile = files.find(f => f.endsWith('.json') && f.includes('backup'));
  if (!backupFile) {
      console.log("No backup file in public, checking in ./");
      const rootFiles = fs.readdirSync('./');
      backupFile = rootFiles.find(f => f.endsWith('.json') && f.includes('backup'));
  }
  
  if (!backupFile) {
     console.log("Could not find any backup JSON file.");
     return;
  }
  
  const content = fs.readFileSync(backupFile, 'utf-8');
  const data = JSON.parse(content);
  
  const rawReqs = data.requests || [];
  console.log("Total raw requests in JSON:", rawReqs.length);
  
  const idCounts: Record<string, number> = {};
  rawReqs.forEach(r => {
      const id = String(r.id || r.requestCode || "missing");
      idCounts[id] = (idCounts[id] || 0) + 1;
  });
  
  const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
  console.log("Duplicate IDs:", duplicates.length);
  if (duplicates.length > 0) {
      console.log("Top 5 duplicates:", duplicates.slice(0, 5));
  }
}

check().catch(console.error);
