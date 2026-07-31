import { useEffect } from 'react';

interface PageMetadata {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
}

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(path?: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!path) {
    element?.remove();
    return;
  }
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', `${window.location.origin}${path}`);
}

function removeMeta(selector: string) {
  document.head.querySelector(selector)?.remove();
}

export function usePageMetadata({
  title,
  description,
  canonicalPath,
  image = '/og.png',
  noIndex = false,
  type = 'website',
}: PageMetadata) {
  useEffect(() => {
    document.title = title;
    upsertMeta('meta[name="description"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      return meta;
    }, description);
    upsertMeta('meta[property="og:title"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      return meta;
    }, title);
    upsertMeta('meta[property="og:description"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:description');
      return meta;
    }, description);
    upsertMeta('meta[property="og:type"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:type');
      return meta;
    }, type);
    upsertMeta('meta[property="og:site_name"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:site_name');
      return meta;
    }, 'Jerboa Circle');
    upsertMeta('meta[property="og:locale"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:locale');
      return meta;
    }, 'ko_KR');
    upsertMeta('meta[name="twitter:card"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:card');
      return meta;
    }, image ? 'summary_large_image' : 'summary');
    upsertMeta('meta[name="twitter:title"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:title');
      return meta;
    }, title);
    upsertMeta('meta[name="twitter:description"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:description');
      return meta;
    }, description);
    upsertMeta('meta[name="robots"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      return meta;
    }, noIndex ? 'noindex, nofollow' : 'index, follow');
    if (canonicalPath) {
      upsertMeta('meta[property="og:url"]', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:url');
        return meta;
      }, `${window.location.origin}${canonicalPath}`);
    } else {
      removeMeta('meta[property="og:url"]');
    }
    if (image) {
      const imageUrl = new URL(image, window.location.href).href;
      upsertMeta('meta[property="og:image"]', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:image');
        return meta;
      }, imageUrl);
      upsertMeta('meta[name="twitter:image"]', () => {
        const meta = document.createElement('meta');
        meta.setAttribute('name', 'twitter:image');
        return meta;
      }, imageUrl);
    } else {
      removeMeta('meta[property="og:image"]');
      removeMeta('meta[name="twitter:image"]');
    }
    upsertCanonical(canonicalPath);
  }, [title, description, canonicalPath, image, noIndex, type]);
}
