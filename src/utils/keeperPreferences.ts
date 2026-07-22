import type { ArchiveVisibility, ArchiveWorkflowStatus } from '../data/events';

export type KeeperItemKind = 'programme' | 'reference';

export interface KeeperRecentItem {
  id: string;
  kind: KeeperItemKind;
  openedAt: string;
}

export interface KeeperSavedView {
  id: string;
  name: string;
  query: string;
  workflow: ArchiveWorkflowStatus | 'all';
  visibility: ArchiveVisibility | 'all';
  kind: string;
}

export interface KeeperPreferences {
  favouriteProgrammes: string[];
  favouriteReferences: string[];
  recentItems: KeeperRecentItem[];
  savedViews: KeeperSavedView[];
}

const storageKey = 'jerboa-keeper-preferences-v1';

const defaults: KeeperPreferences = {
  favouriteProgrammes: [],
  favouriteReferences: [],
  recentItems: [],
  savedViews: [],
};

export function readKeeperPreferences(): KeeperPreferences {
  if (typeof window === 'undefined') return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '{}') as Partial<KeeperPreferences>;
    return {
      favouriteProgrammes: Array.isArray(parsed.favouriteProgrammes) ? parsed.favouriteProgrammes : [],
      favouriteReferences: Array.isArray(parsed.favouriteReferences) ? parsed.favouriteReferences : [],
      recentItems: Array.isArray(parsed.recentItems) ? parsed.recentItems.slice(0, 12) : [],
      savedViews: Array.isArray(parsed.savedViews) ? parsed.savedViews.slice(0, 12) : [],
    };
  } catch {
    return defaults;
  }
}

export function writeKeeperPreferences(preferences: KeeperPreferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(preferences));
}

export function withRecentItem(preferences: KeeperPreferences, kind: KeeperItemKind, id: string) {
  return {
    ...preferences,
    recentItems: [
      { id, kind, openedAt: new Date().toISOString() },
      ...preferences.recentItems.filter((item) => item.id !== id || item.kind !== kind),
    ].slice(0, 12),
  };
}
