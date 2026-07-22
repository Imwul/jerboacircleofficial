import type { ArchiveAuditEntry } from './archiveAudit';

export interface ArchiveBackupSummary {
  pathname: string;
  savedAt: string;
  uploadedAt?: string;
  size?: number;
}

export interface ArchiveOperationalStatus {
  ok: boolean;
  checkedAt: string;
  archive: {
    savedAt: string | null;
    size: number;
    recordCount: number;
    deletedRecordCount: number;
    referenceCount: number;
    publicationCount: number;
    auditCount: number;
    embeddedPosterCount: number;
  };
  backups: ArchiveBackupSummary[];
  recentFailures: Array<{
    receivedAt?: string;
    name: string;
    path?: string;
    code?: string;
  }>;
  recentAudit: ArchiveAuditEntry[];
}

interface LinkCheckResult {
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
}

function authHeaders(authSession: string) {
  return {
    'content-type': 'application/json',
    'x-jerboa-session': authSession,
  };
}

async function parseResponse<T>(response: Response) {
  const payload = await response.json() as T & { ok?: boolean; error?: string };
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `ops_${response.status}`);
  return payload;
}

export async function loadArchiveOperationalStatus(authSession: string) {
  const response = await fetch('/api/ops', { headers: authHeaders(authSession) });
  return parseResponse<ArchiveOperationalStatus>(response);
}

export async function checkArchiveLinks(authSession: string, urls: string[]) {
  const results: LinkCheckResult[] = [];
  for (let index = 0; index < Math.min(urls.length, 100); index += 20) {
    const response = await fetch('/api/ops', {
      method: 'POST',
      headers: authHeaders(authSession),
      body: JSON.stringify({ action: 'check-links', urls: urls.slice(index, index + 20) }),
    });
    const payload = await parseResponse<{ ok: boolean; results: LinkCheckResult[] }>(response);
    results.push(...payload.results);
  }
  return results;
}

export async function restoreArchiveBackup(authSession: string, pathname: string) {
  const response = await fetch('/api/ops', {
    method: 'POST',
    headers: authHeaders(authSession),
    body: JSON.stringify({ action: 'restore-backup', pathname }),
  });
  return parseResponse<{ ok: boolean; savedAt: string }>(response);
}
