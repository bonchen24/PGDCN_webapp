// Author: Codex
// Description: Run a PCN maintenance TypeScript command with the PCN profile locked.

const { spawn } = require('node:child_process');
const path = require('node:path');

const [entryPoint, ...entryArgs] = process.argv.slice(2);
if (!entryPoint) {
  console.error('Thiếu entrypoint lệnh PCN.');
  process.exit(2);
}
process.env.APP_PROFILE = 'pcn';

const rootDir = path.resolve(__dirname, '..');
const preloadPath = path.resolve(__dirname, 'native-dev-preload.cjs');
const tsxPath = path.resolve(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawn(
  process.execPath,
  ['--require', preloadPath, tsxPath, entryPoint, ...entryArgs],
  {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  },
);

child.once('error', (error) => {
  console.error(`Không thể chạy lệnh PCN: ${error.message}`);
  process.exitCode = 1;
});

child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Lệnh PCN kết thúc bởi tín hiệu ${signal}.`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
