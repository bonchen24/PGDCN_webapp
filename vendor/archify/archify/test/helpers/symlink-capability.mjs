import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const UNSUPPORTED_SYMLINK_CODES = new Set(['EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS']);

export function requireSymlinkCapability(testContext, type = 'file') {
  const probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-symlink-capability-'));
  const target = path.join(probeRoot, type === 'dir' ? 'target-directory' : 'target-file');
  const link = path.join(probeRoot, 'probe-link');
  try {
    if (type === 'dir') fs.mkdirSync(target);
    else fs.writeFileSync(target, 'symlink capability probe');
    fs.symlinkSync(target, link, type);
    return true;
  } catch (error) {
    if (UNSUPPORTED_SYMLINK_CODES.has(error?.code)) {
      testContext.skip(`${type} symlink creation unavailable: ${error.code}`);
      return false;
    }
    throw error;
  } finally {
    fs.rmSync(probeRoot, { recursive: true, force: true });
  }
}
