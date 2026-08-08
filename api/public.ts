import { mergePublicArchiveRecords } from '../shared/publicationState.mjs';
import {
  mergePublicArchiveCollections,
  mergePublicArchiveReferences,
} from '../shared/publicArchiveMaterial.mjs';
import { renderPublicPageMetadata } from '../shared/publicPageMetadata.mjs';
import archiveBase from '../shared/archiveBase.json' with { type: 'json' };

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function send(response: any, status: number, type: string, body: string) {
  response.statusCode = status;
  response.setHeader('content-type', type);
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.end(body);
}

function requestOrigin(request: any) {
  const publicOrigin = String(request.headers['x-jerboa-public-origin'] || '');
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(publicOrigin)) return publicOrigin;
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || 'jerboacircleofficial.vercel.app')
    .split(',')[0].trim();
  return `${/^(?:localhost|127\.0\.0\.1)(?::|$)/.test(host) ? 'http' : 'https'}://${host}`;
}

async function publicMaterial(request: any) {
  const origin = requestOrigin(request);
  const internalHost = String(request.headers['x-forwarded-host'] || request.headers.host).split(',')[0].trim();
  const internalOrigin = `${/^(?:localhost|127\.0\.0\.1)(?::|$)/.test(internalHost) ? 'http' : 'https'}://${internalHost}`;
  const headers: Record<string, string> = { 'user-agent': 'jerboa-public-materializer/1.0' };
  if (typeof request.headers['x-vercel-protection-bypass'] === 'string') {
    headers['x-vercel-protection-bypass'] = request.headers['x-vercel-protection-bypass'];
  }
  if (typeof request.headers.cookie === 'string') headers.cookie = request.headers.cookie;
  const [syncResponse, indexResponse] = await Promise.all([
    fetch(`${internalOrigin}/api/sync?scope=archive`, { headers, cache: 'no-store' }),
    fetch(`${internalOrigin}/index.html`, { headers, cache: 'no-store' }),
  ]);
  if (!syncResponse.ok || !indexResponse.ok) throw new Error('public_material_unavailable');
  const sync = await syncResponse.json();
  const data = sync?.saved?.data ?? {};
  const drafts = data.drafts ?? {};
  return {
    origin,
    records: mergePublicArchiveRecords(archiveBase.records, drafts, Date.now()),
    references: mergePublicArchiveReferences(archiveBase.references, data.references),
    collections: mergePublicArchiveCollections((archiveBase as any).collections, data.collections),
    html: await indexResponse.text(),
  };
}

function publicProgramme(record: any, origin: string) {
  const { visibility: _visibility, workflowStatus: _workflowStatus,
    publishAt: _publishAt, unpublishAt: _unpublishAt, ...publicRecord } = record;
  return { ...publicRecord, url: `${origin}/archive/${record.id}/` };
}

export default async function handler(request: any, response: any) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('allow', 'GET, HEAD');
    return send(response, 405, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'method_not_allowed' }));
  }
  const format = String(request.query?.format || 'archive');
  if (format === 'removed') {
    return send(response, 404, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'not_found' }));
  }
  try {
    const { origin, records, references, collections, html } = await publicMaterial(request);
    if (format === 'page') {
      const id = String(request.query?.id || '');
      const record = records.find((item: any) => item.id === id);
      return send(response, record ? 200 : 404, 'text/html; charset=utf-8', renderPublicPageMetadata(html, record ? {
        title: `${record.title} | Jerboa Circle`,
        description: record.shortDescription,
        origin,
        canonicalPath: `/archive/${record.id}/`,
        image: record.posterImage || '/og.png',
        type: 'article',
        indexable: true,
      } : {
        title: '없는 길 | Jerboa Circle',
        description: '이 주소에는 현재 공개된 Jerboa Circle 기록이 없습니다.',
        origin,
        canonicalPath: '',
        image: '/og.png',
        indexable: false,
      }));
    }
    if (format === 'catalogue-page') {
      const id = String(request.query?.id || '');
      const reference = references.find((item: any) => item.id === id);
      return send(response, reference ? 200 : 404, 'text/html; charset=utf-8', renderPublicPageMetadata(html, reference ? {
        title: `${reference.title} | Jerboa Circle Catalogue`,
        description: reference.description,
        origin,
        canonicalPath: `/catalogue/${reference.id}/`,
        image: reference.imageUrl || '/og.png',
        type: 'article',
        indexable: true,
      } : {
        title: '미필사 자료 | Jerboa Circle',
        description: '이 주소에는 현재 공개된 Jerboa Circle 자료가 없습니다.',
        origin,
        canonicalPath: '',
        image: '/og.png',
        indexable: false,
      }));
    }
    if (format === 'not-found') {
      return send(response, 404, 'text/html; charset=utf-8', renderPublicPageMetadata(html, {
        title: '없는 길 | Jerboa Circle',
        description: '이 주소에는 현재 공개된 Jerboa Circle 기록이 없습니다.',
        origin,
        canonicalPath: '',
        image: '/og.png',
        indexable: false,
      }));
    }
    if (format === 'sitemap') {
      const paths = ['/', '/archive/', '/catalogue/', ...records.map((record: any) => `/archive/${record.id}/`),
        ...references.map((reference: any) => `/catalogue/${reference.id}/`)];
      return send(response, 200, 'application/xml; charset=utf-8', [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...paths.map((path) => `  <url><loc>${escapeXml(`${origin}${path}`)}</loc></url>`),
        '</urlset>',
      ].join('\n'));
    }
    if (format === 'feed') {
      const sorted = [...records].sort((a: any, b: any) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
      return send(response, 200, 'application/atom+xml; charset=utf-8', [
        '<?xml version="1.0" encoding="UTF-8"?>', '<feed xmlns="http://www.w3.org/2005/Atom">',
        '  <title>Jerboa Circle Archive</title>', `  <id>${escapeXml(origin)}</id>`,
        `  <link href="${escapeXml(`${origin}/feed.xml`)}" rel="self" />`,
        `  <updated>${new Date().toISOString()}</updated>`,
        ...sorted.map((record: any) => ['  <entry>', `    <title>${escapeXml(record.title)}</title>`,
          `    <id>${escapeXml(`${origin}/archive/${record.id}/`)}</id>`,
          `    <link href="${escapeXml(`${origin}/archive/${record.id}/`)}" />`,
          `    <updated>${escapeXml(record.updatedAt || record.publishedAt)}T00:00:00Z</updated>`,
          `    <summary>${escapeXml(record.shortDescription)}</summary>`, '  </entry>'].join('\n')),
        '</feed>',
      ].join('\n'));
    }
    if (format === 'manifest') {
      return send(response, 200, 'application/json; charset=utf-8', JSON.stringify({
        generatedAt: new Date().toISOString(),
        recordIds: records.map((record: any) => record.id),
        referenceIds: references.map((reference: any) => reference.id),
      }, null, 2));
    }
    return send(response, 200, 'application/json; charset=utf-8', JSON.stringify({
      schemaVersion: 3,
      generatedAt: new Date().toISOString(),
      programmes: records.map((record: any) => publicProgramme(record, origin)),
      references,
      collections,
    }, null, 2));
  } catch (error) {
    console.error('Public materialization failed:', error);
    return send(response, 503, 'application/json; charset=utf-8', JSON.stringify({ ok: false, error: 'public_material_unavailable' }));
  }
}
