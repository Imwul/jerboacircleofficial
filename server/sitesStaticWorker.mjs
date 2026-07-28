const apiOrigin = 'https://jerboacircleofficial.vercel.app';

function isDocumentRequest(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  return (request.headers.get('accept') || '').includes('text/html');
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Keep the existing role-authenticated archive APIs available while the
    // interface is served from Sites.
    if (url.pathname.startsWith('/api/')) {
      const upstreamUrl = new URL(`${url.pathname}${url.search}`, apiOrigin);
      return fetch(new Request(upstreamUrl, request));
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
