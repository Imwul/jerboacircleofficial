export type AccessRole = 'member-admin' | 'archive-editor';

interface RoleAuthResponse {
  ok: boolean;
  role?: AccessRole;
  session?: string;
  issuedAt?: string;
  expiresAt?: string;
  error?: string;
}

export interface RoleSession {
  role: AccessRole;
  session: string;
  issuedAt: string;
  expiresAt: string;
}

const roleSessionStorageKey = 'jerboa-role-sessions';

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readRoleSessions() {
  if (!canUseStorage()) return {} as Partial<Record<AccessRole, RoleSession>>;

  try {
    const raw = window.localStorage.getItem(roleSessionStorageKey);
    return raw ? (JSON.parse(raw) as Partial<Record<AccessRole, RoleSession>>) : {};
  } catch {
    return {};
  }
}

function writeRoleSession(session: RoleSession) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(roleSessionStorageKey, JSON.stringify({
    ...readRoleSessions(),
    [session.role]: session,
  }));
}

export function readRoleSession(role: AccessRole) {
  const session = readRoleSessions()[role];
  if (!session) return null;

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    clearRoleSession(role);
    return null;
  }

  return session;
}

export function clearRoleSession(role: AccessRole) {
  if (!canUseStorage()) return;
  const sessions = readRoleSessions();
  delete sessions[role];
  window.localStorage.setItem(roleSessionStorageKey, JSON.stringify(sessions));
}

export function roleSessionToken(role: AccessRole) {
  return readRoleSession(role)?.session;
}

export async function authenticateRole(role: AccessRole, key: string) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role, key }),
  });

  const payload = (await response.json()) as RoleAuthResponse;
  if (!response.ok || !payload.ok || payload.role !== role || !payload.session || !payload.issuedAt || !payload.expiresAt) {
    throw new Error(payload.error || `role_auth_${response.status}`);
  }

  const session: RoleSession = {
    role,
    session: payload.session,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
  writeRoleSession(session);
  return session;
}
