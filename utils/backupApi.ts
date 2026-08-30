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
    throw new Error(message || `Backup API trả về HTTP ${response.status}`);
  }
  return payload;
}

function authHeaders(username: string): HeadersInit {
  return {
    'content-type': 'application/json',
    'x-user-name': username,
  };
}

export async function fetchBackupList(username: string): Promise<BackupListResponse> {
  const response = await fetch('/api/backups', { headers: authHeaders(username) });
  return parseResponse(response);
}

export async function triggerServerBackup(username: string): Promise<ServerBackupInfo> {
  const response = await fetch('/api/backups/run', { method: 'POST', headers: authHeaders(username) });
  return parseResponse(response);
}

export async function verifyBackupFile(username: string, filename: string): Promise<ServerBackupVerification> {
  const response = await fetch(`/api/backups/${encodeURIComponent(filename)}/verify`, {
    headers: authHeaders(username),
  });
  return parseResponse(response);
}

export async function downloadBackupFile(username: string, filename: string): Promise<void> {
  const response = await fetch(`/api/backups/${encodeURIComponent(filename)}/download`, {
    headers: authHeaders(username),
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

export async function restoreServerBackup(username: string, filename: string): Promise<void> {
  const response = await fetch(`/api/backups/${encodeURIComponent(filename)}/restore`, {
    method: 'POST',
    headers: authHeaders(username),
    body: JSON.stringify({ confirm: 'KHOIPHUC' }),
  });
  await parseResponse(response);
}

export async function deleteBackupFile(username: string, filename: string): Promise<void> {
  const response = await fetch(`/api/backups/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: authHeaders(username),
  });
  await parseResponse(response);
}

// --- End of backupApi.ts ---
