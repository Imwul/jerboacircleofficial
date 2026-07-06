import type { SyncScope } from './serverSync';

interface SyncRecovery<T> {
  type: 'jerboa-sync-recovery';
  version: 1;
  scope: SyncScope;
  reason: string;
  capturedAt: string;
  baseSavedAt?: string | null;
  remoteSavedAt?: string | null;
  data: T;
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function recoveryStorageKey(scope: SyncScope) {
  return `jerboa-sync-recovery-${scope}`;
}

function recoveryFileName(scope: SyncScope, capturedAt: string) {
  return `jerboa-${scope}-recovery-${capturedAt.slice(0, 16).replace(/[-:T]/g, '')}.json`;
}

export function writeSyncRecovery<T>(
  scope: SyncScope,
  data: T,
  meta: { reason: string; baseSavedAt?: string | null; remoteSavedAt?: string | null },
) {
  if (!canUseStorage()) return null;

  const recovery: SyncRecovery<T> = {
    type: 'jerboa-sync-recovery',
    version: 1,
    scope,
    reason: meta.reason,
    capturedAt: new Date().toISOString(),
    baseSavedAt: meta.baseSavedAt,
    remoteSavedAt: meta.remoteSavedAt,
    data,
  };

  window.localStorage.setItem(recoveryStorageKey(scope), JSON.stringify(recovery));
  return recovery;
}

export function readSyncRecovery<T>(scope: SyncScope): SyncRecovery<T> | null {
  if (!canUseStorage()) return null;

  try {
    const rawRecovery = window.localStorage.getItem(recoveryStorageKey(scope));
    return rawRecovery ? (JSON.parse(rawRecovery) as SyncRecovery<T>) : null;
  } catch {
    return null;
  }
}

export function clearSyncRecovery(scope: SyncScope) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(recoveryStorageKey(scope));
}

export function downloadSyncRecovery<T>(recovery: SyncRecovery<T>) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(recovery, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = recoveryFileName(recovery.scope, recovery.capturedAt);
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadLatestSyncRecovery(scope: SyncScope) {
  const recovery = readSyncRecovery(scope);
  if (!recovery) return false;
  downloadSyncRecovery(recovery);
  return true;
}
