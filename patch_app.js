import fs from 'fs';
let content = fs.readFileSync('App.tsx', 'utf8');

if (!content.includes('setupRealtimeSync')) {
  content = content.replace(
    'fetchData, isLoading, isSyncing',
    'fetchData, setupRealtimeSync, isLoading, isSyncing'
  );
  
  content = content.replace(
    'if (fetchData) fetchData();',
    'if (fetchData) fetchData();\n    if (setupRealtimeSync) setupRealtimeSync();'
  );
  
  fs.writeFileSync('App.tsx', content, 'utf8');
  console.log('Patched App.tsx');
}
