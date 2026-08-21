// Author: Gemini
// OS support: Web/Node
// Description: Internal Supabase Storage REST client for private asset migration

export interface SupabaseStorageClientOptions {
  baseUrl: string;
  serviceRoleKey: string;
}

export interface UploadObjectInput {
  bucketName: string;
  objectPath: string;
  body: Buffer;
  mimeType: string;
}

export interface DeleteObjectInput {
  bucketName: string;
  objectPath: string;
}

export interface DownloadObjectInput {
  bucketName: string;
  objectPath: string;
}

function buildObjectUrl(apiBaseUrl: string, bucketName: string, objectPath: string): string {
  const encodedPath = objectPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${apiBaseUrl}/object/${encodeURIComponent(bucketName)}/${encodedPath}`;
}

async function readError(response: Response): Promise<string> {
  const body = await response.text();
  return body ? ` (${body.slice(0, 500)})` : '';
}

async function isDuplicateResource(response: Response): Promise<boolean> {
  if (response.status === 409) return true;
  if (response.status !== 400) return false;
  const body = await response.clone().text();
  try {
    const parsed = JSON.parse(body) as { statusCode?: string; error?: string };
    return parsed.statusCode === '409' || parsed.error === 'Duplicate';
  } catch {
    return false;
  }
}

export function createSupabaseStorageClient(options: SupabaseStorageClientOptions) {
  const apiBaseUrl = options.baseUrl.replace(/\/$/, '');
  const authHeaders = {
    Authorization: `Bearer ${options.serviceRoleKey}`,
    apikey: options.serviceRoleKey,
  };

  return {
    async ensurePrivateBucket(bucketName: string, fileSizeLimit = 52428800): Promise<void> {
      const response = await fetch(`${apiBaseUrl}/bucket`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bucketName, name: bucketName, public: false, file_size_limit: fileSizeLimit }),
      });
      if (response.ok || await isDuplicateResource(response)) return;
      throw new Error(`Supabase Storage bucket creation failed with HTTP ${response.status}${await readError(response)}`);
    },

    async uploadObject(input: UploadObjectInput): Promise<void> {
      const response = await fetch(buildObjectUrl(apiBaseUrl, input.bucketName, input.objectPath), {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': input.mimeType,
          'Cache-Control': '3600',
          'x-upsert': 'true',
        },
        body: input.body,
      });
      if (response.ok) return;
      throw new Error(`Supabase Storage object upload failed with HTTP ${response.status}${await readError(response)}`);
    },

    async deleteObject(input: DeleteObjectInput): Promise<void> {
      const response = await fetch(buildObjectUrl(apiBaseUrl, input.bucketName, input.objectPath), {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (response.ok || response.status === 404) return;
      throw new Error(`Supabase Storage object deletion failed with HTTP ${response.status}${await readError(response)}`);
    },

    async downloadObject(input: DownloadObjectInput): Promise<{ body: Buffer; contentType: string }> {
      const response = await fetch(buildObjectUrl(apiBaseUrl, input.bucketName, input.objectPath), {
        method: 'GET',
        headers: authHeaders,
      });
      if (!response.ok) {
        throw new Error(`Supabase Storage object download failed with HTTP ${response.status}${await readError(response)}`);
      }
      return {
        body: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || 'application/octet-stream',
      };
    },
  };
}

// --- End of supabaseStorage.ts ---
