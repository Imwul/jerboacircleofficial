import crypto from 'node:crypto';
import { verifyRoleSession } from '../server/authCore.js';

const maxHtmlBytes = 320_000;

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

function safeHttpsUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2_000) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:'
      || hostname === 'localhost'
      || hostname.endsWith('.local')
      || hostname === '127.0.0.1'
      || hostname === '0.0.0.0'
      || hostname === '::1'
      || /^10\./.test(hostname)
      || /^192\.168\./.test(hostname)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeEntities(match[1]);
    }
  }
  return undefined;
}

async function fetchHtml(initialUrl: URL) {
  let url = initialUrl;
  for (let redirectCount = 0; redirectCount < 4; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, {
        headers: { accept: 'text/html,application/xhtml+xml' },
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        const nextUrl = location ? safeHttpsUrl(new URL(location, url).toString()) : null;
        if (!nextUrl) throw new Error('unsafe_redirect');
        url = nextUrl;
        continue;
      }
      if (!response.ok) throw new Error(`source_${response.status}`);
      if (!(response.headers.get('content-type') || '').toLowerCase().includes('html')) throw new Error('source_not_html');
      const reader = response.body?.getReader();
      if (!reader) return { html: '', url };
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (total < maxHtmlBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        const remaining = maxHtmlBytes - total;
        chunks.push(value.slice(0, remaining));
        total += Math.min(value.length, remaining);
      }
      await reader.cancel().catch(() => undefined);
      return { html: new TextDecoder().decode(Buffer.concat(chunks)), url };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('too_many_redirects');
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET') {
    response.setHeader('allow', 'GET');
    return sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (!isAuthorized(request)) return sendJson(response, 401, { ok: false, error: 'metadata_auth_required' });
  const sourceUrl = safeHttpsUrl(request.query?.url);
  if (!sourceUrl) return sendJson(response, 400, { ok: false, error: 'valid_https_url_required' });

  try {
    const { html, url } = await fetchHtml(sourceUrl);
    const title = metaContent(html, ['og:title', 'twitter:title'])
      ?? decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    return sendJson(response, 200, {
      ok: true,
      sourceUrl: url.toString(),
      title: title || undefined,
      description: metaContent(html, ['description', 'og:description', 'twitter:description']),
      creator: metaContent(html, ['author', 'article:author', 'dc.creator', 'citation_author']),
      date: metaContent(html, ['article:published_time', 'date', 'dc.date', 'citation_publication_date']),
      attribution: metaContent(html, ['og:site_name']) ?? url.hostname.replace(/^www\./, ''),
    });
  } catch (error) {
    return sendJson(response, 422, { ok: false, error: error instanceof Error ? error.message : 'metadata_unavailable' });
  }
}
