import fs from 'fs';
let content = fs.readFileSync('store.ts', 'utf8');

content = content.replace(
  /if \(r && !mergedDeletedRequestIds\.includes\(r\.id\) && \(r\.modelName\?\.toString\(\)\.trim\(\) \|\| r\.requestCode\?\.toString\(\)\.trim\(\) \|\| r\.customerName\?\.toString\(\)\.trim\(\)\)\) \{/g,
  'if (r && !mergedDeletedRequestIds.includes(r.id)) {'
);

content = content.replace(
  /if \(!c \|\| \(!c\.modelName\?\.toString\(\)\.trim\(\) && !c\.requestCode\?\.toString\(\)\.trim\(\) && !c\.customerName\?\.toString\(\)\.trim\(\)\)\) return;/g,
  'if (!c) return;'
);

fs.writeFileSync('store.ts', content, 'utf8');
console.log('Patched store.ts successfully');
