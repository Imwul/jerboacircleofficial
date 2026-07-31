import { del, get, list, put } from '@vercel/blob';
import crypto from 'node:crypto';
import { roleCanSync, verifyRoleSession, type AccessRole } from '../server/authCore.js';
import { createPublicDraftMap } from '../shared/publicationState.mjs';

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
  try {
    const blob = await get(pathname, { access: 'private' });
    if (!blob || blob.statusCode !== 200) return null;
    const text = await new Response(blob.stream).text();
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code).toLowerCase()
      : '';
    const unavailable = [message, code].some((value) => (
      value.includes('not found')
      || value.includes('no token')
      || value.includes('store_not_found')
      || value.includes('blob_not_found')
    ));
    if (unavailable) return null;
    throw error;
  }
}

async function readCurrentSync(scope: SyncScope) {
  const prefix = `jerboa-sync-versions/${scope}/`;
  const blobs: Array<{ pathname: string }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, limit: 1_000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && blobs.length < 10_000);
  const latest = blobs.sort((left, right) => right.pathname.localeCompare(left.pathname))[0];
  return latest ? readBlobJson(latest.pathname) : readBlobJson(`jerboa-sync/${scope}.json`);
}

async function acquireWriteLock(scope: SyncScope, baseSavedAt: string | null) {
  const base = baseSavedAt || 'initial';
  const digest = crypto.createHash('sha256').update(base).digest('hex');
  const pathname = `jerboa-sync-locks/${scope}/${digest}.json`;
  try {
    await put(pathname, JSON.stringify({ baseSavedAt }), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: 'application/json',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code).toLowerCase() : '';
    if (message.includes('already') || message.includes('exist') || code.includes('already') || code.includes('exist')) {
      throw new SyncError(409, 'sync_conflict');
    }
    throw error;
  }
  return pathname;
}

async function preserveDailyBackup(scope: SyncScope, existing: any) {
  if (!existing?.savedAt || !existing?.data) return;
  const day = String(existing.savedAt).slice(0, 10);
  const pathname = `jerboa-backups/${scope}/${day}.json`;
  const alreadyPreserved = await readBlobJson(pathname);
  if (alreadyPreserved) return;
  await put(pathname, JSON.stringify(existing), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: false,
    contentType: 'application/json',
  });
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

function validateCabinetRecords(value: unknown) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 5_000) throw new SyncError(400, 'invalid_cabinet_payload');
  const records = new Map<string, Record<string, unknown>>();
  value.forEach((item) => {
    if (!isPlainObject(item)
      || typeof item.id !== 'string' || !item.id || item.id.length > 160
      || typeof item.ownerId !== 'string' || !item.ownerId
      || typeof item.title !== 'string' || !item.title.trim()
      || typeof item.image !== 'string' || !item.image.trim()
      || typeof item.imageAlt !== 'string' || !item.imageAlt.trim()
      || (item.visibility !== 'public' && item.visibility !== 'private')
      || !isPlainObject(item.source) || typeof item.source.institution !== 'string' || !item.source.institution.trim()
      || !isPlainObject(item.encountered) || typeof item.encountered.dateLabel !== 'string' || !item.encountered.dateLabel.trim()
      || !Array.isArray(item.relatedEntryIds ?? [])) {
      throw new SyncError(400, 'invalid_cabinet_payload');
    }
    if (records.has(item.id)) throw new SyncError(400, 'duplicate_cabinet_record');
    records.set(item.id, item);
  });
  records.forEach((item) => {
    const relationIds = item.relatedEntryIds as unknown[] | undefined ?? [];
    if (relationIds.length > 50 || new Set(relationIds).size !== relationIds.length) {
      throw new SyncError(400, 'invalid_cabinet_relations');
    }
    relationIds.forEach((relationId) => {
      if (typeof relationId !== 'string' || relationId === item.id) throw new SyncError(400, 'invalid_cabinet_relations');
      const target = records.get(relationId);
      if (!target || (target.ownerId !== item.ownerId && target.visibility !== 'public')) {
        throw new SyncError(400, 'invalid_cabinet_relations');
      }
    });
  });
}

function validateArchiveDrafts(value: unknown) {
  if (value === undefined) return;
  if (!isPlainObject(value) || Object.keys(value).length > 5_000) throw new SyncError(400, 'invalid_archive_drafts');
  Object.entries(value).forEach(([id, draft]) => {
    if (!id || id.length > 160 || !isPlainObject(draft)) throw new SyncError(400, 'invalid_archive_drafts');
    if (draft.deletedAt !== undefined && typeof draft.deletedAt !== 'string') throw new SyncError(400, 'invalid_archive_drafts');
    if (draft.visibility === 'public' && draft.workflowStatus === 'published' && typeof draft.deletedAt !== 'string') {
      const required = ['title', 'subtitle', 'date', 'posterImage', 'posterAlt', 'shortDescription', 'longDescription'];
      if (required.some((field) => typeof draft[field] !== 'string' || !(draft[field] as string).trim())) {
        throw new SyncError(400, 'incomplete_public_record');
      }
      if (typeof draft.detailImage === 'string' && draft.detailImage.trim()
        && (typeof draft.detailImageAlt !== 'string' || !draft.detailImageAlt.trim())) {
        throw new SyncError(400, 'incomplete_public_record');
      }
    }
  });
}

