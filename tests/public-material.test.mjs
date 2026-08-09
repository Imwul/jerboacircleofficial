import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPublicCollectionDraftMap,
  createPublicReferenceDraftMap,
  mergePublicArchiveCollections,
  mergePublicArchiveReferences,
} from '../shared/publicArchiveMaterial.mjs';
import { renderPublicPageMetadata } from '../shared/publicPageMetadata.mjs';

const baseReferences = [
  { id: 'book', kind: 'book', title: 'Book', description: 'Base description' },
  { id: 'image', kind: 'image', title: 'Image', description: 'Base image' },
];

test('public Catalogue material follows edits, deletions and newest-first ordering', () => {
  const result = mergePublicArchiveReferences(baseReferences, {
    book: { id: 'book', kind: 'book', title: 'Revised book', description: 'Revised', updatedAt: '2026-08-08T10:00:00Z' },
    image: { id: 'image', deletedAt: '2026-08-08T09:00:00Z' },
    new: { id: 'ignored-id', kind: 'place', title: 'New place', description: 'Added', updatedAt: '2026-08-08T11:00:00Z', internalNote: 'must not leak' },
    malformed: { id: 'malformed', title: 'Missing kind' },
  });
  assert.deepEqual(result.map((item) => item.id), ['new', 'book']);
  assert.equal(result[1].title, 'Revised book');
  assert.equal('internalNote' in result[0], false);
});

test('public reference snapshot keeps only valid public fields and deletion markers', () => {
  const snapshot = createPublicReferenceDraftMap({
    visible: { id: 'wrong', kind: 'quotation', title: 'Line', description: 'A line', privateMemo: 'hidden' },
    removed: { id: 'removed', deletedAt: '2026-08-08T00:00:00Z', privateMemo: 'hidden' },
    broken: { title: 'No kind' },
  });
  assert.deepEqual(snapshot.removed, { id: 'removed', deletedAt: true });
  assert.equal(snapshot.visible.id, 'visible');
  assert.equal('privateMemo' in snapshot.visible, false);
  assert.equal('broken' in snapshot, false);
});

test('public collections omit private custom records and suppress removed bundled records', () => {
  const base = [{ id: 'cycle', title: 'Cycle', description: 'Base', eventIds: ['a'], visibility: 'public' }];
  const snapshot = createPublicCollectionDraftMap({
    cycle: { id: 'cycle', title: 'Cycle', description: 'Base', eventIds: ['a'], visibility: 'private' },
    secret: { id: 'secret', title: 'Secret', description: 'Private', eventIds: [], visibility: 'private' },
    public: { id: 'public', title: 'Public', description: 'Visible', eventIds: [], visibility: 'public' },
  }, ['cycle']);
  assert.deepEqual(snapshot.cycle, { id: 'cycle', deletedAt: true });
  assert.equal('secret' in snapshot, false);
  assert.equal(snapshot.public.title, 'Public');
  assert.deepEqual(mergePublicArchiveCollections(base, snapshot).map((item) => item.id), ['public']);
});

test('missing public pages have no canonical or stale social URL and remain noindex', () => {
  const template = '<html><head><title>Home</title><link rel="canonical" href="https://example.com/" /><meta name="robots" content="index, follow" /><meta property="og:url" content="https://example.com/" /><meta property="og:image" content="https://example.com/old.png" /></head><body></body></html>';
  const html = renderPublicPageMetadata(template, {
    title: '없는 길 | Jerboa Circle',
    description: '없음',
    origin: 'https://jerboacircleofficial.vercel.app',
    image: '/og.png',
    indexable: false,
  });
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(html, /rel="canonical"/);
  assert.doesNotMatch(html, /property="og:url"/);
  assert.match(html, /property="og:image" content="https:\/\/jerboacircleofficial\.vercel\.app\/og\.png"/);
});

test('published public pages receive canonical and complete social metadata', () => {
  const html = renderPublicPageMetadata('<html><head><title>x</title></head><body></body></html>', {
    title: 'Record | Jerboa Circle',
    description: 'Description',
    origin: 'https://jerboacircleofficial.vercel.app',
    canonicalPath: '/archive/record/',
    image: '/poster.webp',
    type: 'article',
    indexable: true,
  });
  assert.match(html, /rel="canonical" href="https:\/\/jerboacircleofficial\.vercel\.app\/archive\/record\/"/);
  assert.match(html, /property="og:type" content="article"/);
  assert.match(html, /property="og:image:alt" content="Record \| Jerboa Circle"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:image:alt" content="Record \| Jerboa Circle"/);
});
