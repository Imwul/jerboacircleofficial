import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadCabinetItem, normalizeCabinetRelatedIds } from '../shared/cabinetRelations.mjs';

const items = [
  { id: 'mine', ownerId: 'a', visibility: 'private' },
  { id: 'public-other', ownerId: 'b', visibility: 'public' },
  { id: 'private-other', ownerId: 'b', visibility: 'private' },
  { id: 'missing-fields', ownerId: 'a' },
];

test('Cabinet direct reads allow only owned or public records', () => {
  assert.equal(canReadCabinetItem(items[0], 'a'), true);
  assert.equal(canReadCabinetItem(items[1], 'a'), true);
  assert.equal(canReadCabinetItem(items[2], 'a'), false);
  assert.equal(canReadCabinetItem(undefined, 'a'), false);
});

test('Cabinet relation normalization removes self, duplicates, missing and private cross-owner ids', () => {
  assert.deepEqual(normalizeCabinetRelatedIds({
    itemId: 'mine', ownerId: 'a', items,
    relatedIds: ['mine', 'public-other', 'private-other', 'missing', 'missing-fields', 'public-other'],
  }), ['public-other', 'missing-fields']);
});

test('Cabinet relation normalization has a defensive upper bound', () => {
  const many = Array.from({ length: 80 }, (_, index) => ({ id: `r${index}`, ownerId: 'a', visibility: 'private' }));
  const result = normalizeCabinetRelatedIds({ itemId: 'mine', ownerId: 'a', items: many, relatedIds: many.map((item) => item.id) });
  assert.equal(result.length, 50);
});
