const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const indexPath = path.join(distDir, 'index.html');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function replaceMeta(html, attribute, key, value) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${key}"[\\s\\S]*?\\/>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function withMetadata(html, { title, description, robots = 'index, follow' }) {
  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  next = replaceMeta(next, 'name', 'description', description);
  next = replaceMeta(next, 'property', 'og:title', title);
  next = replaceMeta(next, 'property', 'og:description', description);
  next = replaceMeta(next, 'name', 'twitter:title', title);
  next = replaceMeta(next, 'name', 'twitter:description', description);
  next = replaceMeta(next, 'name', 'robots', robots);
  return next;
}

function writeRoute(route, html) {
  const directory = path.join(distDir, route);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), html);
}

async function main() {
  if (!fs.existsSync(indexPath)) throw new Error('dist/index.html was not found. Run the Vite build first.');

  const { createServer } = await import('vite');
  const server = await createServer({
    root: rootDir,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
  });

  let records;
  let references;
  try {
    ({ events: records } = await server.ssrLoadModule('/src/data/events.ts'));
    ({ archiveReferences: references } = await server.ssrLoadModule('/src/data/archiveKnowledge.ts'));
  } finally {
    await server.close();
  }

  const rootIndex = fs.readFileSync(indexPath, 'utf8');
  const absoluteIndex = rootIndex.replaceAll('./assets/', '/assets/');
  const nestedIndex = rootIndex.replaceAll('./assets/', '../assets/');
  const deeplyNestedIndex = rootIndex.replaceAll('./assets/', '../../assets/');
  const publicRecords = records.filter((record) => record.visibility === 'public' && record.workflowStatus === 'published');

  writeRoute('members', withMetadata(nestedIndex, {
    title: 'Private Room | Jerboa Circle',
    description: 'Jerboa Circle member programme and personal record room.',
    robots: 'noindex, nofollow',
  }));
  writeRoute('keeper', withMetadata(nestedIndex, {
    title: 'Keeper Desk | Jerboa Circle',
    description: 'Jerboa Circle archive maintenance desk.',
    robots: 'noindex, nofollow',
  }));
  writeRoute('godmode', withMetadata(nestedIndex, {
    title: 'Text Register | Jerboa Circle',
    description: 'Jerboa Circle publication text register.',
    robots: 'noindex, nofollow',
  }));
  writeRoute('archive', absoluteIndex);
  writeRoute('catalogue', withMetadata(nestedIndex, {
    title: 'Reference Catalogue | Jerboa Circle',
    description: 'Books, artworks, quotations, images, places, and themes connected across Jerboa Circle programmes.',
  }));

  for (const record of publicRecords) {
    writeRoute(path.join('archive', record.id), withMetadata(deeplyNestedIndex, {
      title: `${record.title} | Jerboa Circle`,
      description: record.shortDescription,
    }));
  }

  for (const reference of references) {
    writeRoute(path.join('catalogue', reference.id), withMetadata(deeplyNestedIndex, {
      title: `${reference.title} | Jerboa Circle Catalogue`,
      description: reference.description,
    }));
  }

  const siteOrigin = (process.env.PUBLIC_SITE_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
    || 'https://jerboa-circle.vercel.app').replace(/\/$/, '');
  const xmlEscape = (value) => escapeHtml(value).replaceAll('&#39;', '&apos;');
  const sitemapPaths = [
    '/',
    '/archive/',
    '/catalogue/',
    ...publicRecords.map((record) => `/archive/${record.id}/`),
    ...references.map((reference) => `/catalogue/${reference.id}/`),
  ];
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapPaths.map((pathname) => `  <url><loc>${xmlEscape(`${siteOrigin}${pathname}`)}</loc></url>`),
    '</urlset>',
  ].join('\n'));
  fs.writeFileSync(path.join(distDir, 'robots.txt'), [
    'User-agent: *',
    'Allow: /',
    'Disallow: /members/',
    'Disallow: /keeper/',
    'Disallow: /godmode/',
    `Sitemap: ${siteOrigin}/sitemap.xml`,
  ].join('\n'));

  const feedRecords = [...publicRecords].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  fs.writeFileSync(path.join(distDir, 'feed.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    '  <title>Jerboa Circle Archive</title>',
    `  <id>${xmlEscape(siteOrigin)}</id>`,
    `  <link href="${xmlEscape(`${siteOrigin}/feed.xml`)}" rel="self" />`,
    `  <updated>${new Date().toISOString()}</updated>`,
    ...feedRecords.map((record) => [
      '  <entry>',
      `    <title>${xmlEscape(record.title)}</title>`,
      `    <id>${xmlEscape(`${siteOrigin}/archive/${record.id}/`)}</id>`,
      `    <link href="${xmlEscape(`${siteOrigin}/archive/${record.id}/`)}" />`,
      `    <updated>${record.updatedAt}T00:00:00Z</updated>`,
      `    <summary>${xmlEscape(record.shortDescription)}</summary>`,
      '  </entry>',
    ].join('\n')),
    '</feed>',
  ].join('\n'));

  fs.writeFileSync(path.join(distDir, 'archive.json'), JSON.stringify({
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    programmes: publicRecords.map(({ posterImage, ...record }) => ({
      ...record,
      url: `${siteOrigin}/archive/${record.id}/`,
    })),
    references,
  }, null, 2));

  fs.writeFileSync(path.join(distDir, 'archive', 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    recordIds: publicRecords.map((record) => record.id),
    referenceIds: references.map((reference) => reference.id),
  }, null, 2));
  fs.writeFileSync(path.join(distDir, '404.html'), withMetadata(absoluteIndex, {
    title: '없는 길 | Jerboa Circle',
    description: '이 주소에는 아직 열린 Jerboa Circle 기록이 없습니다.',
    robots: 'noindex, nofollow',
  }));
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
