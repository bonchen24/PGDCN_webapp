// Author: Claude
// OS support: Web/Node
// Description: REST client for server-side pg_dump backup management

export interface ServerBackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ServerBackupVerification {
  filename: string;
  format: 'zip' | 'dump';
  sizeBytes: number;
  databaseDumpPresent: boolean;
  manifestPresent: boolean;
  manifestObjectCount: number;
  objectEntryCount: number;
  verifiedObjectCount: number;
  missingObjectCount: number;
  invalidObjectCount: number;
  pgToolAvailable: boolean;
  dumpReadable: boolean;
  status: 'VALID' | 'INVALID';
  ok: boolean;
  errors: string[];
}

interface BackupListResponse {
  items: ServerBackupInfo[];
  pgToolAvailable: boolean;
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || payload?.message;
    const error = new Error(message || `Backup API trả về HTTP ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return payload;
}

function backupHeaders(): HeadersInit {
  return {
    'content-type': 'application/json',
  };
}

function resolveFilename(arg1?: string, arg2?: string): string {
  if (typeof arg2 === 'string') return arg2;
  if (typeof arg1 === 'string') return arg1;
  return '';
}

export async function fetchBackupList(_username?: string): Promise<BackupListResponse> {
  const response = await fetch('/api/backups', {
    credentials: 'same-origin',
    headers: backupHeaders(),
  });
  return parseResponse(response);
}

export async function triggerServerBackup(_username?: string): Promise<ServerBackupInfo> {
  const response = await fetch('/api/backups/run', {
    method: 'POST',
    credentials: 'same-origin',
    headers: backupHeaders(),
  });
  return parseResponse(response);
}

export async function verifyBackupFile(arg1?: string, arg2?: string): Promise<ServerBackupVerification> {
  const filename = resolveFilename(arg1, arg2);
  const response = await fetch(`/api/backups/${encodeURIComponent(filename)}/verify`, {
    credentials: 'same-origin',
    headers: backupHeaders(),
  });
  return parseResponse(response);
}

export async function downloadBackupFile(arg1?: string, arg2?: string): Promise<void> {
  const filename = resolveFilename(arg1, arg2);
  const response = await fetch(`/api/backups/${encodeURIComponent(filename)}/download`, {
    credentials: 'same-origin',
    headers: backupHeaders(),
  });
  if (!response.ok) {
    await parseResponse(response);
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreServerBackup(arg1?: string, arg2?: string): Promise<void> {
  const filename = resolveFilename(arg1, arg2);
  const response = await fetch(`/api/backups/${encodeURIComponent(filename)}/restore`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: backupHeaders(),
    body: JSON.stringify({ confirm: 'KHOIPHUC' }),
  });
  await parseResponse(response);
}

export async function deleteBackupFile(arg1?: string, arg2?: string): Promise<void> {
  const filename = resolveFilename(arg1, arg2);
  const response = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: backupHeaders(),
  });
  await parseResponse(response);
}

// --- End of backupApi.ts ---
