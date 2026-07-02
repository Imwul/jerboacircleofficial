import { defaultSiteText, type SiteText } from '../data/siteText';

const siteTextStorageKey = 'jerboa-circle-site-text';

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function mergeSiteText(draft?: Partial<SiteText> | null): SiteText {
  return {
    ...defaultSiteText,
    ...(draft || {}),
  };
}

export function readSiteTextDraft(): Partial<SiteText> {
  if (!canUseStorage()) return {};

  try {
    const rawDraft = window.localStorage.getItem(siteTextStorageKey);
    return rawDraft ? (JSON.parse(rawDraft) as Partial<SiteText>) : {};
  } catch {
    return {};
  }
}

export function getSiteText(): SiteText {
  return mergeSiteText(readSiteTextDraft());
}

export function writeSiteTextDraft(draft: Partial<SiteText>) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(siteTextStorageKey, JSON.stringify(draft));
}

export function clearSiteTextDraft() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(siteTextStorageKey);
}
