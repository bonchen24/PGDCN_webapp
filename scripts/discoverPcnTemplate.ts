import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { inspectPcnTemplateSource } from '../utils/pcnTemplateDiscovery.ts';

export function runPcnTemplateDiscovery(argv = process.argv.slice(2)): void {
  const sourcePath = argv.find((value) => value.startsWith('--source='))?.slice('--source='.length).trim() || '';
  const sourceRelativePath = argv.find((value) => value.startsWith('--relative='))?.slice('--relative='.length).trim() || '';
  if (!sourcePath || !sourceRelativePath) {
    throw new Error('Dùng: npm run discover:pcn-template -- --source="<file>" --relative="Hồ sơ chứng nhận QCVN4 2026/.../mau.docx"');
  }

  const resolvedSourcePath = path.resolve(sourcePath);
  if (!fs.existsSync(resolvedSourcePath)) throw new Error(`Không tìm thấy file mẫu: ${resolvedSourcePath}`);
  const inspection = inspectPcnTemplateSource({
    fileName: path.basename(resolvedSourcePath),
    sourceRelativePath,
    bytes: fs.readFileSync(resolvedSourcePath),
  });
  console.log(JSON.stringify({ inspectedAt: new Date().toISOString(), sourceFileName: path.basename(resolvedSourcePath), ...inspection }, null, 2));
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  runPcnTemplateDiscovery();
}

// --- End of discoverPcnTemplate.ts ---
