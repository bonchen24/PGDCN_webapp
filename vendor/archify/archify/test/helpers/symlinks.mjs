import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const unsupportedCodes = new Set(['EACCES', 'ENOSYS', 'ENOTSUP', 'EPERM']);

export function symlinkSkipReason() {
  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-symlink-capability-'));
  const fileTarget = path.join(probeRoot, 'target.txt');
  const directoryTarget = path.join(probeRoot, 'target-directory');

  try {
    fs.writeFileSync(fileTarget, 'probe');
    fs.mkdirSync(directoryTarget);
    fs.symlinkSync(fileTarget, path.join(probeRoot, 'file-link'), 'file');
    fs.symlinkSync(directoryTarget, path.join(probeRoot, 'directory-link'), 'dir');
    return false;
  } catch (error) {
    if (unsupportedCodes.has(error?.code)) {
      return 'This host does not permit the file and directory symlinks required by this test.';
    }
    throw error;
  } finally {
    fs.rmSync(probeRoot, { recursive: true, force: true });
  }
}
