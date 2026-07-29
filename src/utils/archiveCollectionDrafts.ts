import {
  archiveCollections,
  type ArchiveCollection,
} from '../data/events';

export const archiveCollectionStorageKey = 'jerboa-circle-archive-collections';

export type ArchiveCollectionDraftMap = Record<string, ArchiveCollection>;

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function readArchiveCollectionDrafts(): ArchiveCollectionDraftMap {
  if (!canUseStorage()) return {};

  try {
    const rawCollections = window.localStorage.getItem(archiveCollectionStorageKey);
    return rawCollections ? (JSON.parse(rawCollections) as ArchiveCollectionDraftMap) : {};
  } catch {
    return {};
  }
}

export function writeArchiveCollectionDrafts(collections: ArchiveCollectionDraftMap) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(archiveCollectionStorageKey, JSON.stringify(collections));
}

export function writeArchiveCollectionDraft(collection: ArchiveCollection) {
  const collections = readArchiveCollectionDrafts();
  writeArchiveCollectionDrafts({
    ...collections,
    [collection.id]: collection,
  });
}

export function clearArchiveCollectionDrafts() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(archiveCollectionStorageKey);
}

export function applyArchiveCollectionDrafts(
  baseCollections: ArchiveCollection[] = archiveCollections,
  drafts: ArchiveCollectionDraftMap = readArchiveCollectionDrafts(),
) {
  const baseIds = new Set(baseCollections.map((collection) => collection.id));
  const editedCollections = baseCollections.map((collection) => drafts[collection.id] ?? collection);
  const customCollections = Object.values(drafts)
    .filter((collection) => !baseIds.has(collection.id))
    .sort((left, right) => left.title.localeCompare(right.title, 'ko'));

  return [...editedCollections, ...customCollections];
}
