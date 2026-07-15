import {
  archiveReferences,
  type ArchiveReference,
} from '../data/archiveKnowledge';

const referenceDraftStorageKey = 'jerboa-circle-reference-drafts';

export type ArchiveReferenceDraftMap = Record<string, ArchiveReference>;

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}
export function readArchiveReferenceDrafts(): ArchiveReferenceDraftMap {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(referenceDraftStorageKey);
    return raw ? JSON.parse(raw) as ArchiveReferenceDraftMap : {};
  } catch {
    return {};
  }
}

export function writeArchiveReferenceDrafts(drafts: ArchiveReferenceDraftMap) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(referenceDraftStorageKey, JSON.stringify(drafts));
}

export function writeArchiveReferenceDraft(reference: ArchiveReference) {
  writeArchiveReferenceDrafts({
    ...readArchiveReferenceDrafts(),
    [reference.id]: reference,
  });
}

export function clearArchiveReferenceDraft(id: string) {
  const drafts = readArchiveReferenceDrafts();
  delete drafts[id];
  writeArchiveReferenceDrafts(drafts);
}

export function clearAllArchiveReferenceDrafts() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(referenceDraftStorageKey);
}

export function applyArchiveReferenceDrafts(base: ArchiveReference[] = archiveReferences) {
  const drafts = readArchiveReferenceDrafts();
  const baseIds = new Set(base.map((reference) => reference.id));
  const edited = base.map((reference) => drafts[reference.id] ?? reference);
  const added = Object.values(drafts)
    .filter((reference) => !baseIds.has(reference.id))
    .sort((a, b) => a.title.localeCompare(b.title));
  return [...edited, ...added];
}
