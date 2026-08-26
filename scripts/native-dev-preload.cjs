// Work around Node.js 26 returning ENOMEM from os.userInfo() while the host is
// under memory pressure. tsx uses that call only to choose its temp directory.
const os = require('node:os');
const path = require('node:path');

// tsx starts a child Node process for the watched entrypoint. Propagate this
// preload so the child gets the same safe os.userInfo() implementation.
const preloadPath = path.resolve(__dirname, 'native-dev-preload.cjs');
const nodeOptions = process.env.NODE_OPTIONS || '';
if (!nodeOptions.includes(preloadPath)) {
  process.env.NODE_OPTIONS = `${nodeOptions} --require=${preloadPath}`.trim();
}

try {
  os.userInfo();
} catch (error) {
  const isUserInfoOutOfMemory =
    error?.code === 'ENOMEM' ||
    error?.info?.code === 'ENOMEM' ||
    error?.syscall === 'uv_os_get_passwd';

  if (!isUserInfoOutOfMemory) throw error;

  Object.defineProperty(os, 'userInfo', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: () => ({
      username: process.env.USERNAME || 'ddt-dev',
      uid: -1,
      gid: -1,
      shell: null,
      homedir: process.env.USERPROFILE || process.env.HOME || '',
    }),
  });
}
