function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const referenceFields = [
  'kind', 'title', 'attribution', 'creator', 'date', 'edition', 'locator',
  'sourceUrl', 'rights', 'language', 'citationNote', 'altText', 'mediaAssetId',
  'imageUrl', 'description', 'parentId', 'updatedAt',
];

const collectionFields = [
  'title', 'description', 'eventIds', 'visibility', 'updatedAt',
];

function publicReference(id, value) {
  if (!isPlainObject(value)
    || typeof id !== 'string' || !id
    || typeof value.kind !== 'string' || !value.kind
    || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.description !== 'string' || !value.description.trim()) return null;
  const result = { id };
  referenceFields.forEach((field) => {
    if (value[field] !== undefined) result[field] = value[field];
  });
  return result;
}

function publicCollection(id, value) {
  if (!isPlainObject(value)
    || typeof id !== 'string' || !id
    || value.visibility !== 'public'
    || typeof value.title !== 'string' || !value.title.trim()
    || !Array.isArray(value.eventIds)) return null;
  const result = { id };
  collectionFields.forEach((field) => {
    if (value[field] !== undefined) result[field] = value[field];
  });
  return result;
}

export function mergePublicArchiveReferences(baseReferences, drafts) {
  const safeBase = Array.isArray(baseReferences) ? baseReferences : [];
  const safeDrafts = isPlainObject(drafts) ? drafts : {};
  const baseIds = new Set();
  const base = safeBase.flatMap((reference) => {
    if (!isPlainObject(reference) || typeof reference.id !== 'string' || baseIds.has(reference.id)) return [];
    baseIds.add(reference.id);
    const override = safeDrafts[reference.id];
    if (isPlainObject(override) && override.deletedAt) return [];
    const next = publicReference(reference.id, isPlainObject(override) ? { ...reference, ...override } : reference);
    return next ? [next] : [];
  });
  const added = Object.entries(safeDrafts).flatMap(([id, value]) => {
    if (baseIds.has(id) || !isPlainObject(value) || value.deletedAt) return [];
    const next = publicReference(id, value);
    return next ? [next] : [];
  });
  return [...base, ...added].sort((left, right) => {
    if (left.updatedAt && right.updatedAt) return String(right.updatedAt).localeCompare(String(left.updatedAt));
    if (left.updatedAt) return -1;
    if (right.updatedAt) return 1;
    return String(left.title).localeCompare(String(right.title));
  });
}

export function createPublicReferenceDraftMap(drafts) {
  if (!isPlainObject(drafts)) return {};
  return Object.fromEntries(Object.entries(drafts).flatMap(([id, value]) => {
    if (!isPlainObject(value)) return [];
    if (value.deletedAt) return [[id, { id, deletedAt: true }]];
    const next = publicReference(id, value);
    return next ? [[id, next]] : [];
  }));
}

export function mergePublicArchiveCollections(baseCollections, drafts) {
  const safeBase = Array.isArray(baseCollections) ? baseCollections : [];
  const safeDrafts = isPlainObject(drafts) ? drafts : {};
  const baseIds = new Set();
  const base = safeBase.flatMap((collection) => {
    if (!isPlainObject(collection) || typeof collection.id !== 'string' || baseIds.has(collection.id)) return [];
    baseIds.add(collection.id);
    const override = safeDrafts[collection.id];
    if (isPlainObject(override) && (override.deletedAt || override.visibility !== 'public')) return [];
    const next = publicCollection(collection.id, isPlainObject(override) ? { ...collection, ...override } : collection);
    return next ? [next] : [];
  });
  const added = Object.entries(safeDrafts).flatMap(([id, value]) => {
    if (baseIds.has(id) || !isPlainObject(value) || value.deletedAt) return [];
    const next = publicCollection(id, value);
    return next ? [next] : [];
  });
  return [...base, ...added];
}

export function createPublicCollectionDraftMap(drafts, bundledIds = []) {
  if (!isPlainObject(drafts)) return {};
  const baseIds = new Set(Array.isArray(bundledIds) ? bundledIds : []);
  return Object.fromEntries(Object.entries(drafts).flatMap(([id, value]) => {
    if (!isPlainObject(value)) return [];
    if (value.deletedAt || value.visibility !== 'public') {
      return baseIds.has(id) ? [[id, { id, deletedAt: true }]] : [];
    }
    const next = publicCollection(id, value);
    return next ? [[id, next]] : [];
  }));
}
