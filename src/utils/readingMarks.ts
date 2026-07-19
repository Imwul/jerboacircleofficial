const archiveBookmarkStorageKey = 'jerboa-circle-archive-bookmarks';

export function readArchiveBookmarks(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(archiveBookmarkStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function writeArchiveBookmarks(ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(archiveBookmarkStorageKey, JSON.stringify([...new Set(ids)]));
}
