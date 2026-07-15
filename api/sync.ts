import { get, put } from '@vercel/blob';
import crypto from 'node:crypto';
import { roleCanSync, verifyRoleSession, type AccessRole } from '../server/authCore';

type SyncScope = 'members' | 'archive';

const allowedScopes = new Set<SyncScope>(['members', 'archive']);
const maxSyncBodyBytes = 4_500_000;

class SyncError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
  ) {
    super(errorCode);
  }
}

function sendJson(response: any, statusCode: number, body: unknown, cacheControl = 'no-store') {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', cacheControl);
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: any) {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > maxSyncBodyBytes) {
    throw new SyncError(413, 'payload_too_large');
  }

  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxSyncBodyBytes) {
      throw new SyncError(413, 'payload_too_large');
    }
    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody) return {};

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new SyncError(400, 'invalid_json');
  }
}

async function readBlobJson(pathname: string) {
  const blob = await get(pathname, { access: 'private' });
  if (!blob || blob.statusCode !== 200) return null;
  const text = await new Response(blob.stream).text();
  return JSON.parse(text);
}

function assertSyncKey(request: any) {
  const serverKey = process.env.JERBOA_SYNC_KEY;
  if (!serverKey) {
    return false;
  }

  const requestKey = String(request.headers['x-jerboa-sync-key'] || '');
  const serverBuffer = Buffer.from(serverKey);
  const requestBuffer = Buffer.from(requestKey);
  return serverBuffer.length === requestBuffer.length
    && crypto.timingSafeEqual(serverBuffer, requestBuffer);
}

function acceptedRolesForScope(scope: SyncScope): AccessRole[] {
  return scope === 'members' ? ['member-admin'] : ['archive-editor'];
}

function assertRoleSession(request: any, scope: SyncScope) {
  const session = String(request.headers['x-jerboa-session'] || '');
  const role = verifyRoleSession(session, acceptedRolesForScope(scope));
  return Boolean(role && roleCanSync(role, scope));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSyncData(scope: SyncScope, data: unknown) {
  if (!isPlainObject(data)) {
    throw new SyncError(400, 'invalid_payload');
  }

  if (scope === 'members') {
    if (!Array.isArray(data.users) || !Array.isArray(data.events) || !isPlainObject(data.themeNames)) {
      throw new SyncError(400, 'invalid_members_payload');
    }
    return;
  }

  const hasDrafts = data.drafts === undefined || isPlainObject(data.drafts);
  const hasSiteText = data.siteText === undefined || isPlainObject(data.siteText);
  if (!hasDrafts || !hasSiteText || (data.drafts === undefined && data.siteText === undefined)) {
    throw new SyncError(400, 'invalid_archive_payload');
  }
}

function savedAtFromBody(body: Record<string, unknown>) {
  return typeof body.baseSavedAt === 'string' ? body.baseSavedAt : null;
}

function hasArchiveReadAccess(request: any) {
  return assertSyncKey(request) || assertRoleSession(request, 'archive');
}

function publicArchiveSnapshot(saved: any) {
  if (!saved?.data || !isPlainObject(saved.data)) return saved;

  const drafts = isPlainObject(saved.data.drafts) ? saved.data.drafts : {};
  const publicDrafts = Object.fromEntries(
    Object.entries(drafts).filter(([, value]) => (
      isPlainObject(value)
      && value.visibility === 'public'
      && value.workflowStatus === 'published'
    )),
  );

  return {
    ...saved,
    data: {
      ...(saved.data.schemaVersion === 1 ? { schemaVersion: 1 } : {}),
      drafts: publicDrafts,
      ...(isPlainObject(saved.data.siteText) ? { siteText: saved.data.siteText } : {}),
    },
  };
}

export default async function handler(request: any, response: any) {
  const scope = request.query?.scope;
  if (!allowedScopes.has(scope)) {
    return sendJson(response, 400, {
      ok: false,
      error: 'invalid_scope',
    });
  }

  const needsSyncKey = scope === 'members' || (scope === 'archive' && request.method !== 'GET');

  if (needsSyncKey && !assertSyncKey(request) && !assertRoleSession(request, scope)) {
    return sendJson(response, 401, {
      ok: false,
      error: 'sync_auth_required',
    });
  }

  const pathname = `jerboa-sync/${scope}.json`;

  try {
    if (request.method === 'GET') {
      const saved = await readBlobJson(pathname);
      const isPublicArchiveRead = scope === 'archive' && !hasArchiveReadAccess(request);
      const readableSaved = isPublicArchiveRead
        ? publicArchiveSnapshot(saved)
        : saved;
      if (scope === 'archive') response.setHeader('vary', 'x-jerboa-sync-key, x-jerboa-session');
      return sendJson(response, 200, {
        ok: true,
        exists: Boolean(readableSaved),
        saved: readableSaved,
      }, isPublicArchiveRead ? 'public, s-maxage=60, stale-while-revalidate=300' : 'no-store');
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request);
      if (!isPlainObject(body)) {
        throw new SyncError(400, 'invalid_payload');
      }
      const data = body.data ?? body;
      validateSyncData(scope, data);
      const baseSavedAt = savedAtFromBody(body);
      const existing = await readBlobJson(pathname);

      if (existing?.savedAt && (!baseSavedAt || existing.savedAt !== baseSavedAt)) {
        return sendJson(response, 409, {
          ok: false,
          error: 'sync_conflict',
          savedAt: existing.savedAt,
        });
      }

      const saved = {
        scope,
        savedAt: new Date().toISOString(),
        data,
      };

      await put(pathname, JSON.stringify(saved), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json',
      });

      return sendJson(response, 200, {
        ok: true,
        savedAt: saved.savedAt,
      });
    }

    response.setHeader('allow', 'GET, POST');
    return sendJson(response, 405, {
      ok: false,
      error: 'method_not_allowed',
    });
  } catch (error) {
    if (error instanceof SyncError) {
      return sendJson(response, error.statusCode, {
        ok: false,
        error: error.errorCode,
      });
    }

    console.error('Sync failed:', error);
    return sendJson(response, 500, {
      ok: false,
      error: 'sync_failed',
    });
  }
}
