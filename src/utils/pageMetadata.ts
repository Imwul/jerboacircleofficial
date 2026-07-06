import { useEffect } from 'react';

interface PageMetadata {
  title: string;
  description: string;
  canonicalPath?: string;
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
  if (!path) return;

  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', `${window.location.origin}${path}`);
}

export function usePageMetadata({ title, description, canonicalPath }: PageMetadata) {
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
    upsertCanonical(canonicalPath);
  }, [title, description, canonicalPath]);
}
