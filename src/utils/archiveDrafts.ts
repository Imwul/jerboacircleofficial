import type { ArchiveEvent } from '../data/events';

const draftStorageKey = 'jerboa-circle-archive-drafts';

export type ArchiveEventDraft = Partial<
  Pick<
    ArchiveEvent,
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
    | 'location'
    | 'ctaLabel'
    | 'ctaHref'
  >
> & {
  createdAt?: string;
  isCustom?: boolean;
};

export type ArchiveDraftMap = Record<string, ArchiveEventDraft>;

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

export function writeArchiveDraft(id: string, draft: ArchiveEventDraft) {
  if (!canUseStorage()) return;

  const drafts = readArchiveDrafts();
  const nextDrafts = { ...drafts, [id]: draft };
  window.localStorage.setItem(draftStorageKey, JSON.stringify(nextDrafts));
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

export function clearAllArchiveDrafts() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(draftStorageKey);
}

function listFromDraft(value: string[] | undefined, fallback: string[]) {
  return value?.length ? value : fallback;
}

function eventFromDraft(id: string, draft: ArchiveEventDraft, fallback: ArchiveEvent): ArchiveEvent {
  return {
    ...fallback,
    id,
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
    location: draft.location || '',
    ctaLabel: draft.ctaLabel || '기록 열기',
    ctaHref: draft.ctaHref || `./archive/${id}/`,
  };
}

export function applyArchiveDrafts(baseEvents: ArchiveEvent[]) {
  const drafts = readArchiveDrafts();
  const baseIds = new Set(baseEvents.map((event) => event.id));
  const fallback = baseEvents[0];

  const editedBaseEvents = baseEvents.map((event) => {
    const draft = drafts[event.id];
    if (!draft) return event;

    return {
      ...event,
      ...draft,
      themes: draft.themes?.length ? draft.themes : event.themes,
    };
  });

  const customEvents = Object.entries(drafts)
    .filter(([id]) => !baseIds.has(id))
    .map(([id, draft]) => eventFromDraft(id, draft, fallback))
    .sort((a, b) => (a.edition < b.edition ? 1 : -1));

  return [...editedBaseEvents, ...customEvents];
}
