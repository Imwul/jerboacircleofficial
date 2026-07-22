import type { ArchiveEvent } from '../data/events';
import { defaultArchiveCollectionId, defaultArchiveSeasonId } from '../data/events';

const draftStorageKey = 'jerboa-circle-archive-drafts';
const revisionStorageKey = 'jerboa-circle-archive-revisions';
const maxRevisionsPerRecord = 18;

export type ArchiveEventDraft = Partial<
  Pick<
    ArchiveEvent,
    | 'kind'
    | 'visibility'
    | 'workflowStatus'
    | 'seasonId'
    | 'collectionIds'
    | 'edition'
    | 'title'
    | 'subtitle'
    | 'latinQuote'
    | 'marginalia'
    | 'date'
    | 'status'
    | 'posterImage'
    | 'shortDescription'
    | 'longDescription'
    | 'passage'
    | 'materials'
    | 'themes'
    | 'referenceIds'
    | 'relatedEventIds'
    | 'location'
    | 'ctaLabel'
    | 'ctaHref'
    | 'publishedAt'
    | 'updatedAt'
  >
> & {
  createdAt?: string;
  isCustom?: boolean;
  deletedAt?: string;
};

export type ArchiveDraftMap = Record<string, ArchiveEventDraft>;

export interface ArchiveDraftRevision {
  id: string;
  recordId: string;
  savedAt: string;
  label: string;
  title: string;
  draft: ArchiveEventDraft;
}

export type ArchiveRevisionMap = Record<string, ArchiveDraftRevision[]>;

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function readArchiveDrafts(): ArchiveDraftMap {
  if (!canUseStorage()) return {};

  try {
    const rawDrafts = window.localStorage.getItem(draftStorageKey);
    return rawDrafts ? (JSON.parse(rawDrafts) as ArchiveDraftMap) : {};
  } catch {
    return {};
  }
}

export function readArchiveRevisions(): ArchiveRevisionMap {
  if (!canUseStorage()) return {};

  try {
    const rawRevisions = window.localStorage.getItem(revisionStorageKey);
    return rawRevisions ? (JSON.parse(rawRevisions) as ArchiveRevisionMap) : {};
  } catch {
    return {};
  }
}

export function readArchiveDraftRevisions(recordId: string) {
  return readArchiveRevisions()[recordId] ?? [];
}

function writeArchiveRevisions(revisions: ArchiveRevisionMap) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(revisionStorageKey, JSON.stringify(revisions));
}

function recordArchiveRevision(id: string, draft: ArchiveEventDraft, label = 'local draft') {
  if (!canUseStorage()) return;

  const savedAt = new Date().toISOString();
  const revisions = readArchiveRevisions();
  const nextRevision: ArchiveDraftRevision = {
    id: `${id}-${Date.now().toString(36)}`,
    recordId: id,
    savedAt,
    label,
    title: draft.title || id,
    draft: {
      ...draft,
      updatedAt: draft.updatedAt || savedAt.slice(0, 10),
    },
  };

  writeArchiveRevisions({
    ...revisions,
    [id]: [nextRevision, ...(revisions[id] ?? [])].slice(0, maxRevisionsPerRecord),
  });
}

export function writeArchiveDraft(id: string, draft: ArchiveEventDraft, options: { label?: string; recordRevision?: boolean } = {}) {
  if (!canUseStorage()) return;

  const drafts = readArchiveDrafts();
  const stampDate = new Date().toISOString().slice(0, 10);
  const stampedDraft = {
    ...draft,
    publishedAt: draft.publishedAt || (draft.workflowStatus === 'published' ? stampDate : undefined),
    updatedAt: draft.updatedAt || stampDate,
  };
  const nextDrafts = { ...drafts, [id]: stampedDraft };
  window.localStorage.setItem(draftStorageKey, JSON.stringify(nextDrafts));

  if (options.recordRevision !== false) {
    recordArchiveRevision(id, stampedDraft, options.label);
  }
}

export function writeArchiveDrafts(drafts: ArchiveDraftMap) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(draftStorageKey, JSON.stringify(drafts));
}

export function clearArchiveDraft(id: string) {
  if (!canUseStorage()) return;

  const drafts = readArchiveDrafts();
  delete drafts[id];
  window.localStorage.setItem(draftStorageKey, JSON.stringify(drafts));
}

