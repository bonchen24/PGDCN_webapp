import fs from 'fs';

let content = fs.readFileSync('utils/firebase.ts', 'utf8');

const updateSignalCode = `
export async function triggerSyncSignal(): Promise<void> {
  try {
    const docRef = doc(db, "systemConfig", "sync_signal");
    await setDoc(docRef, { updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.warn("Failed to trigger sync signal:", error);
  }
}
`;

if (!content.includes('triggerSyncSignal')) {
  content = content.replace('export async function saveDocToFirestore', updateSignalCode + '\nexport async function saveDocToFirestore');
  
  content = content.replace(/await withTimeout\([\s\S]*?batch\.commit\(\)[\s\S]*?\);/g, (match) => {
    return match + '\n      triggerSyncSignal();';
  });

  content = content.replace(/await withTimeout\([\s\S]*?setDoc\([\s\S]*?\);/g, (match) => {
    return match + '\n    triggerSyncSignal();';
  });
  
  content = content.replace(/await withTimeout\([\s\S]*?deleteDoc\([\s\S]*?\);/g, (match) => {
    return match + '\n    triggerSyncSignal();';
  });

  fs.writeFileSync('utils/firebase.ts', content, 'utf8');
  console.log('Patched firebase.ts');
}
