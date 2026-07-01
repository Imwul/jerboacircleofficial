import { get, put } from '@vercel/blob';

type SyncScope = 'members' | 'archive';

const allowedScopes = new Set<SyncScope>(['members', 'archive']);

function sendJson(response: any, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: any) {
  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
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

  const requestKey = request.headers['x-jerboa-sync-key'];
  return requestKey === serverKey;
}

export default async function handler(request: any, response: any) {
  const scope = request.query?.scope;
  if (!allowedScopes.has(scope)) {
    return sendJson(response, 400, {
      ok: false,
      error: 'invalid_scope',
    });
  }

  if (scope === 'archive' && !assertSyncKey(request)) {
    return sendJson(response, 401, {
      ok: false,
      error: 'sync_key_required',
    });
  }

  const pathname = `jerboa-sync/${scope}.json`;

  try {
    if (request.method === 'GET') {
      const saved = await readBlobJson(pathname);
      return sendJson(response, 200, {
        ok: true,
        exists: Boolean(saved),
        saved,
      });
    }

    if (request.method === 'POST') {
      const body = await readJsonBody(request);
      const saved = {
        scope,
        savedAt: new Date().toISOString(),
        data: body.data ?? body,
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
    return sendJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : 'sync_failed',
    });
  }
}
