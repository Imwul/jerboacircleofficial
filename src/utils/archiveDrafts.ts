import type { ArchiveEvent } from '../data/events';

const draftStorageKey = 'jerboa-circle-archive-drafts';

export type ArchiveEventDraft = Partial<
  Pick<
    ArchiveEvent,
    | 'edition'
    | 'title'
    | 'subtitle'
    | 'latinQuote'
    | 'date'
    | 'status'
    | 'posterImage'
    | 'shortDescription'
    | 'longDescription'
    | 'themes'
    | 'location'
    | 'ctaLabel'
  >
>;

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

export function clearArchiveDraft(id: string) {
  if (!canUseStorage()) return;

  const drafts = readArchiveDrafts();
  delete drafts[id];
  window.localStorage.setItem(draftStorageKey, JSON.stringify(drafts));
}

export function applyArchiveDrafts(baseEvents: ArchiveEvent[]) {
  const drafts = readArchiveDrafts();

  return baseEvents.map((event) => {
    const draft = drafts[event.id];
    if (!draft) return event;

    return {
      ...event,
      ...draft,
      themes: draft.themes?.length ? draft.themes : event.themes,
    };
  });
}
