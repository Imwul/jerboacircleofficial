const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const indexPath = path.join(distDir, 'index.html');
const siteOrigin = (process.env.PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  || 'https://jerboa-circle.vercel.app').replace(/\/$/, '');

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

function replaceLink(html, rel, href) {
  const pattern = new RegExp(`<link\\s+rel="${rel}"[\\s\\S]*?>`, 'i');
  const tag = `<link rel="${rel}" href="${escapeHtml(href)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function withMetadata(html, {
  title,
  description,
  robots = 'index, follow',
  canonicalPath,
  type = 'website',
  image = '/og.png',
}) {
  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  next = replaceMeta(next, 'name', 'description', description);
  next = replaceMeta(next, 'property', 'og:title', title);
  next = replaceMeta(next, 'property', 'og:description', description);
  next = replaceMeta(next, 'name', 'twitter:title', title);
  next = replaceMeta(next, 'name', 'twitter:description', description);
  next = replaceMeta(next, 'name', 'robots', robots);
  next = replaceMeta(next, 'property', 'og:type', type);
  next = replaceMeta(next, 'name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  if (canonicalPath) {
    const canonicalUrl = `${siteOrigin}${canonicalPath}`;
    next = replaceLink(next, 'canonical', canonicalUrl);
    next = replaceMeta(next, 'property', 'og:url', canonicalUrl);
  }
  if (image) {
    const imageUrl = new URL(image, `${siteOrigin}/`).href;
    next = replaceMeta(next, 'property', 'og:image', imageUrl);
    next = replaceMeta(next, 'name', 'twitter:image', imageUrl);
  }
  return next;
}

function isPublicRecord(record) {
  if (record.visibility !== 'public' || record.workflowStatus !== 'published') return false;
  const now = Date.now();
  const publishAt = record.publishAt ? Date.parse(record.publishAt) : null;
  const unpublishAt = record.unpublishAt ? Date.parse(record.unpublishAt) : null;
  return (publishAt === null || (Number.isFinite(publishAt) && publishAt <= now))
    && (unpublishAt === null || (Number.isFinite(unpublishAt) && unpublishAt > now));
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
    optimizeDeps: { noDiscovery: true },
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
  const publicRecords = records.filter(isPublicRecord);

  fs.writeFileSync(indexPath, withMetadata(rootIndex, {
    title: 'Jerboa Circle Official Archive',
    description: '문헌, 이미지, 장소와 프로그램이 서로 이어지는 저보아 서클의 공식 아카이브.',
    canonicalPath: '/',
  }));

  writeRoute('members', withMetadata(rootIndex, {
    title: 'Private Room | Jerboa Circle',
    description: 'Jerboa Circle member programme and personal record room.',
    robots: 'noindex, nofollow',
    canonicalPath: '/members/',
  }));
  writeRoute('keeper', withMetadata(rootIndex, {
    title: 'Keeper Desk | Jerboa Circle',
    description: 'Jerboa Circle archive maintenance desk.',
    robots: 'noindex, nofollow',
    canonicalPath: '/keeper/',
  }));
  writeRoute('godmode', withMetadata(rootIndex, {
    title: 'Text Register | Jerboa Circle',
    description: 'Jerboa Circle publication text register.',
    robots: 'noindex, nofollow',
    canonicalPath: '/godmode/',
  }));
  writeRoute('archive', withMetadata(rootIndex, {
    title: 'Archive | Jerboa Circle',
    description: '저보아 서클의 현재 프로그램과 지난 기록을 검색하고 분류해 살펴봅니다.',
    canonicalPath: '/archive/',
  }));
  writeRoute('catalogue', withMetadata(rootIndex, {
    title: 'Reference Catalogue | Jerboa Circle',
    description: 'Books, artworks, quotations, images, places, and themes connected across Jerboa Circle programmes.',
    canonicalPath: '/catalogue/',
  }));

  for (const record of publicRecords) {
    writeRoute(path.join('archive', record.id), withMetadata(rootIndex, {
      title: `${record.title} | Jerboa Circle`,
      description: record.shortDescription,
      canonicalPath: `/archive/${record.id}/`,
      type: 'article',
    }));
  }

  for (const reference of references) {
    writeRoute(path.join('catalogue', reference.id), withMetadata(rootIndex, {
      title: `${reference.title} | Jerboa Circle Catalogue`,
      description: reference.description,
      canonicalPath: `/catalogue/${reference.id}/`,
      type: 'article',
    }));
  }

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
  fs.writeFileSync(path.join(distDir, '404.html'), withMetadata(rootIndex, {
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
