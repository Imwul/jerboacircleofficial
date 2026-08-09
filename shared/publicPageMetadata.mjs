function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function replaceMeta(html, attribute, key, value) {
  const pattern = new RegExp(`<meta\\s+${attribute}="${key}"[\\s\\S]*?\\/>`, 'i');
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function removeMeta(html, attribute, key) {
  return html.replace(new RegExp(`\\s*<meta\\s+${attribute}="${key}"[\\s\\S]*?\\/>`, 'i'), '');
}

function replaceLink(html, rel, href) {
  const pattern = new RegExp(`<link\\s+rel="${rel}"[\\s\\S]*?>`, 'i');
  const tag = `<link rel="${rel}" href="${escapeHtml(href)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function removeLink(html, rel) {
  return html.replace(new RegExp(`\\s*<link\\s+rel="${rel}"[\\s\\S]*?>`, 'i'), '');
}

export function renderPublicPageMetadata(html, {
  title,
  description,
  origin,
  canonicalPath,
  image = '/og.png',
  imageAlt = title,
  type = 'website',
  indexable = true,
}) {
  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  next = replaceMeta(next, 'name', 'description', description);
  next = replaceMeta(next, 'name', 'robots', indexable ? 'index, follow' : 'noindex, nofollow');
  next = replaceMeta(next, 'property', 'og:title', title);
  next = replaceMeta(next, 'property', 'og:description', description);
  next = replaceMeta(next, 'property', 'og:type', type);
  next = replaceMeta(next, 'property', 'og:site_name', 'Jerboa Circle');
  next = replaceMeta(next, 'property', 'og:locale', 'ko_KR');
  next = replaceMeta(next, 'name', 'twitter:title', title);
  next = replaceMeta(next, 'name', 'twitter:description', description);

  if (indexable && canonicalPath) {
    const canonical = new URL(canonicalPath, `${origin}/`).href;
    next = replaceLink(next, 'canonical', canonical);
    next = replaceMeta(next, 'property', 'og:url', canonical);
  } else {
    next = removeLink(next, 'canonical');
    next = removeMeta(next, 'property', 'og:url');
  }

  if (image) {
    const imageUrl = new URL(image, `${origin}/`).href;
    next = replaceMeta(next, 'property', 'og:image', imageUrl);
    next = replaceMeta(next, 'property', 'og:image:alt', imageAlt);
    next = replaceMeta(next, 'name', 'twitter:image', imageUrl);
    next = replaceMeta(next, 'name', 'twitter:image:alt', imageAlt);
    next = replaceMeta(next, 'name', 'twitter:card', 'summary_large_image');
  } else {
    next = removeMeta(next, 'property', 'og:image');
    next = removeMeta(next, 'property', 'og:image:alt');
    next = removeMeta(next, 'name', 'twitter:image');
    next = removeMeta(next, 'name', 'twitter:image:alt');
    next = replaceMeta(next, 'name', 'twitter:card', 'summary');
  }
  return next;
}
