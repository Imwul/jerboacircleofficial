export type SyncScope = 'members' | 'archive';

export interface ServerSyncRecord<T> {
  scope: SyncScope;
  savedAt: string;
  data: T;
}

interface ServerSyncResponse<T> {
  ok: boolean;
  exists?: boolean;
  saved?: ServerSyncRecord<T> | null;
  savedAt?: string;
  error?: string;
}

function headers(syncKey?: string) {
  return {
    'content-type': 'application/json',
    ...(syncKey ? { 'x-jerboa-sync-key': syncKey } : {}),
  };
}

async function parseServerResponse<T>(response: Response) {
  const payload = (await response.json()) as ServerSyncResponse<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `sync_${response.status}`);
  }
  return payload;
}

export async function saveServerSync<T>(scope: SyncScope, data: T, syncKey?: string) {
  const response = await fetch(`/api/sync?scope=${scope}`, {
    method: 'POST',
    headers: headers(syncKey),
    body: JSON.stringify({ data }),
  });

  return parseServerResponse<T>(response);
}

export async function loadServerSync<T>(scope: SyncScope, syncKey?: string) {
  const response = await fetch(`/api/sync?scope=${scope}`, {
    headers: headers(syncKey),
  });

  return parseServerResponse<T>(response);
}