function validateSyncData(scope: SyncScope, data: unknown): asserts data is Record<string, unknown> {
  if (!isPlainObject(data)) {
    throw new SyncError(400, 'invalid_payload');
  }

  if (scope === 'members') {
    if (!Array.isArray(data.users) || !Array.isArray(data.events) || !isPlainObject(data.themeNames)) {
      throw new SyncError(400, 'invalid_members_payload');
    }
    validateCabinetRecords(data.curiosities);
    return;
  }

  const hasDrafts = data.drafts === undefined || isPlainObject(data.drafts);
  const hasSiteText = data.siteText === undefined || isPlainObject(data.siteText);
  const hasReferences = data.references === undefined || isPlainObject(data.references);
  const hasPublications = data.publications === undefined || isPlainObject(data.publications);
  const hasAuditLog = data.auditLog === undefined || Array.isArray(data.auditLog);
  if (
    !hasDrafts
    || !hasSiteText
    || !hasReferences
    || !hasPublications
    || !hasAuditLog
    || (data.drafts === undefined && data.siteText === undefined && data.references === undefined)
  ) {
    throw new SyncError(400, 'invalid_archive_payload');
  }
  validateArchiveDrafts(data.drafts);

  if (isPlainObject(data.publications)) {
    const publicationGroups = Object.entries(data.publications);
    if (publicationGroups.length > 1_000) throw new SyncError(400, 'invalid_publication_history');
    publicationGroups.forEach(([recordId, manifests]) => {
      if (!recordId || recordId.length > 120 || !Array.isArray(manifests) || manifests.length > 200) {
        throw new SyncError(400, 'invalid_publication_history');
      }
      const manifestIds = new Set<string>();
      const contentHashes = new Set<string>();
      manifests.forEach((manifest) => {
        if (
          !isPlainObject(manifest)
          || manifest.recordId !== recordId
          || typeof manifest.id !== 'string'
          || typeof manifest.contentHash !== 'string'
          || typeof manifest.createdAt !== 'string'
          || !isPlainObject(manifest.event)
          || !isPlainObject(manifest.poster)
          || !Array.isArray(manifest.references)
        ) {
          throw new SyncError(400, 'invalid_publication_history');
        }
        if (manifestIds.has(manifest.id) || contentHashes.has(manifest.contentHash)) {
          throw new SyncError(400, 'duplicate_publication_history');
        }
        manifestIds.add(manifest.id);
        contentHashes.add(manifest.contentHash);
      });
    });
  }
}

function assertPublicationHistoryPreserved(existing: any, nextData: Record<string, unknown>) {
  const previous = isPlainObject(existing?.data?.publications) ? existing.data.publications : {};
  if (Object.keys(previous).length === 0) return;
  const next = isPlainObject(nextData.publications) ? nextData.publications : {};
  Object.entries(previous).forEach(([recordId, manifests]) => {
    if (!Array.isArray(manifests)) return;
    const nextManifests = Array.isArray(next[recordId]) ? next[recordId] as unknown[] : [];
    manifests.forEach((manifest) => {
      if (!isPlainObject(manifest)) return;
      const preserved = nextManifests.some((candidate) => (
        isPlainObject(candidate)
        && candidate.id === manifest.id
        && candidate.contentHash === manifest.contentHash
      ));
      if (!preserved) throw new SyncError(409, 'publication_history_conflict');
    });
  });
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
  const publicDrafts = createPublicDraftMap(drafts);

  return {
    ...saved,
    data: {
      ...(saved.data.schemaVersion === 1 || saved.data.schemaVersion === 2 || saved.data.schemaVersion === 3
        ? { schemaVersion: saved.data.schemaVersion }
        : {}),
      drafts: publicDrafts,
      ...(isPlainObject(saved.data.siteText) ? { siteText: saved.data.siteText } : {}),
      ...(isPlainObject(saved.data.references) ? { references: saved.data.references } : {}),
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
      const saved = await readCurrentSync(scope);
      const isPublicArchiveRead = scope === 'archive' && !hasArchiveReadAccess(request);
      const readableSaved = isPublicArchiveRead
        ? publicArchiveSnapshot(saved)
        : saved;
      if (scope === 'archive') response.setHeader('vary', 'x-jerboa-sync-key, x-jerboa-session');
      return sendJson(response, 200, {
        ok: true,
        exists: Boolean(readableSaved),
        saved: readableSaved,
      }, 'no-store');
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request);
      if (!isPlainObject(body)) {
        throw new SyncError(400, 'invalid_payload');
      }
      const data = body.data ?? body;
      validateSyncData(scope, data);
      const baseSavedAt = savedAtFromBody(body);
      const existing = await readCurrentSync(scope);

      if (existing?.savedAt && (!baseSavedAt || existing.savedAt !== baseSavedAt)) {
        return sendJson(response, 409, {
          ok: false,
          error: 'sync_conflict',
          savedAt: existing.savedAt,
        });
      }

      if (scope === 'archive') assertPublicationHistoryPreserved(existing, data);

      const lockPath = await acquireWriteLock(scope, baseSavedAt);

      const saved = {
        scope,
        savedAt: new Date().toISOString(),
        data,
      };

      const versionPath = `jerboa-sync-versions/${scope}/${Date.now().toString().padStart(13, '0')}-${crypto.randomUUID()}.json`;
      let versionCommitted = false;
      try {
        await preserveDailyBackup(scope, existing);
        await put(versionPath, JSON.stringify(saved), {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: 'application/json',
        });
        versionCommitted = true;

        await put(pathname, JSON.stringify(saved), {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
        });
      } catch (error) {
        // A lock must remain once an immutable version exists so another tab
        // that already read the old base cannot race in after the first write.
        // Before that point it is safe to release the orphaned lock for retry.
        if (!versionCommitted) await del(lockPath).catch(() => undefined);
        throw error;
      }

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
