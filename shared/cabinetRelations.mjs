export function canReadCabinetItem(item, viewerId) {
  return Boolean(item && (item.ownerId === viewerId || item.visibility === 'public'));
}

export function normalizeCabinetRelatedIds({ itemId, ownerId, relatedIds, items, max = 50 }) {
  const byId = new Map((Array.isArray(items) ? items : []).map((item) => [item.id, item]));
  const seen = new Set();
  const result = [];
  for (const id of Array.isArray(relatedIds) ? relatedIds : []) {
    if (typeof id !== 'string' || !id || id === itemId || seen.has(id)) continue;
    const target = byId.get(id);
    if (!target || (target.ownerId !== ownerId && target.visibility !== 'public')) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= max) break;
  }
  return result;
}
