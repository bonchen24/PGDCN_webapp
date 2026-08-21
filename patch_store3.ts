import fs from 'fs';
let content = fs.readFileSync('store.ts', 'utf-8');
content = content.replace(
  /const normalizedBrands = Array\.from\(new Set\(\s*rawBrands\.map\(\(b: any\) => \(typeof b === 'string' \? b\.trim\(\) : String\(b\.name \|\| b\.id \|\| ''\)\.trim\(\)\)\)\.filter\(Boolean\)\s*\)\);/,
  "const normalizedBrands = Array.from(new Set(rawBrands.map((b: any) => (typeof b === 'string' ? b.trim() : String(b.name || b.id || '').trim())).filter(Boolean))) as string[];"
);
fs.writeFileSync('store.ts', content);
