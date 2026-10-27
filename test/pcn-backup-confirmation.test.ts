import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  isArchiveVerifiedForRestore,
  restoreDialogFocus,
  runBackupAction,
  type DialogFocusTarget,
  type RestoreDialogFocusOptions,
} from '../components/BackupRestoreAdminPanel';
import { restoreServerBackup } from '../utils/backupApi';

const panelSource = fs.readFileSync(
  new URL('../components/BackupRestoreAdminPanel.tsx', import.meta.url),
  'utf8',
);

test('replaces window.confirm with Vietnamese delete confirmation dialog and impact notice', () => {
  // 1. No window.confirm anywhere in the component
  assert.doesNotMatch(panelSource, /window\.confirm/);

  // 2. Dialog semantics
  assert.match(panelSource, /role=["']dialog["']/);
  assert.match(panelSource, /aria-modal=["']true["']/);

  // 3. Deletion impact notice: permanently removes archive from future download/restore, does not change live database
  assert.match(panelSource, /xóa vĩnh viễn/i);
  assert.match(panelSource, /không thể tải về hoặc khôi phục/i);
  assert.match(panelSource, /không làm thay đổi cơ sở dữ liệu hiện tại/i);
});

test('restore confirmation dialog explains overwrite impact on live database and files', () => {
  // Overwrites live database and files, may lose changes made after archive
  assert.match(panelSource, /ghi đè toàn bộ cơ sở dữ liệu và tệp tin hiện tại/i);
  assert.match(panelSource, /sau thời điểm tạo bản sao lưu/i);
});

test('both delete and restore require exact case-sensitive XAC NHAN confirmation without normalization', () => {
  // Replaces legacy KHOIPHUC completely
  assert.doesNotMatch(panelSource, /KHOIPHUC/);

  // Exact string XAC NHAN required
  assert.match(panelSource, /['"]XAC NHAN['"]/);
  assert.doesNotMatch(panelSource, /\.trim\(\)\s*===?\s*['"]XAC NHAN['"]/);
  assert.doesNotMatch(panelSource, /\.toLowerCase\(\)\s*===?\s*['"]xac nhan['"]/);

  // CTA texts match exact requirements
  assert.match(panelSource, /Xóa bản sao lưu/);
  assert.match(panelSource, /Khôi phục/);

  // Handlers must check confirmation string immediately before calling API
  assert.match(panelSource, /confirmInput\s*!==\s*['"]XAC NHAN['"]/);
  assert.match(panelSource, /deleteBackupFile/);
  assert.match(panelSource, /restoreServerBackup/);
});

test('dialog supports safe cancellation, resets confirmation text, and locks during flight', () => {
  // Escape and Hủy handling
  assert.match(panelSource, /key === ['"]Escape['"]/);
  assert.match(panelSource, /Hủy/);

  // In-flight locking: cannot close or edit while deleting/restoring
  assert.match(panelSource, /disabled=\{[^}]*(?:restoring|deleting)/);

  // Resets typed text when dialog closes or target changes
  assert.match(panelSource, /setConfirmInput\(['"]['"]\)/);
});

test('restoring enforces successful verification gate before opening confirmation', () => {
  // Checks verification before opening restore modal and prompts admin
  assert.match(panelSource, /handleOpenRestore/);
  assert.match(panelSource, /isArchiveVerified|verificationResult/);
  assert.match(panelSource, /kiểm chứng/i);
});

test('provides accessibility with dialog semantics, labelled inputs, and focus management', () => {
  assert.match(panelSource, /aria-labelledby=/);
  assert.match(panelSource, /aria-describedby=/);
  assert.match(panelSource, /<label\s+[^>]*htmlFor=/);
  assert.match(panelSource, /inputRef/);
  assert.match(panelSource, /lastFocusedElementRef/);
});

test('restore preflight strictly requires ok=true and status=VALID when status is present', () => {
  // Reject when ok is false even if status is VALID
  assert.equal(isArchiveVerifiedForRestore({ ok: false, status: 'VALID' as any }), false);
  // Reject when ok is true but status is INVALID
  assert.equal(isArchiveVerifiedForRestore({ ok: true, status: 'INVALID' as any }), false);
  // Accept when ok is true and status is VALID
  assert.equal(isArchiveVerifiedForRestore({ ok: true, status: 'VALID' as any }), true);
  // Accept when ok is true and status is absent/undefined
  assert.equal(isArchiveVerifiedForRestore({ ok: true }), true);
  // Reject null or undefined
  assert.equal(isArchiveVerifiedForRestore(null), false);
  assert.equal(isArchiveVerifiedForRestore(undefined), false);
});

test('focus restoration prefers connected opener and falls back to panel when opener is detached', () => {
  let focusedTarget = '';
  const connectedOpener: DialogFocusTarget = {
    focus: () => { focusedTarget = 'opener'; },
    isConnected: true,
  };
  const fallback: DialogFocusTarget = {
    focus: () => { focusedTarget = 'fallback'; },
    isConnected: true,
  };

  // Connected opener gets focused
  const res1 = restoreDialogFocus(connectedOpener, fallback);
  assert.equal(res1, 'opener');
  assert.equal(focusedTarget, 'opener');

  // Detached opener triggers fallback focus
  focusedTarget = '';
  const detachedOpener: DialogFocusTarget = {
    focus: () => { focusedTarget = 'opener'; },
    isConnected: false,
  };
  const res2 = restoreDialogFocus(detachedOpener, fallback);
  assert.equal(res2, 'fallback');
  assert.equal(focusedTarget, 'fallback');

  // Null opener triggers fallback focus
  focusedTarget = '';
  const res3 = restoreDialogFocus(null, fallback);
  assert.equal(res3, 'fallback');
  assert.equal(focusedTarget, 'fallback');

  // Explicit focusTarget: 'fallback' directly selects fallback even when opener is connected
  focusedTarget = '';
  const res4 = restoreDialogFocus(connectedOpener, fallback, { focusTarget: 'fallback' });
  assert.equal(res4, 'fallback');
  assert.equal(focusedTarget, 'fallback');

  // Explicit focusTarget: 'opener' selects connected opener
  focusedTarget = '';
  const res5 = restoreDialogFocus(connectedOpener, fallback, { focusTarget: 'opener' });
  assert.equal(res5, 'opener');
  assert.equal(focusedTarget, 'opener');
});

test('runBackupAction focus target selection: restore success returns focus to connected opener while delete success selects panel fallback', async () => {
  let focusedTarget = '';
  const opener: DialogFocusTarget = {
    focus: () => { focusedTarget = 'opener'; },
    isConnected: true,
  };
  const fallback: DialogFocusTarget = {
    focus: () => { focusedTarget = 'fallback'; },
    isConnected: true,
  };

  const forceCloseDialog = (options?: RestoreDialogFocusOptions) => {
    restoreDialogFocus(opener, fallback, options);
  };

  // 1. Delete success selects fallback directly even if opener is connected
  focusedTarget = '';
  await runBackupAction({
    type: 'delete',
    target: { filename: 'test-backup.zip', sizeBytes: 100, createdAt: '2026-10-27' },
    confirmInput: 'XAC NHAN',
    inFlightRef: { current: false },
    setBusy: () => {},
    setDialogError: () => {},
    performApi: async () => {},
    forceCloseDialog,
  });
  assert.equal(focusedTarget, 'fallback', 'delete success must select panel fallback directly');

  // 2. Restore success returns focus to connected opener
  focusedTarget = '';
  await runBackupAction({
    type: 'restore',
    target: { filename: 'test-backup.zip', sizeBytes: 100, createdAt: '2026-10-27' },
    confirmInput: 'XAC NHAN',
    inFlightRef: { current: false },
    setBusy: () => {},
    setDialogError: () => {},
    performApi: async () => {},
    forceCloseDialog,
  });
  assert.equal(focusedTarget, 'opener', 'restore success must return focus to connected opener');

  // 3. Ordinary cancellation without options prefers connected opener
  focusedTarget = '';
  restoreDialogFocus(opener, fallback);
  assert.equal(focusedTarget, 'opener', 'cancellation with connected opener selects opener');

  // 4. Ordinary cancellation with detached opener falls back to panel
  focusedTarget = '';
  const detachedOpener: DialogFocusTarget = {
    focus: () => { focusedTarget = 'opener'; },
    isConnected: false,
  };
  restoreDialogFocus(detachedOpener, fallback);
  assert.equal(focusedTarget, 'fallback', 'cancellation with detached opener selects fallback');
});

test('runBackupAction executes success path: calls API once, closes dialog, resets confirmation/error, and restores focus', async () => {
  const inFlightRef = { current: false };
  let busyState = false;
  let dialogError: string | null = 'stale error';
  let dialogClosed = false;
  let confirmInput = 'XAC NHAN';
  let apiCalls = 0;
  let focusedTarget = '';

  const opener: DialogFocusTarget = {
    focus: () => { focusedTarget = 'opener'; },
    isConnected: true,
  };
  const fallback: DialogFocusTarget = {
    focus: () => { focusedTarget = 'fallback'; },
  };

  const fakeApi = async () => {
    apiCalls++;
    assert.equal(busyState, true, 'busy state must be true while API is in-flight');
    assert.equal(inFlightRef.current, true, 'inFlightRef must be true while API is in-flight');
  };

  const forceCloseDialog = (options?: RestoreDialogFocusOptions) => {
    dialogClosed = true;
    confirmInput = '';
    dialogError = null;
    restoreDialogFocus(opener, fallback, options);
  };

  const result = await runBackupAction({
    type: 'delete',
    target: { filename: 'test-backup.zip', sizeBytes: 1024, createdAt: '2026-10-27' },
    confirmInput,
    inFlightRef,
    setBusy: (busy) => { busyState = busy; },
    setDialogError: (err) => { dialogError = err; },
    performApi: fakeApi,
    forceCloseDialog,
  });

  assert.equal(result, true);
  assert.equal(apiCalls, 1);
  assert.equal(dialogClosed, true);
  assert.equal(confirmInput, '');
  assert.equal(dialogError, null);
  assert.equal(busyState, false);
  assert.equal(inFlightRef.current, false);
  assert.equal(focusedTarget, 'fallback');
});

test('runBackupAction handles API failure: keeps dialog and confirmation open, sets inline error, does not retry', async () => {
  const inFlightRef = { current: false };
  let busyState = false;
  let dialogError: string | null = null;
  let dialogClosed = false;
  let confirmInput = 'XAC NHAN';
  let apiCalls = 0;

  const fakeFailingApi = async () => {
    apiCalls++;
    throw new Error('Disk full error from server');
  };

  const forceCloseDialog = () => {
    dialogClosed = true;
  };

  const result = await runBackupAction({
    type: 'delete',
    target: { filename: 'test-backup.zip', sizeBytes: 1024, createdAt: '2026-10-27' },
    confirmInput,
    inFlightRef,
    setBusy: (busy) => { busyState = busy; },
    setDialogError: (err) => { dialogError = err; },
    performApi: fakeFailingApi,
    forceCloseDialog,
    defaultErrorMessage: 'Xóa thất bại',
  });

  assert.equal(result, false);
  assert.equal(apiCalls, 1);
  assert.equal(dialogClosed, false, 'dialog must NOT close on API failure');
  assert.equal(confirmInput, 'XAC NHAN', 'confirmation input must NOT be reset on failure');
  assert.equal(dialogError, 'Disk full error from server');
  assert.equal(busyState, false);
  assert.equal(inFlightRef.current, false);
});

test('runBackupAction prevents duplicate calls on rapid concurrent activation', async () => {
  const inFlightRef = { current: false };
  let busyState = false;
  let dialogError: string | null = null;
  let apiCalls = 0;
  let resolveFirstCall: () => void = () => {};

  const fakeSlowApi = () => {
    apiCalls++;
    return new Promise<void>((resolve) => {
      resolveFirstCall = resolve;
    });
  };

  const forceCloseDialog = () => {};

  // First trigger begins async execution
  const promise1 = runBackupAction({
    type: 'restore',
    target: { filename: 'backup.zip', sizeBytes: 2048, createdAt: '2026-10-27' },
    confirmInput: 'XAC NHAN',
    inFlightRef,
    setBusy: (busy) => { busyState = busy; },
    setDialogError: (err) => { dialogError = err; },
    performApi: fakeSlowApi,
    forceCloseDialog,
  });

  // Rapid second trigger while first is still pending
  const promise2 = runBackupAction({
    type: 'restore',
    target: { filename: 'backup.zip', sizeBytes: 2048, createdAt: '2026-10-27' },
    confirmInput: 'XAC NHAN',
    inFlightRef,
    setBusy: (busy) => { busyState = busy; },
    setDialogError: (err) => { dialogError = err; },
    performApi: fakeSlowApi,
    forceCloseDialog,
  });

  const res2 = await promise2;
  assert.equal(res2, false, 'second concurrent activation must be rejected');
  assert.equal(apiCalls, 1, 'API must only be called once');

  // Let first call complete
  resolveFirstCall();
  const res1 = await promise1;
  assert.equal(res1, true);
  assert.equal(apiCalls, 1);
  assert.equal(busyState, false);
  assert.equal(inFlightRef.current, false);
});

test('runBackupAction rejects immediately if confirmInput is not exact XAC NHAN', async () => {
  const inFlightRef = { current: false };
  let apiCalls = 0;

  const res = await runBackupAction({
    type: 'delete',
    target: { filename: 'backup.zip', sizeBytes: 100, createdAt: '2026-10-27' },
    confirmInput: 'xac nhan', // incorrect case
    inFlightRef,
    setBusy: () => {},
    setDialogError: () => {},
    performApi: async () => { apiCalls++; },
    forceCloseDialog: () => {},
  });

  assert.equal(res, false);
  assert.equal(apiCalls, 0);
});

test('runBackupAction closes dialog before deferred onSuccess resolves and does not fail mutation on refresh rejection', async () => {
  const inFlightRef = { current: false };
  let dialogClosed = false;
  let dialogError: string | null = null;
  let resolveDeferredRefresh: () => void = () => {};
  let refreshStarted = false;

  const deferredRefresh = new Promise<void>((resolve) => {
    resolveDeferredRefresh = resolve;
  });

  const actionPromise = runBackupAction({
    type: 'delete',
    target: { filename: 'test-del.zip', sizeBytes: 100, createdAt: '2026-10-27' },
    confirmInput: 'XAC NHAN',
    inFlightRef,
    setBusy: () => {},
    setDialogError: (err) => { dialogError = err; },
    performApi: async () => {},
    onSuccess: () => {
      refreshStarted = true;
      return deferredRefresh;
    },
    forceCloseDialog: () => {
      dialogClosed = true;
    },
  });

  // Yield to allow microtasks (performApi resolution and subsequent steps)
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(refreshStarted, true, 'onSuccess refresh must have started');
  assert.equal(dialogClosed, true, 'dialog must be force-closed immediately upon performApi resolution, before onSuccess completes');

  // Complete refresh
  resolveDeferredRefresh();
  const res = await actionPromise;
  assert.equal(res, true);
  assert.equal(dialogError, null);
});

test('runBackupAction treats performApi resolution as mutation success even if onSuccess rejects', async () => {
  const inFlightRef = { current: false };
  let dialogClosed = false;
  let dialogError: string | null = null;

  const res = await runBackupAction({
    type: 'delete',
    target: { filename: 'test-del.zip', sizeBytes: 100, createdAt: '2026-10-27' },
    confirmInput: 'XAC NHAN',
    inFlightRef,
    setBusy: () => {},
    setDialogError: (err) => { dialogError = err; },
    performApi: async () => {},
    onSuccess: async () => {
      throw new Error('Network timeout during list refresh');
    },
    forceCloseDialog: () => {
      dialogClosed = true;
    },
    defaultErrorMessage: 'Không thể xóa tệp sao lưu.',
  });

  assert.equal(res, true, 'mutation must succeed despite refresh failure');
  assert.equal(dialogClosed, true);
  assert.equal(dialogError, null, 'refresh error must not be reported as dialog error');
});

test('closeDialog guards against in-flight operations directly and Escape prevents default', () => {
  assert.match(panelSource, /closeDialog[\s\S]*?actionInFlightRef\.current/);
  assert.match(panelSource, /key === ['"]Escape['"][\s\S]*?preventDefault\(\)/);
});

test('restore preflight feedback accurately informs user that verification requires ok=true and status=VALID when status is returned', () => {
  assert.match(panelSource, /ok=true.*status=VALID/i);
});

test('restoreServerBackup client wrapper contract: posts to restore endpoint with auth header and KHOIPHUC token', async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = '';
  let interceptedInit: RequestInit | undefined;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      interceptedUrl = String(input);
      interceptedInit = init;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    await restoreServerBackup('admin-user', 'backup-target.zip');

    assert.equal(interceptedUrl, '/api/backups/backup-target.zip/restore');
    assert.equal(interceptedInit?.method, 'POST');
    const headers = interceptedInit?.headers as Record<string, string>;
    assert.equal(headers['content-type'], 'application/json');
    assert.equal(headers['x-user-name'], 'admin-user');
    assert.deepEqual(JSON.parse(interceptedInit?.body as string), { confirm: 'KHOIPHUC' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
