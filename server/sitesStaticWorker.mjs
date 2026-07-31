const apiOrigin = 'https://jerboacircleofficial.vercel.app';
const dynamicPublicRoutes = new Map([
  ['/sitemap.xml', 'sitemap'],
  ['/feed.xml', 'feed'],
  ['/archive.json', 'archive'],
  ['/archive/manifest.json', 'manifest'],
]);

function isDocumentRequest(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  return (request.headers.get('accept') || '').includes('text/html');
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/archive-base.json') {
      return new Response(JSON.stringify({ ok: false, error: 'not_found' }), {
        status: 404,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        },
      });
    }

    // Keep the existing role-authenticated archive APIs available while the
    // interface is served from Sites.
    if (url.pathname.startsWith('/api/')) {
      const upstreamUrl = new URL(`${url.pathname}${url.search}`, apiOrigin);
      return fetch(new Request(upstreamUrl, request));
    }

    const publicFormat = dynamicPublicRoutes.get(url.pathname);
    const archiveDetail = url.pathname.match(/^\/archive\/([^/]+)\/$/);
    if (publicFormat || archiveDetail) {
      const upstreamUrl = new URL('/api/public', apiOrigin);
      upstreamUrl.searchParams.set('format', publicFormat || 'page');
      if (archiveDetail) upstreamUrl.searchParams.set('id', decodeURIComponent(archiveDetail[1]));
      const headers = new Headers(request.headers);
      headers.set('x-jerboa-public-origin', url.origin);
      return fetch(new Request(upstreamUrl, { method: request.method, headers }));
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status !== 404 || !isDocumentRequest(request)) {
      return assetResponse;
    }

    // React owns the public, catalogue, member, and Keeper routes.
    const indexUrl = new URL('/index.html', request.url);
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};

export default worker;
