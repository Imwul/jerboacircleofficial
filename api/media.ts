import { del, get, put } from '@vercel/blob';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { verifyRoleSession } from '../server/authCore.js';
import { validateImageBuffer } from '../shared/imageValidation.mjs';

const maxBodyBytes = 4_200_000;
const allowedTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const responsiveMediaWidths = new Set([320, 480, 640, 800, 1080]);

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

function mediaRole(request: any) {
  return verifyRoleSession(String(request.headers['x-jerboa-session'] || ''), ['member-admin', 'archive-editor']);
}

function canManageMedia(request: any, scope: 'archive' | 'cabinet') {
  if (hasSyncKey(request)) return true;
  const role = mediaRole(request);
  return scope === 'archive' ? role === 'archive-editor' : role === 'member-admin';
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

function safeName(value: unknown) {
  const name = typeof value === 'string' ? value : 'curiosity';
  return name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'curiosity';
}

function safeMediaPathname(value: unknown) {
  if (typeof value !== 'string' || value.length > 320 || value.includes('..') || value.includes('\\')) return null;
  return /^(?:archive|cabinet)\/[a-zA-Z0-9/_-]+\.(?:jpg|png|webp)$/.test(value) ? value : null;
}

async function deliverPrivateMedia(request: any, response: any) {
  const requestUrl = new URL(request.url || '/api/media', `https://${request.headers.host || 'jerboacircleofficial.vercel.app'}`);
  const pathname = safeMediaPathname(requestUrl.searchParams.get('pathname'));
  if (!pathname) return sendJson(response, 400, { ok: false, error: 'invalid_media_path' });

  const requestedWidth = Number(requestUrl.searchParams.get('width'));
  const shouldTransform = requestUrl.searchParams.get('format') === 'webp'
    && responsiveMediaWidths.has(requestedWidth);

  const result = await get(pathname, {
    access: 'private',
    ifNoneMatch: !shouldTransform && typeof request.headers['if-none-match'] === 'string'
      ? request.headers['if-none-match']
      : undefined,
  });
  if (!result) return sendJson(response, 404, { ok: false, error: 'media_not_found' });

  if (shouldTransform && result.statusCode === 200 && result.stream) {
    const variantEtag = `"${crypto.createHash('sha256')
      .update(`${result.blob.etag}:${requestedWidth}:webp-v1`)
      .digest('hex')}"`;
    if (request.headers['if-none-match'] === variantEtag) {
      response.statusCode = 304;
      response.setHeader('cache-control', 'public, max-age=31536000, immutable');
      response.setHeader('etag', variantEtag);
      return response.end();
    }

    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    response.setHeader('content-type', 'image/webp');
    response.setHeader('etag', variantEtag);
    response.setHeader('x-content-type-options', 'nosniff');
    if (request.method === 'HEAD') return response.end();

    const source = Buffer.from(await new Response(result.stream).arrayBuffer());
    const image = await sharp(source, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: requestedWidth })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
    response.setHeader('content-length', String(image.byteLength));
    return response.end(image);
  }

  response.statusCode = result.statusCode;
  response.setHeader('cache-control', 'public, max-age=31536000, immutable');
  response.setHeader('etag', result.blob.etag);
  if (result.statusCode === 304 || !result.stream) return response.end();

  response.setHeader('content-type', result.blob.contentType || 'application/octet-stream');
  response.setHeader('content-length', String(result.blob.size));
  response.setHeader('x-content-type-options', 'nosniff');
  if (request.method === 'HEAD') return response.end();
  const reader = result.stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    response.write(Buffer.from(value));
  }
  return response.end();
}

async function readPrivateJson(pathname: string) {
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text());
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('not found') || message.includes('blob_not_found')) return null;
    throw error;
  }
}

function mediaPathFromUrl(value: unknown) {
  if (typeof value !== 'string' || !value.includes('/api/media')) return null;
  try {
    return safeMediaPathname(new URL(value, 'https://jerboacircleofficial.vercel.app').searchParams.get('pathname'));
  } catch {
    return null;
  }
}

function archiveReferencesPath(data: any, pathname: string) {
  const drafts = data?.drafts && typeof data.drafts === 'object' ? Object.values(data.drafts) as any[] : [];
  const references = data?.references && typeof data.references === 'object' ? Object.values(data.references) as any[] : [];
  return drafts.some((draft) => [draft?.posterImage, draft?.detailImage].some((value) => mediaPathFromUrl(value) === pathname))
    || references.some((reference) => mediaPathFromUrl(reference?.imageUrl) === pathname);
}

