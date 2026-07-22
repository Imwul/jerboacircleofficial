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
  const stampedReference = {
    ...reference,
    updatedAt: new Date().toISOString(),
    deletedAt: undefined,
  };
  writeArchiveReferenceDrafts({
    ...readArchiveReferenceDrafts(),
    [reference.id]: stampedReference,
  });
  return stampedReference;
}

export function deleteArchiveReferenceDraft(reference: ArchiveReference) {
  const now = new Date().toISOString();
  writeArchiveReferenceDrafts({
    ...readArchiveReferenceDrafts(),
    [reference.id]: {
      ...reference,
      updatedAt: now,
      deletedAt: now,
    },
  });
}

export function restoreDeletedArchiveReferenceDraft(id: string) {
  const drafts = readArchiveReferenceDrafts();
  const draft = drafts[id];
  if (!draft?.deletedAt) return;
  const { deletedAt: _deletedAt, ...restoredReference } = draft;
  writeArchiveReferenceDrafts({
    ...drafts,
    [id]: {
      ...restoredReference,
      updatedAt: new Date().toISOString(),
    },
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
  const edited = base
    .filter((reference) => !drafts[reference.id]?.deletedAt)
    .map((reference) => drafts[reference.id] ?? reference);
  const added = Object.values(drafts)
    .filter((reference) => !baseIds.has(reference.id) && !reference.deletedAt);
  return [...edited, ...added].sort((a, b) => {
    if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
    if (a.updatedAt) return -1;
    if (b.updatedAt) return 1;
    return 0;
  });
}
