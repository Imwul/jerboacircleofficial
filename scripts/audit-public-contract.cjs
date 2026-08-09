const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const origin = 'https://jerboacircleofficial.vercel.app';

function fail(message) {
  throw new Error(message);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`Missing contract artifact: ${relativePath}`);
  return fs.readFileSync(file, 'utf8');
}

function count(html, pattern) {
  return [...html.matchAll(pattern)].length;
}

function assertMetadata(relativePath, canonicalPath, noIndex = false) {
  const html = read(relativePath);
  const label = relativePath;
  if (!/<title>[^<]+<\/title>/.test(html)) fail(`${label}: title is missing`);
  for (const selector of [
    /<meta name="description" content="[^"]+" \/>/,
    /<meta name="robots" content="[^"]+" \/>/,
    /<meta property="og:title" content="[^"]+" \/>/,
    /<meta property="og:description" content="[^"]+" \/>/,
    /<meta property="og:type" content="[^"]+" \/>/,
    /<meta property="og:image" content="[^"]+" \/>/,
    /<meta property="og:image:alt" content="[^"]+" \/>/,
    /<meta name="twitter:card" content="[^"]+" \/>/,
    /<meta name="twitter:title" content="[^"]+" \/>/,
    /<meta name="twitter:description" content="[^"]+" \/>/,
    /<meta name="twitter:image" content="[^"]+" \/>/,
    /<meta name="twitter:image:alt" content="[^"]+" \/>/,
  ]) {
    if (!selector.test(html)) fail(`${label}: public metadata is incomplete (${selector})`);
  }
  if (count(html, /<link rel="canonical"/g) > 1) fail(`${label}: duplicate canonical links`);
  if (noIndex) {
    if (!html.includes('name="robots" content="noindex, nofollow"')) fail(`${label}: protected route must be noindex`);
  } else {
    const canonical = `${origin}${canonicalPath}`;
    if (!html.includes(`rel="canonical" href="${canonical}"`)) fail(`${label}: canonical mismatch`);
    if (!html.includes(`property="og:url" content="${canonical}"`)) fail(`${label}: og:url mismatch`);
  }
}

assertMetadata('dist/index.html', '/');
assertMetadata('dist/archive/index.html', '/archive/');
assertMetadata('dist/catalogue/index.html', '/catalogue/');
assertMetadata('dist/members/index.html', '/members/', true);
assertMetadata('dist/keeper/index.html', '/keeper/', true);
assertMetadata('dist/godmode/index.html', '/godmode/', true);

const missing = read('dist/404.html');
if (!missing.includes('name="robots" content="noindex, nofollow"')) fail('404.html must be noindex');

const vercel = JSON.parse(read('vercel.json'));
const rewriteDestinations = vercel.rewrites.map((rewrite) => rewrite.destination);
for (const destination of [
  '/api/public?format=page&id=:id',
  '/api/public?format=catalogue-page&id=:id',
  '/api/public?format=not-found',
]) {
  if (!rewriteDestinations.includes(destination)) fail(`Missing dynamic route contract: ${destination}`);
}

const archiveBase = JSON.parse(read('shared/archiveBase.json'));
for (const reference of archiveBase.references) {
  const route = path.join(dist, 'catalogue', reference.id, 'index.html');
  if (!fs.existsSync(route)) fail(`Missing Catalogue route for ${reference.id}`);
}

console.log(`Public route contract passed: 6 metadata routes, ${archiveBase.references.length} Catalogue details, dynamic 404 routing.`);
