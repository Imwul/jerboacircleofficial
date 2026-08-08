import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePublicArchiveRecords, publicationDecision } from '../shared/publicationState.mjs';

const now = Date.parse('2026-08-08T12:00:00Z');
const baseRecord = {
  id: 'bundled',
  visibility: 'public',
  workflowStatus: 'published',
  title: 'Bundled',
};

const cases = [
  ['published public', {}, true, 'public'],
  ['draft public', { workflowStatus: 'draft' }, false, 'not_published'],
  ['published private', { visibility: 'private' }, false, 'not_published'],
  ['future schedule', { publishAt: '2026-08-08T12:03:00Z' }, false, 'not_started'],
  ['publish boundary', { publishAt: '2026-08-08T12:00:00Z' }, true, 'public'],
  ['unpublish boundary', { unpublishAt: '2026-08-08T12:00:00Z' }, false, 'ended'],
  ['invalid schedule', { publishAt: 'later' }, false, 'invalid_schedule'],
  ['reversed schedule', { publishAt: '2026-08-09T00:00:00Z', unpublishAt: '2026-08-08T00:00:00Z' }, false, 'invalid_schedule_order'],
];

test('publishing state matrix uses one decision for Archive, detail, API, sitemap and feed', async (t) => {
  for (const [name, patch, expected, reason] of cases) {
    await t.test(name, () => {
      const record = { ...baseRecord, ...patch };
      assert.equal(publicationDecision(record, now).public, expected);
      assert.equal(publicationDecision(record, now).reason, reason);
      assert.equal(mergePublicArchiveRecords([record], {}, now).length === 1, expected);
    });
  }
});

test('tombstone and server override combinations fail closed', () => {
  assert.deepEqual(mergePublicArchiveRecords([baseRecord], { bundled: { tombstone: true } }, now), []);
  assert.deepEqual(mergePublicArchiveRecords([baseRecord], { bundled: { visibility: 'private', workflowStatus: 'archived' } }, now), []);
  assert.deepEqual(mergePublicArchiveRecords([baseRecord], { custom: { ...baseRecord, id: 'ignored', title: 'Custom' } }, now).map((item) => item.id), ['bundled', 'custom']);
});
