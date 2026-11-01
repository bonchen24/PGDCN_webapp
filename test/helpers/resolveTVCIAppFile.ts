import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolve sibling TVCI_APP file by traversing up parent directories.
 */
export function resolveTVCIAppFile(fromModuleUrl: string | URL, ...relativeSegments: string[]): string {
  const startFile = typeof fromModuleUrl === 'string' && fromModuleUrl.startsWith('file:')
    ? fileURLToPath(fromModuleUrl)
    : typeof fromModuleUrl === 'string'
      ? fromModuleUrl
      : fileURLToPath(fromModuleUrl);

  let currentDir = path.dirname(path.resolve(startFile));

  while (true) {
    const candidate = path.resolve(currentDir, 'TVCI_APP', ...relativeSegments);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  const requestedPath = path.join('TVCI_APP', ...relativeSegments);
  throw new Error(`Required sibling TVCI_APP repository/file not found: ${requestedPath}`);
}
