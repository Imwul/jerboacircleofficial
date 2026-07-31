export const bundledArchiveRecordIds = Object.freeze([
  'scintilla-animae',
  'reading-edge-room',
  'letters-unmade-places',
  'museum-after-hours',
]);

const bundledArchiveRecordIdSet = new Set(bundledArchiveRecordIds);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Keeper datetime-local values are authored in Korea. Older imports may not
// include a zone, so interpret them in the same zone on browsers and servers.
export function parsePublicationInstant(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const normalized = value.trim();
  const hasZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
  const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(normalized);
  const candidate = dateOnly
    ? `${normalized}T00:00:00+09:00`
    : localDateTime && !hasZone
      ? `${normalized}+09:00`
      : normalized;
  const timestamp = Date.parse(candidate);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

export function publicationDecision(record, now = Date.now()) {
  if (!isPlainObject(record) || record.visibility !== 'public' || record.workflowStatus !== 'published') {
    return { public: false, reason: 'not_published' };
  }

  const publishAt = parsePublicationInstant(record.publishAt);
  const unpublishAt = parsePublicationInstant(record.unpublishAt);
  if (Number.isNaN(publishAt) || Number.isNaN(unpublishAt)) {
    return { public: false, reason: 'invalid_schedule' };
  }
  if (publishAt !== null && unpublishAt !== null && publishAt >= unpublishAt) {
    return { public: false, reason: 'invalid_schedule_order' };
  }
  if (publishAt !== null && publishAt > now) return { public: false, reason: 'not_started' };
  if (unpublishAt !== null && unpublishAt <= now) return { public: false, reason: 'ended' };
  return { public: true, reason: 'public' };
}

export function isPublicationPublic(record, now = Date.now()) {
  return publicationDecision(record, now).public;
}

const publicEventFields = [
  'kind', 'seasonId', 'collectionIds', 'edition', 'title', 'subtitle', 'latinQuote',
  'marginalia', 'date', 'status', 'posterImage', 'posterAlt', 'detailImage',
  'detailImageAlt', 'shortDescription', 'longDescription', 'passage', 'materials',
  'primaryThemes', 'themes', 'referenceIds', 'relatedEventIds', 'location',
  'ctaLabel', 'ctaHref', 'publishedAt', 'updatedAt',
];

function publicEventRecord(value) {
  const result = { visibility: 'public', workflowStatus: 'published' };
  publicEventFields.forEach((field) => {
    if (value[field] !== undefined) result[field] = value[field];
  });
  return result;
}

export function createPublicDraftMap(drafts, now = Date.now()) {
  if (!isPlainObject(drafts)) return {};
  return Object.fromEntries(Object.entries(drafts).flatMap(([id, value]) => {
    if (!isPlainObject(value)) return [];
    if (isPublicationPublic(value, now)) return [[id, publicEventRecord(value)]];
    // Only bundled IDs need a suppression marker. Omitting custom private IDs
    // prevents an unauthenticated reader from learning that they exist.
    if (bundledArchiveRecordIdSet.has(id)) return [[id, { tombstone: true }]];
    return [];
  }));
}

export function mergePublicArchiveRecords(baseRecords, drafts, now = Date.now()) {
  const safeBase = Array.isArray(baseRecords) ? baseRecords : [];
  const safeDrafts = isPlainObject(drafts) ? drafts : {};
  const baseIds = new Set();
  const mergedBase = safeBase.flatMap((record) => {
    if (!isPlainObject(record) || typeof record.id !== 'string' || !record.id || baseIds.has(record.id)) return [];
    baseIds.add(record.id);
    const override = safeDrafts[record.id];
    // Any tombstone-shaped override suppresses the bundled record. A malformed
    // marker must fail closed instead of becoming publishable metadata.
    if (isPlainObject(override) && Object.hasOwn(override, 'tombstone')) return [];
    const merged = isPlainObject(override) ? { ...record, ...override, id: record.id } : record;
    return isPublicationPublic(merged, now) ? [merged] : [];
  });
  const custom = Object.entries(safeDrafts).flatMap(([id, value]) => {
    if (baseIds.has(id) || !isPlainObject(value) || Object.hasOwn(value, 'tombstone')) return [];
    const record = { ...value, id };
    return isPublicationPublic(record, now) ? [record] : [];
  });
  return [...mergedBase, ...custom];
}
