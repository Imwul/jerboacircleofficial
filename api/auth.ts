import {
  createRoleSession,
  isAccessRole,
  isRoleAuthConfigured,
  verifyRoleKey,
} from '../server/authCore.js';

const maxAuthBodyBytes = 10_000;

function sendJson(response: any, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: any) {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > maxAuthBodyBytes) {
    throw new Error('payload_too_large');
  }

  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxAuthBodyBytes) {
      throw new Error('payload_too_large');
    }
    chunks.push(buffer);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    return sendJson(response, 405, {
      ok: false,
      error: 'method_not_allowed',
    });
  }

  try {
    const body = await readJsonBody(request);
    const role = body?.role;
    const key = String(body?.key || '');

    if (!isAccessRole(role)) {
      return sendJson(response, 400, {
        ok: false,
        error: 'invalid_role',
      });
    }

    if (!isRoleAuthConfigured(role)) {
      return sendJson(response, 503, {
        ok: false,
        error: 'role_auth_not_configured',
      });
    }

    if (!key || !verifyRoleKey(role, key)) {
      return sendJson(response, 401, {
        ok: false,
        error: 'role_key_required',
      });
    }

    return sendJson(response, 200, {
      ok: true,
      ...createRoleSession(role),
    });
  } catch (error) {
    return sendJson(response, 400, {
      ok: false,
      error: error instanceof Error ? error.message : 'invalid_auth_request',
    });
  }
}
