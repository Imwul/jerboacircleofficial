import { trackProductEvent } from './productAnalytics';

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

interface SaveServerSyncOptions {
  baseSavedAt?: string | null;
  authSession?: string | null;
}

export class ServerSyncError extends Error {
  constructor(
    message: string,
    public status: number,
    public savedAt?: string,
  ) {
    super(message);
  }
}

function headers(syncKey?: string, authSession?: string | null) {
  return {
    'content-type': 'application/json',
    ...(syncKey ? { 'x-jerboa-sync-key': syncKey } : {}),
    ...(authSession ? { 'x-jerboa-session': authSession } : {}),
  };
}

async function parseServerResponse<T>(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('sync_unavailable');
  }

  const payload = (await response.json()) as ServerSyncResponse<T>;
  if (!response.ok || !payload.ok) {
    throw new ServerSyncError(payload.error || `sync_${response.status}`, response.status, payload.savedAt);
  }
  return payload;
}

export async function saveServerSync<T>(
  scope: SyncScope,
  data: T,
  syncKey?: string,
  options: SaveServerSyncOptions = {},
) {
  try {
    const response = await fetch(`/api/sync?scope=${scope}`, {
      method: 'POST',
      headers: headers(syncKey, options.authSession),
      body: JSON.stringify({
        data,
        ...(options.baseSavedAt ? { baseSavedAt: options.baseSavedAt } : {}),
      }),
    });

    return await parseServerResponse<T>(response);
  } catch (error) {
    trackProductEvent(error instanceof ServerSyncError && error.message === 'sync_conflict' ? 'sync_conflict' : 'sync_failure', {
      scope,
      method: 'POST',
      status: error instanceof ServerSyncError ? error.status : null,
      code: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}

export async function loadServerSync<T>(
  scope: SyncScope,
  syncKey?: string,
  options: { authSession?: string | null } = {},
) {
  try {
    const response = await fetch(`/api/sync?scope=${scope}`, {
      headers: headers(syncKey, options.authSession),
    });

    return await parseServerResponse<T>(response);
  } catch (error) {
    trackProductEvent(error instanceof ServerSyncError && error.message === 'sync_conflict' ? 'sync_conflict' : 'sync_failure', {
      scope,
      method: 'GET',
      status: error instanceof ServerSyncError ? error.status : null,
      code: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}