function membersReferencePath(data: any, pathname: string) {
  const curiosities = Array.isArray(data?.curiosities) ? data.curiosities : [];
  return mediaPathFromUrl(data?.mainImage) === pathname
    || curiosities.some((item: any) => mediaPathFromUrl(item?.image) === pathname);
}

async function deleteAbandonedMedia(request: any, response: any) {
  const body = await readJsonBody(request);
  const pathname = safeMediaPathname(body?.pathname);
  if (!pathname) return sendJson(response, 400, { ok: false, error: 'invalid_media_path' });
  const scope = pathname.startsWith('archive/') ? 'archive' : 'cabinet';
  if (!canManageMedia(request, scope)) return sendJson(response, 401, { ok: false, error: 'media_auth_required' });

  const saved = await readPrivateJson(`jerboa-sync/${scope === 'archive' ? 'archive' : 'members'}.json`);
  const inUse = scope === 'archive'
    ? archiveReferencesPath(saved?.data, pathname)
    : membersReferencePath(saved?.data, pathname);
  if (inUse) return sendJson(response, 409, { ok: false, error: 'media_in_use' });

  await del(pathname).catch((error) => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (!message.includes('not found') && !message.includes('blob_not_found')) throw error;
  });
  return sendJson(response, 200, { ok: true, deleted: true, pathname });
}

export default async function handler(request: any, response: any) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    try {
      return await deliverPrivateMedia(request, response);
    } catch (error) {
      console.error('Media delivery failed:', error);
      return sendJson(response, 500, { ok: false, error: 'media_delivery_failed' });
    }
  }
  if (request.method === 'DELETE') {
    try {
      return await deleteAbandonedMedia(request, response);
    } catch (error) {
      console.error('Media cleanup failed:', error);
      return sendJson(response, 500, { ok: false, error: 'media_cleanup_failed' });
    }
  }
  if (request.method !== 'POST') {
    response.setHeader('allow', 'GET, HEAD, POST, DELETE');
    return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = await readJsonBody(request);
    const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : '';
    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || !allowedTypes.has(match[1])) {
      return sendJson(response, 400, { ok: false, error: 'invalid_image' });
    }
    const image = Buffer.from(match[2], 'base64');
    if (image.byteLength === 0 || image.byteLength > 3_100_000) {
      return sendJson(response, 413, { ok: false, error: 'image_too_large' });
    }

    const contentType = match[1];
    const imageValidation = validateImageBuffer(image, contentType);
    if (!imageValidation.ok) {
      return sendJson(response, 400, { ok: false, error: imageValidation.error });
    }
    const extension = allowedTypes.get(contentType) || 'jpg';
    const folder = body?.scope === 'archive' ? 'archive' : 'cabinet';
    if (!canManageMedia(request, folder)) {
      return sendJson(response, 401, { ok: false, error: 'media_auth_required' });
    }
    const digest = crypto.createHash('sha256').update(image).digest('hex').slice(0, 24);
    const pathname = `${folder}/${new Date().toISOString().slice(0, 10)}/${digest}-${safeName(body?.fileName)}.${extension}`;
    try {
      await put(pathname, image, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType,
        cacheControlMaxAge: 31_536_000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code).toLowerCase() : '';
      if (!message.includes('already') && !message.includes('exist') && !code.includes('already') && !code.includes('exist')) throw error;
    }

    return sendJson(response, 200, {
      ok: true,
      url: `/api/media?pathname=${encodeURIComponent(pathname)}`,
      pathname,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'media_upload_failed';
    if (code === 'payload_too_large') return sendJson(response, 413, { ok: false, error: code });
    if (code === 'Unexpected end of JSON input' || error instanceof SyntaxError) return sendJson(response, 400, { ok: false, error: 'invalid_json' });
    console.error('Media upload failed:', error);
    if (code.includes('Cannot use public access on a private store')) {
      return sendJson(response, 503, { ok: false, error: 'media_store_access_mismatch' });
    }
    return sendJson(response, 500, { ok: false, error: 'media_upload_failed' });
  }
}
