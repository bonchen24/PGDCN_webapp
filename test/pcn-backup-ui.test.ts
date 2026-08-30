import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');
const backupViewPath = new URL('../components/PcnBackupView.tsx', import.meta.url);
const backupApiSource = fs.readFileSync(new URL('../utils/backupApi.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('PCN shell exposes backup module only to Admin', () => {
  assert.match(workspaceSource, /PcnBackupView/);
  assert.match(workspaceSource, /'backup'/);
  assert.match(workspaceSource, /systemRole === 'admin' \|\| currentUser\.role === 'admin'/);
  assert.match(workspaceSource, /activeSection === 'backup'/);
});

test('PCN backup view keeps restore confirmation and server API boundary', () => {
  assert.equal(fs.existsSync(backupViewPath), true);
  const source = fs.readFileSync(backupViewPath, 'utf8');
  assert.match(source, /fetchBackupList/);
  assert.match(source, /triggerServerBackup/);
  assert.match(source, /restoreServerBackup/);
  assert.match(source, /deleteBackupFile/);
  assert.match(source, /KHOIPHUC/);
  assert.match(source, /return null/);
  assert.doesNotMatch(source, /useStore|ddt_lab|collection/);
});

test('backup design defines the PCN shell access and reload contract', () => {
  assert.match(designSource, /Module Sao lưu & khôi phục trong shell PCN/);
  assert.match(designSource, /systemRole=admin/);
  assert.match(designSource, /KHOIPHUC/);
  assert.match(designSource, /tải lại Store PCN/);
  assert.match(workspaceSource, /PcnBackupView[\s\S]*onRestored=\{async \(\) => \{ await pcn\.load\(true\); \}\}/);
});

test('PCN backup archive verification stays inside the Admin API boundary', () => {
  const source = fs.readFileSync(backupViewPath, 'utf8');
  assert.match(source, /verifyBackupFile/);
  assert.match(source, /Kiểm tra archive/);
  assert.match(backupApiSource, /\/api\/backups\/.+\/verify/);
  assert.match(serverSource, /app\.get\("\/api\/backups\/:filename\/verify", requireAdmin/);
  assert.match(designSource, /Cổng sẵn sàng backup trước cutover/);
});

test('PCN restore confirmation requires a successful archive preflight in the UI', () => {
  const source = fs.readFileSync(backupViewPath, 'utf8');
  assert.match(source, /const verified = verificationByFilename\[backup\.filename\]\?\.ok === true/);
  assert.match(source, /disabled=\{!verified \|\| isRestoring \|\| isDeleting\}/);
  assert.match(designSource, /archive đã có kết quả kiểm chứng `ok=true` trước khi mở bước xác nhận/);
});

test('PCN backup view verifies a newly created import checkpoint immediately', () => {
  const source = fs.readFileSync(backupViewPath, 'utf8');
  assert.match(source, /Tạo checkpoint trước import/);
  assert.match(source, /const created = await triggerServerBackup\(username\)/);
  assert.match(source, /const verification = await verifyBackupFile\(username, created\.filename\)/);
  assert.match(source, /checkpoint.*import/i);
});
