import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPublicDraftMap,
  isPublicationPublic,
  mergePublicArchiveRecords,
  parsePublicationInstant,
  publicationDecision,
} from '../shared/publicationState.mjs';

const published = { visibility: 'public', workflowStatus: 'published', title: 'Record' };
const at = (value) => Date.parse(value);

test('publication state covers the complete lifecycle and exact boundaries', () => {
  const now = at('2026-08-01T00:00:00.000Z');
  assert.equal(isPublicationPublic(published, now), true);
  assert.equal(isPublicationPublic({ ...published, workflowStatus: 'draft' }, now), false);
  assert.equal(isPublicationPublic({ ...published, visibility: 'private' }, now), false);
  assert.equal(publicationDecision({ ...published, publishAt: '2026-08-01T00:00:00.000Z' }, now).reason, 'public');
  assert.equal(publicationDecision({ ...published, publishAt: '2026-08-01T00:00:00.001Z' }, now).reason, 'not_started');
  assert.equal(publicationDecision({ ...published, unpublishAt: '2026-08-01T00:00:00.000Z' }, now).reason, 'ended');
  assert.equal(publicationDecision({ ...published, unpublishAt: '2026-08-01T00:00:00.001Z' }, now).reason, 'public');
  assert.equal(publicationDecision({ ...published, publishAt: 'invalid' }, now).reason, 'invalid_schedule');
  assert.equal(publicationDecision({ ...published, publishAt: '2026-08-02', unpublishAt: '2026-08-01' }, now).reason, 'invalid_schedule_order');
  assert.equal(publicationDecision({ ...published, publishAt: '2026-08-01T09:00', unpublishAt: '2026-08-01T09:00' }, now).reason, 'invalid_schedule_order');
});

test('timezone-less Keeper schedules are consistently interpreted as Korea time', () => {
  assert.equal(parsePublicationInstant('2026-08-01T09:00'), at('2026-08-01T00:00:00.000Z'));
  assert.equal(parsePublicationInstant('2026-08-01'), at('2026-07-31T15:00:00.000Z'));
  assert.equal(parsePublicationInstant('2026-08-01T09:00:00+09:00'), at('2026-08-01T00:00:00.000Z'));
});

test('public snapshot omits private custom ids and uses minimum bundled tombstones', () => {
  const result = createPublicDraftMap({
    'private-custom-secret': { visibility: 'private', workflowStatus: 'draft', updatedAt: 'secret-time' },
    'future-custom-secret': { ...published, publishAt: '2999-01-01T00:00:00Z' },
    'scintilla-animae': { visibility: 'private', workflowStatus: 'archived', unpublishAt: 'secret-time' },
  });
  assert.deepEqual(result, { 'scintilla-animae': { tombstone: true } });
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('public snapshot strips scheduling and internal draft metadata', () => {
  const now = at('2026-08-01T00:00:00Z');
  const result = createPublicDraftMap({
    public: {
      ...published,
      shortDescription: 'Public copy',
      publishAt: '2026-07-01T00:00:00Z',
      unpublishAt: '2026-09-01T00:00:00Z',
      createdAt: 'private metadata',
    },
  }, now);
  assert.equal(result.public.shortDescription, 'Public copy');
  assert.equal(result.public.visibility, 'public');
  assert.equal('publishAt' in result.public, false);
  assert.equal('unpublishAt' in result.public, false);
  assert.equal('createdAt' in result.public, false);
});

test('tombstones suppress bundled records without resurfacing and custom omissions disappear', () => {
  const base = [{ id: 'scintilla-animae', ...published }];
  assert.deepEqual(mergePublicArchiveRecords(base, { 'scintilla-animae': { tombstone: true } }), []);
  const custom = { custom: { id: 'ignored', ...published, title: 'Custom' } };
  assert.deepEqual(mergePublicArchiveRecords(base, custom).map((item) => item.id), ['scintilla-animae', 'custom']);
  assert.deepEqual(mergePublicArchiveRecords(base, {}).map((item) => item.id), ['scintilla-animae']);
});

test('malformed tombstones fail closed and duplicate bundled ids are emitted once', () => {
  const duplicateBase = [
    { id: 'scintilla-animae', ...published, title: 'First' },
    { id: 'scintilla-animae', ...published, title: 'Duplicate' },
  ];
  assert.deepEqual(mergePublicArchiveRecords(duplicateBase, {}).map((item) => item.title), ['First']);
  assert.deepEqual(mergePublicArchiveRecords(duplicateBase, {
    'scintilla-animae': { tombstone: 'invalid', ...published, title: 'Must not leak' },
    custom: { tombstone: false, ...published, title: 'Must not leak either' },
  }), []);
});
