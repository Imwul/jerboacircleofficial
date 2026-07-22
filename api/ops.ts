import { get, list, put } from '@vercel/blob';
import crypto from 'node:crypto';
import { verifyRoleSession } from '../server/authCore.js';

const archivePathname = 'jerboa-sync/archive.json';
const analyticsPathname = 'jerboa-analytics/events.json';
const backupPrefix = 'jerboa-backups/archive/';
const maxBodyBytes = 40_000;

function sendJson(response: any, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

function hasSyncKey(request: any) {
  const serverKey = process.env.JERBOA_SYNC_KEY;
  if (!serverKey) return false;
  const requestKey = String(request.headers['x-jerboa-sync-key'] || '');
  const serverBuffer = Buffer.from(serverKey);
  const requestBuffer = Buffer.from(requestKey);
  return serverBuffer.length === requestBuffer.length && crypto.timingSafeEqual(serverBuffer, requestBuffer);
}

function isAuthorized(request: any) {
  const session = String(request.headers['x-jerboa-session'] || '');
  return hasSyncKey(request) || Boolean(verifyRoleSession(session, ['archive-editor']));
}

async function readJsonBody(request: any) {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > maxBodyBytes) throw new Error('payload_too_large');
  if (request.body && typeof request.body === 'object') return request.body;
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBodyBytes) throw new Error('payload_too_large');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function readPrivateJson(pathname: string) {
  try {
    const blob = await get(pathname, { access: 'private' });
    if (!blob || blob.statusCode !== 200) return null;
    return JSON.parse(await new Response(blob.stream).text());
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('not found') || message.includes('blob_not_found')) return null;
    throw error;
  }
}

function publicationCount(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  return Object.values(value as Record<string, unknown>).reduce((total, group) => (
    total + (Array.isArray(group) ? group.length : 0)
  ), 0);
}

function safeLink(value: unknown) {
  if (typeof value !== 'string' || value.length > 2_000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const hostname = url.hostname.toLowerCase();
    if (
      hostname === 'localhost'
      || hostname.endsWith('.local')
      || hostname === '127.0.0.1'
      || hostname === '0.0.0.0'
      || hostname === '::1'
      || /^10\./.test(hostname)
      || /^192\.168\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function checkLink(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { range: 'bytes=0-0' },
      });
    }
    return { url, ok: response.ok, status: response.status };
  } catch (error) {
    return { url, ok: false, error: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadStatus() {
  const [archive, analytics, archiveList, backupList] = await Promise.all([
    readPrivateJson(archivePathname),
    readPrivateJson(analyticsPathname),
    list({ prefix: archivePathname, limit: 10 }),
    list({ prefix: backupPrefix, limit: 30 }),
  ]);
  const data = archive?.data ?? {};
  const analyticsEvents = Array.isArray(analytics?.events) ? analytics.events : [];
  const failures = analyticsEvents
    .filter((event: any) => event?.name === 'sync_failure' || event?.name === 'sync_conflict')
    .slice(-12)
    .reverse()
    .map((event: any) => ({
      receivedAt: event.receivedAt,
      name: event.name,
      path: event.path,
      code: event.properties?.code,
    }));
  const auditLog = Array.isArray(data.auditLog) ? data.auditLog : [];
  const drafts = data.drafts && typeof data.drafts === 'object' ? Object.values(data.drafts) as any[] : [];
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    archive: {
      savedAt: archive?.savedAt ?? null,
      size: archiveList.blobs.find((blob) => blob.pathname === archivePathname)?.size ?? 0,
      recordCount: drafts.filter((draft) => !draft?.deletedAt).length,
      deletedRecordCount: drafts.filter((draft) => Boolean(draft?.deletedAt)).length,
      referenceCount: data.references && typeof data.references === 'object' ? Object.keys(data.references).length : 0,
      publicationCount: publicationCount(data.publications),
      auditCount: auditLog.length,
      embeddedPosterCount: drafts.filter((draft) => typeof draft?.posterImage === 'string' && draft.posterImage.startsWith('data:')).length,
    },
    backups: backupList.blobs
      .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())
      .map((blob) => ({ pathname: blob.pathname, savedAt: blob.pathname.split('/').at(-1)?.replace('.json', '') ?? '', uploadedAt: blob.uploadedAt.toISOString(), size: blob.size })),
    recentFailures: failures,
    recentAudit: auditLog.slice(0, 12),
  };
}

export default async function handler(request: any, response: any) {
  if (!isAuthorized(request)) return sendJson(response, 401, { ok: false, error: 'ops_auth_required' });

  try {
    if (request.method === 'GET') return sendJson(response, 200, await loadStatus());

    if (request.method !== 'POST') {
      response.setHeader('allow', 'GET, POST');
      return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
    }

    const body = await readJsonBody(request);
    if (body?.action === 'check-links') {
      const urls = Array.isArray(body.urls) ? body.urls.slice(0, 20).map(safeLink).filter(Boolean) as string[] : [];
      if (urls.length === 0) return sendJson(response, 400, { ok: false, error: 'valid_https_url_required' });
      return sendJson(response, 200, { ok: true, results: await Promise.all(urls.map(checkLink)) });
    }

    if (body?.action === 'restore-backup') {
      const pathname = typeof body.pathname === 'string' ? body.pathname : '';
      if (!pathname.startsWith(backupPrefix) || pathname.includes('..')) {
        return sendJson(response, 400, { ok: false, error: 'invalid_backup_path' });
      }
      const [backup, current] = await Promise.all([readPrivateJson(pathname), readPrivateJson(archivePathname)]);
      if (!backup?.data) return sendJson(response, 404, { ok: false, error: 'backup_not_found' });
      const now = new Date().toISOString();
      if (current?.data) {
        await put(`${backupPrefix}before-restore-${now.replace(/\D/g, '').slice(0, 14)}.json`, JSON.stringify(current), {
          access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json',
        });
      }
      await put(archivePathname, JSON.stringify({ ...backup, savedAt: now }), {
        access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
      });
      return sendJson(response, 200, { ok: true, savedAt: now });
    }

    return sendJson(response, 400, { ok: false, error: 'invalid_ops_action' });
  } catch (error) {
    console.error('Keeper operations failed:', error);
    return sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : 'ops_failed' });
  }
}
