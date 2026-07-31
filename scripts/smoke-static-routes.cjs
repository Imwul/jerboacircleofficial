const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFile(filePath) {
  assert(fs.existsSync(filePath), `Missing static route artifact: ${path.relative(rootDir, filePath)}`);
}

function read(filePath) {
  assertFile(filePath);
  return fs.readFileSync(filePath, 'utf8');
}

function assetReferences(html) {
  const refs = [];
  const pattern = /\b(?:href|src)="([^"]+)"/g;
  let match;

  while ((match = pattern.exec(html))) {
    const ref = match[1];
    if (ref.startsWith('http') || ref.startsWith('mailto:') || ref.startsWith('#')) continue;
    if (ref.includes('/assets/') || ref.startsWith('./assets/') || ref.startsWith('../assets/')) {
      refs.push(ref);
    }
  }

  return refs;
}

function resolveAsset(htmlPath, ref) {
  if (ref.startsWith('/')) return path.join(distDir, ref);
  return path.resolve(path.dirname(htmlPath), ref);
}

function assertHtmlAssets(htmlPath) {
  const html = read(htmlPath);
  for (const ref of assetReferences(html)) {
    assertFile(resolveAsset(htmlPath, ref));
  }
}

const archiveBase = JSON.parse(read(path.join(rootDir, 'shared', 'archiveBase.json')));
const referenceIds = archiveBase.references.map((reference) => reference.id);
const routeFiles = [
  path.join(distDir, 'index.html'),
  path.join(distDir, '404.html'),
  path.join(distDir, 'members', 'index.html'),
  path.join(distDir, 'keeper', 'index.html'),
  path.join(distDir, 'godmode', 'index.html'),
  path.join(distDir, 'archive', 'index.html'),
  path.join(distDir, 'catalogue', 'index.html'),
  ...referenceIds.map((id) => path.join(distDir, 'catalogue', id, 'index.html')),
];

assert(fs.existsSync(distDir), 'Missing dist directory. Run the build first.');
assert(!fs.existsSync(path.join(rootDir, 'public', 'archive-base.json')),
  'The runtime archive base must not be present in public/.');
assert(!fs.existsSync(path.join(distDir, 'archive-base.json')),
  'The runtime archive base must not be present in dist/.');
assert(archiveBase.records.length > 0, 'No archive event ids found in runtime archive base.');
assert(referenceIds.length > 0, 'No archive reference ids found for static route smoke test.');
assertFile(path.join(distDir, 'robots.txt'));

for (const routeFile of routeFiles) {
  assertHtmlAssets(routeFile);
}

for (const protectedFile of [
  path.join(distDir, '404.html'),
  path.join(distDir, 'members', 'index.html'),
  path.join(distDir, 'keeper', 'index.html'),
  path.join(distDir, 'godmode', 'index.html'),
]) {
  assert(read(protectedFile).includes('<meta name="robots" content="noindex, nofollow" />'),
    `${path.relative(rootDir, protectedFile)} must remain noindex`);
}

console.log(`Static route smoke check passed for ${routeFiles.length} routes.`);
