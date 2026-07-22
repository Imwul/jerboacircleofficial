export type ArchiveAuditAction =
  | 'create'
  | 'duplicate'
  | 'edit'
  | 'delete'
  | 'restore'
  | 'import'
  | 'publish'
  | 'sync'
  | 'conflict-resolved'
  | 'backup-restored';

export interface ArchiveAuditEntry {
  id: string;
  action: ArchiveAuditAction;
  targetType: 'programme' | 'reference' | 'site-text' | 'archive';
  targetId?: string;
  title: string;
  detail?: string;
  createdAt: string;
}

const auditStorageKey = 'jerboa-archive-audit-log';
const maxAuditEntries = 500;

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function readArchiveAuditLog(): ArchiveAuditEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(auditStorageKey);
    return raw ? JSON.parse(raw) as ArchiveAuditEntry[] : [];
  } catch {
    return [];
  }
}

export function writeArchiveAuditLog(entries: ArchiveAuditEntry[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(auditStorageKey, JSON.stringify(entries.slice(0, maxAuditEntries)));
}

export function recordArchiveAudit(
  entry: Omit<ArchiveAuditEntry, 'id' | 'createdAt'>,
) {
  const createdAt = new Date().toISOString();
  const nextEntry: ArchiveAuditEntry = {
    ...entry,
    id: `${createdAt.replace(/\D/g, '').slice(0, 17)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
  };
  writeArchiveAuditLog([nextEntry, ...readArchiveAuditLog()]);
  return nextEntry;
}
