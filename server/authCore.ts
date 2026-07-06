import crypto from 'node:crypto';

export type AccessRole = 'member-admin' | 'archive-editor';
export type SyncScope = 'members' | 'archive';

const sessionDurationMs = 12 * 60 * 60 * 1000;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionSecret() {
  return process.env.JERBOA_AUTH_SECRET
    || process.env.JERBOA_ADMIN_KEY
    || process.env.JERBOA_MEMBER_ADMIN_KEY
    || process.env.JERBOA_ARCHIVE_EDITOR_KEY
    || process.env.JERBOA_SYNC_KEY
    || '';
}

function keysForRole(role: AccessRole) {
  const ownerKey = process.env.JERBOA_ADMIN_KEY;
  const roleKey = role === 'member-admin'
    ? process.env.JERBOA_MEMBER_ADMIN_KEY
    : process.env.JERBOA_ARCHIVE_EDITOR_KEY;

  return [roleKey, ownerKey].filter((key): key is string => Boolean(key));
}

function sign(payload: string) {
  return base64Url(crypto.createHmac('sha256', sessionSecret()).update(payload).digest());
}

export function isAccessRole(value: unknown): value is AccessRole {
  return value === 'member-admin' || value === 'archive-editor';
}

export function isRoleAuthConfigured(role: AccessRole) {
  return Boolean(sessionSecret()) && keysForRole(role).length > 0;
}

export function verifyRoleKey(role: AccessRole, key: string) {
  const allowedKeys = keysForRole(role);
  if (!sessionSecret() || allowedKeys.length === 0) return false;
  return allowedKeys.some((allowedKey) => timingSafeStringEqual(allowedKey, key));
}

export function createRoleSession(role: AccessRole) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + sessionDurationMs;
  const payload = base64Url(JSON.stringify({ role, issuedAt, expiresAt }));
  return {
    role,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    session: `${payload}.${sign(payload)}`,
  };
}

export function verifyRoleSession(session: string | undefined, acceptedRoles: AccessRole[]) {
  if (!session || !sessionSecret()) return null;

  const [payload, signature] = session.split('.');
  if (!payload || !signature || !timingSafeStringEqual(signature, sign(payload))) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as {
      role?: unknown;
      expiresAt?: unknown;
    };
    if (!isAccessRole(parsed.role)) return null;
    if (!acceptedRoles.includes(parsed.role)) return null;
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt < Date.now()) return null;
    return parsed.role;
  } catch {
    return null;
  }
}

export function roleCanSync(role: AccessRole, scope: SyncScope) {
  if (role === 'member-admin') return scope === 'members';
  if (role === 'archive-editor') return scope === 'archive';
  return false;
}