export function deleteArchiveDraft(id: string) {
  if (!canUseStorage()) return;
  const drafts = readArchiveDrafts();
  const now = new Date().toISOString();
  writeArchiveDrafts({
    ...drafts,
    [id]: {
      ...drafts[id],
      deletedAt: now,
      updatedAt: now,
    },
  });
}

export function restoreDeletedArchiveDraft(id: string) {
  if (!canUseStorage()) return;
  const drafts = readArchiveDrafts();
  const draft = drafts[id];
  if (!draft?.deletedAt) return;
  const { deletedAt: _deletedAt, ...restoredDraft } = draft;
  writeArchiveDrafts({ ...drafts, [id]: restoredDraft });
}

export function clearAllArchiveDrafts() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(draftStorageKey);
}

export function restoreArchiveDraftRevision(recordId: string, revisionId: string) {
  const revision = readArchiveDraftRevisions(recordId).find((item) => item.id === revisionId);
  if (!revision) return false;

  writeArchiveDraft(recordId, revision.draft, { label: 'rollback' });
  return true;
}

function listFromDraft(value: string[] | undefined, fallback: string[]) {
  return value?.length ? value : fallback;
}

function eventFromDraft(id: string, draft: ArchiveEventDraft, fallback: ArchiveEvent): ArchiveEvent {
  return {
    ...fallback,
    id,
    kind: draft.kind || fallback.kind || 'workshop',
    visibility: draft.visibility || fallback.visibility || 'public',
    workflowStatus: draft.workflowStatus || fallback.workflowStatus || 'draft',
    seasonId: draft.seasonId || fallback.seasonId || defaultArchiveSeasonId,
    collectionIds: listFromDraft(draft.collectionIds, fallback.collectionIds?.length ? fallback.collectionIds : [defaultArchiveCollectionId]),
    edition: draft.edition || fallback.edition,
    title: draft.title || 'Untitled Programme',
    subtitle: draft.subtitle || '',
    latinQuote: draft.latinQuote || '',
    marginalia: draft.marginalia || '',
    date: draft.date || '새 기록',
    status: draft.status || 'upcoming',
    posterImage: draft.posterImage || fallback.posterImage,
    shortDescription: draft.shortDescription || '',
    longDescription: draft.longDescription || '',
    passage: listFromDraft(draft.passage, []),
    materials: listFromDraft(draft.materials, []),
    themes: listFromDraft(draft.themes, []),
    referenceIds: draft.referenceIds ?? [],
    relatedEventIds: draft.relatedEventIds ?? [],
    location: draft.location || '',
    ctaLabel: draft.ctaLabel || '기록 열기',
    ctaHref: draft.ctaHref || `./archive/${id}/`,
    publishedAt: draft.publishedAt || fallback.publishedAt || new Date().toISOString().slice(0, 10),
    updatedAt: draft.updatedAt || fallback.updatedAt || new Date().toISOString().slice(0, 10),
  };
}

export function applyArchiveDraftMap(baseEvents: ArchiveEvent[], drafts: ArchiveDraftMap) {
  const baseIds = new Set(baseEvents.map((event) => event.id));
  const fallback = baseEvents[0];

  const editedBaseEvents = baseEvents.filter((event) => !drafts[event.id]?.deletedAt).map((event) => {
    const draft = drafts[event.id];
    if (!draft) return event;

    return {
      ...event,
      ...draft,
      themes: draft.themes?.length ? draft.themes : event.themes,
      referenceIds: draft.referenceIds !== undefined ? draft.referenceIds : event.referenceIds,
      relatedEventIds: draft.relatedEventIds !== undefined ? draft.relatedEventIds : event.relatedEventIds,
      collectionIds: draft.collectionIds?.length ? draft.collectionIds : event.collectionIds,
      workflowStatus: draft.workflowStatus || event.workflowStatus,
    };
  });

  const customEvents = Object.entries(drafts)
    .filter(([id, draft]) => !baseIds.has(id) && !draft.deletedAt)
    .map(([id, draft]) => eventFromDraft(id, draft, fallback))
    .sort((a, b) => (a.edition < b.edition ? 1 : -1));

  return [...editedBaseEvents, ...customEvents];
}

export function applyArchiveDrafts(baseEvents: ArchiveEvent[]) {
  return applyArchiveDraftMap(baseEvents, readArchiveDrafts());
}
